-- 014: notificaciones push (web y app móvil) disparadas desde la base.
-- Correr una vez en Supabase > SQL Editor, después de la 013. Es idempotente.
--
-- Antes de correrla:
--   1. Database > Extensions: habilitar pg_net y pg_cron.
--   2. Crear el secreto compartido con la Edge Function (reemplazá VALOR por uno largo y al azar):
--        select vault.create_secret('VALOR', 'wallit_webhook_secret');
--      El mismo VALOR va como secreto WEBHOOK_SECRET de la función wallit-notificaciones.
--
-- Qué hace:
--   - push_subscriptions: un registro por navegador/dispositivo suscripto a Web Push.
--   - Triggers que llaman a la función wallit-notificaciones (con el secreto leído de Vault, nunca escrito en el SQL).
--   - Reemplaza los triggers de la 010, que tenían una clave secreta dentro de la función.
--   - Un recordatorio semanal de deudas con pg_cron.

-- 1) Suscripciones Web Push.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
  for select using (user_id = (select auth.uid()));

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
  for delete using (user_id = (select auth.uid()));

-- Alta por RPC: si el mismo navegador estaba suscripto con otra cuenta, la suscripción pasa a la cuenta actual.
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
end;
$$;

revoke all on function public.guardar_suscripcion_push(text, text, text, text) from public;
grant execute on function public.guardar_suscripcion_push(text, text, text, text) to authenticated;

-- 2) Avisos de presupuesto ya enviados (para no repetir el del 80% o el del 100%).
create table if not exists public.budget_alerts (
  budget_id uuid not null references public.budgets(id) on delete cascade,
  umbral int not null check (umbral in (80, 100)),
  created_at timestamptz not null default now(),
  primary key (budget_id, umbral)
);
alter table public.budget_alerts enable row level security;
-- Sin políticas: solo la usa la Edge Function con la clave de servicio.

-- 3) Llamada a la Edge Function. El secreto vive en Vault; si no está cargado, no hace nada.
create or replace function public.llamar_wallit_notificaciones(p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'wallit_webhook_secret' limit 1;
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://aqwvhernxswfpwzqzcxa.supabase.co/functions/v1/wallit-notificaciones',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-wallit-secret', v_secret),
    body := p_payload
  );
exception when others then
  null; -- una notificación nunca debe romper la operación que la dispara
end;
$$;

revoke all on function public.llamar_wallit_notificaciones(jsonb) from public, anon, authenticated;

-- Actividad de grupo (013): gasto nuevo, pago registrado, miembro nuevo.
create or replace function public.trg_notif_actividad()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind in ('gasto_nuevo', 'pago', 'miembro_entro') then
    perform public.llamar_wallit_notificaciones(jsonb_build_object('tipo', 'actividad', 'id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists notif_actividad on public.group_activity;
create trigger notif_actividad
  after insert on public.group_activity
  for each row execute function public.trg_notif_actividad();

-- Gastos: revisar si algún presupuesto cruzó el 80% o el 100%.
create or replace function public.trg_notif_presupuesto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tipo = 'gasto' and (
    tg_op = 'INSERT' or new.amount is distinct from old.amount
    or new.category is distinct from old.category or new.date is distinct from old.date
  ) then
    perform public.llamar_wallit_notificaciones(jsonb_build_object('tipo', 'presupuesto', 'expense_id', new.id));
  end if;
  return new;
end;
$$;

drop trigger if exists notif_presupuesto on public.expenses;
create trigger notif_presupuesto
  after insert or update on public.expenses
  for each row execute function public.trg_notif_presupuesto();

-- 4) Reemplazo de la 010: esos triggers llamaban a notificar-grupo con una clave secreta escrita en la función.
--    wallit-notificaciones también avisa a la app móvil (Expo), así que no se pierde nada.
drop trigger if exists notif_nuevo_miembro on public.group_members;
drop trigger if exists notif_nuevo_gasto_grupo on public.expenses;
drop function if exists public.trigger_notif_nuevo_miembro();
drop function if exists public.trigger_notif_nuevo_gasto_grupo();
drop function if exists public.llamar_notificar_grupo(jsonb);

-- 5) Recordatorio de deudas: lunes 9:00 de Argentina (12:00 UTC).
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'wallit-deudas-semanal';
  perform cron.schedule(
    'wallit-deudas-semanal',
    '0 12 * * 1',
    $job$ select public.llamar_wallit_notificaciones('{"tipo": "deudas"}'::jsonb) $job$
  );
exception
  when undefined_table or invalid_schema_name or undefined_function then
    raise notice 'pg_cron no está habilitado: el recordatorio semanal queda sin programar.';
end $$;
