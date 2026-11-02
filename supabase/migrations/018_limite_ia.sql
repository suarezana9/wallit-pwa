-- 018: límite de uso de la IA (wallit-ia), para que nadie gaste la cuota de Groq.
-- Correr una vez en Supabase > SQL Editor. Es idempotente.
--
-- Cómo funciona:
--   - Cada consulta "cuesta" puntos según lo que le pide a Groq: texto 1, voz 2, foto de ticket 3.
--   - Por persona: un máximo de puntos por día (hora de Argentina) y de consultas por minuto.
--   - La Edge Function llama a consumir_ia() ANTES de ir a Groq. Si la IA falla, devuelve los puntos.
--   - Los límites se cambian sin redeployar:  update public.ia_limites set puntos_por_dia = 100;

-- 1) Límites (una sola fila).
create table if not exists public.ia_limites (
  id boolean primary key default true check (id),
  puntos_por_dia int not null default 60 check (puntos_por_dia > 0),
  consultas_por_minuto int not null default 6 check (consultas_por_minuto > 0),
  costo_texto int not null default 1 check (costo_texto > 0),
  costo_audio int not null default 2 check (costo_audio > 0),
  costo_imagen int not null default 3 check (costo_imagen > 0),
  zona_horaria text not null default 'America/Argentina/Buenos_Aires'
);
insert into public.ia_limites (id) values (true) on conflict (id) do nothing;
alter table public.ia_limites enable row level security;
-- Sin políticas: solo la leen las funciones de abajo.

-- 2) Registro de uso.
create table if not exists public.ia_uso (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  tipo text not null check (tipo in ('texto', 'audio', 'imagen')),
  puntos int not null,
  created_at timestamptz not null default now()
);
create index if not exists ia_uso_user_idx on public.ia_uso (user_id, created_at desc);
alter table public.ia_uso enable row level security;

drop policy if exists "ia_uso_select_own" on public.ia_uso;
create policy "ia_uso_select_own" on public.ia_uso
  for select using (user_id = (select auth.uid()));
-- Sin insert/update/delete directos: se usa solo por las funciones.

-- 3) Uso de hoy (para mostrar en Cuenta).
create or replace function public.uso_ia_hoy()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_lim public.ia_limites;
  v_usados int;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHORIZED';
  end if;
  select * into v_lim from public.ia_limites limit 1;
  select coalesce(sum(puntos), 0) into v_usados
  from public.ia_uso
  where user_id = auth.uid()
    and created_at >= (date_trunc('day', now() at time zone v_lim.zona_horaria) at time zone v_lim.zona_horaria);
  return jsonb_build_object('usados', v_usados, 'limite', v_lim.puntos_por_dia,
    'costos', jsonb_build_object('texto', v_lim.costo_texto, 'audio', v_lim.costo_audio, 'imagen', v_lim.costo_imagen));
end;
$$;

-- 4) Consumir: chequea y registra en una sola operación (con un lock por usuario, para que
--    dos pedidos al mismo tiempo no se salteen el límite).
create or replace function public.consumir_ia(p_tipo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lim public.ia_limites;
  v_costo int;
  v_inicio_dia timestamptz;
  v_usados int;
  v_ultimo_minuto int;
  v_id bigint;
begin
  if v_uid is null then
    raise exception 'UNAUTHORIZED';
  end if;
  select * into v_lim from public.ia_limites limit 1;
  v_costo := case p_tipo
    when 'texto' then v_lim.costo_texto
    when 'audio' then v_lim.costo_audio
    when 'imagen' then v_lim.costo_imagen
  end;
  if v_costo is null then
    raise exception 'BAD_TYPE';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('wallit-ia:' || v_uid::text, 0));

  select count(*) into v_ultimo_minuto
  from public.ia_uso where user_id = v_uid and created_at > now() - interval '1 minute';
  if v_ultimo_minuto >= v_lim.consultas_por_minuto then
    return jsonb_build_object('ok', false, 'motivo', 'minuto');
  end if;

  v_inicio_dia := date_trunc('day', now() at time zone v_lim.zona_horaria) at time zone v_lim.zona_horaria;
  select coalesce(sum(puntos), 0) into v_usados
  from public.ia_uso where user_id = v_uid and created_at >= v_inicio_dia;
  if v_usados + v_costo > v_lim.puntos_por_dia then
    return jsonb_build_object('ok', false, 'motivo', 'dia', 'usados', v_usados, 'limite', v_lim.puntos_por_dia);
  end if;

  insert into public.ia_uso (user_id, tipo, puntos) values (v_uid, p_tipo, v_costo) returning id into v_id;
  return jsonb_build_object('ok', true, 'id', v_id, 'usados', v_usados + v_costo, 'limite', v_lim.puntos_por_dia);
end;
$$;

-- 5) Devolver: si Groq falló, la consulta no cuenta. Solo la llama la Edge Function con la clave
--    de servicio (si la pudiera llamar cualquiera, alguien se "devolvería" todo y no tendría límite).
create or replace function public.devolver_ia(p_id bigint)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.ia_uso where id = p_id and created_at > now() - interval '5 minutes';
$$;

revoke all on function public.uso_ia_hoy() from public, anon;
revoke all on function public.consumir_ia(text) from public, anon;
revoke all on function public.devolver_ia(bigint) from public, anon, authenticated;
grant execute on function public.uso_ia_hoy() to authenticated;
grant execute on function public.consumir_ia(text) to authenticated;
grant execute on function public.devolver_ia(bigint) to service_role;
