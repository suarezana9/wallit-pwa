-- 013: tipos de grupo (hogar / viaje), archivado y registro de actividad.
-- Correr una vez en Supabase > SQL Editor, después de la 012. Es idempotente.

-- 1) Tipo de grupo, fechas del viaje y archivado.
alter table public.groups add column if not exists tipo text not null default 'hogar';
alter table public.groups add column if not exists fecha_inicio date;
alter table public.groups add column if not exists fecha_fin date;
alter table public.groups add column if not exists archivado boolean not null default false;

alter table public.groups drop constraint if exists groups_tipo_check;
alter table public.groups add constraint groups_tipo_check check (tipo in ('hogar', 'viaje'));
alter table public.groups drop constraint if exists groups_fechas_check;
alter table public.groups add constraint groups_fechas_check
  check (fecha_inicio is null or fecha_fin is null or fecha_fin >= fecha_inicio);

-- buscar_grupo_por_codigo no cambia: un grupo archivado se puede seguir uniendo (por ejemplo, para saldar).

-- 2) Actividad del grupo: la llenan triggers, nadie escribe a mano.
create table if not exists public.group_activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor uuid references public.users(id) on delete set null,
  kind text not null check (kind in (
    'gasto_nuevo', 'gasto_editado', 'gasto_borrado', 'pago', 'pago_borrado', 'miembro_entro', 'miembro_salio'
  )),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists group_activity_group_idx on public.group_activity (group_id, created_at desc);

alter table public.group_activity enable row level security;

drop policy if exists "actividad_select" on public.group_activity;
create policy "actividad_select" on public.group_activity
  for select using (public.es_miembro(group_id, (select auth.uid())));
-- Sin políticas de insert/update/delete: solo escriben los triggers (security definer).

create or replace function public.registrar_actividad(p_group uuid, p_actor uuid, p_kind text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if p_group is null then
    return;
  end if;
  select name into v_name from public.users where id = p_actor;
  insert into public.group_activity (group_id, actor, kind, data)
  values (p_group, p_actor, p_kind, p_data || jsonb_build_object('actor_name', coalesce(v_name, '')));
exception when others then
  null; -- la actividad nunca debe romper la operación principal
end;
$$;

-- Gastos de grupo (los privados no se registran).
create or replace function public.trg_actividad_gastos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    v_actor := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  end if;
  if tg_op = 'INSERT' then
    if new.group_id is not null and not new.is_private then
      perform public.registrar_actividad(new.group_id, v_actor, 'gasto_nuevo', jsonb_build_object(
        'descripcion', new.description, 'categoria', new.category, 'tipo', new.tipo, 'monto', new.amount));
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.group_id is not null and not new.is_private and (
      new.amount is distinct from old.amount or new.description is distinct from old.description
      or new.date is distinct from old.date or new.paid_by is distinct from old.paid_by
      or new.division is distinct from old.division or new.category is distinct from old.category
    ) then
      perform public.registrar_actividad(new.group_id, v_actor, 'gasto_editado', jsonb_build_object(
        'descripcion', new.description, 'categoria', new.category, 'tipo', new.tipo,
        'monto', new.amount, 'monto_anterior', old.amount));
    end if;
    return new;
  else
    if old.group_id is not null and not old.is_private then
      perform public.registrar_actividad(old.group_id, v_actor, 'gasto_borrado', jsonb_build_object(
        'descripcion', old.description, 'categoria', old.category, 'tipo', old.tipo, 'monto', old.amount));
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists actividad_gastos on public.expenses;
create trigger actividad_gastos
  after insert or update or delete on public.expenses
  for each row execute function public.trg_actividad_gastos();

-- Pagos entre miembros.
create or replace function public.trg_actividad_pagos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_actividad(new.group_id, coalesce(auth.uid(), new.created_by), 'pago',
      jsonb_build_object('de', new.from_user, 'para', new.to_user, 'monto', new.amount));
    return new;
  end if;
  perform public.registrar_actividad(old.group_id, coalesce(auth.uid(), old.created_by), 'pago_borrado',
    jsonb_build_object('de', old.from_user, 'para', old.to_user, 'monto', old.amount));
  return old;
end;
$$;

drop trigger if exists actividad_pagos on public.settlements;
create trigger actividad_pagos
  after insert or delete on public.settlements
  for each row execute function public.trg_actividad_pagos();

-- Altas y bajas de miembros.
create or replace function public.trg_actividad_miembros()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.registrar_actividad(new.group_id, new.user_id, 'miembro_entro', '{}'::jsonb);
    return new;
  end if;
  perform public.registrar_actividad(old.group_id, old.user_id, 'miembro_salio', '{}'::jsonb);
  return old;
end;
$$;

drop trigger if exists actividad_miembros on public.group_members;
create trigger actividad_miembros
  after insert or delete on public.group_members
  for each row execute function public.trg_actividad_miembros();

-- 3) Tiempo real para el feed.
do $$
begin
  alter publication supabase_realtime add table public.group_activity;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
