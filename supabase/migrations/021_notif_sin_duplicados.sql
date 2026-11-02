-- 021: avisos sin duplicados.
-- Correr una vez en Supabase > SQL Editor, después de la 014. Es idempotente.
--
-- Por qué llegaban dos veces:
--   a) El mismo celular quedaba registrado dos veces (reinstalar la app, volver a activar los avisos):
--      cada registro recibe su copia.
--   b) El mismo evento puede llamar dos veces a wallit-notificaciones (un reintento, un webhook viejo del panel).
--
-- Qué hace:
--   1. notif_eventos: la función anota cada evento que avisó; si vuelve a llegar, no manda nada.
--   2. guardar_suscripcion_push: al registrar un dispositivo borra los registros viejos del mismo navegador.
--   3. Limpia los duplicados que ya existen (deja el más nuevo).

create table if not exists public.notif_eventos (
  clave text primary key,
  created_at timestamptz not null default now()
);
-- Solo la usa la función (service role): RLS sin políticas = nadie más la ve.
alter table public.notif_eventos enable row level security;

create or replace function public.guardar_suscripcion_push(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now();
  -- Mismo navegador y misma cuenta con otro endpoint = registro viejo de este dispositivo.
  if p_user_agent is not null then
    delete from public.push_subscriptions
    where user_id = auth.uid() and user_agent = left(p_user_agent, 300) and endpoint <> p_endpoint;
  end if;
end;
$$;

revoke all on function public.guardar_suscripcion_push(text, text, text, text) from public;
grant execute on function public.guardar_suscripcion_push(text, text, text, text) to authenticated;

delete from public.push_subscriptions s
using public.push_subscriptions newer
where s.user_id = newer.user_id
  and s.user_agent is not null
  and s.user_agent = newer.user_agent
  and (newer.created_at, newer.id) > (s.created_at, s.id);

-- Limpieza: las claves sirven unos días; se borran las de más de 40 días todos los días.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'wallit-notif-eventos-limpieza';
  perform cron.schedule(
    'wallit-notif-eventos-limpieza',
    '17 7 * * *',
    $job$ delete from public.notif_eventos where created_at < now() - interval '40 days' $job$
  );
exception
  when undefined_table or invalid_schema_name or undefined_function then
    raise notice 'pg_cron no está habilitado: notif_eventos queda sin limpieza automática (es chica, no pasa nada).';
end $$;
