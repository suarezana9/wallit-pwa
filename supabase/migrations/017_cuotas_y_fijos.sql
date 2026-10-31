-- 017: compras en cuotas y gastos/ingresos fijos.
-- Correr una vez en Supabase > SQL Editor, después de la 016. Es idempotente.
--
-- Qué hace:
--   1. Cuotas: una compra en 12 cuotas se guarda como 12 movimientos (uno por mes) con el mismo compra_id.
--      Así cada mes suma solo su cuota y totales, presupuestos y saldos funcionan sin cambios.
--   2. Fijos (tabla recurrentes): alquiler, servicios, sueldo... Cada mes aparecen en Inicio para confirmarlos.
--      El movimiento confirmado queda enlazado con recurrente_id (uno por mes, aunque se toque dos veces).
--   3. La actividad del grupo registra solo la primera cuota (no 12 avisos por una compra).

-- 1) Cuotas.
alter table public.expenses add column if not exists compra_id uuid;
alter table public.expenses add column if not exists cuota_num smallint;
alter table public.expenses add column if not exists cuotas_total smallint;

alter table public.expenses drop constraint if exists expenses_cuotas_check;
alter table public.expenses add constraint expenses_cuotas_check check (
  (compra_id is null and cuota_num is null and cuotas_total is null)
  or (
    compra_id is not null and cuotas_total between 2 and 60 and cuota_num between 1 and cuotas_total
  )
);

create index if not exists expenses_compra_idx on public.expenses (compra_id) where compra_id is not null;

-- 2) Fijos.
create table if not exists public.recurrentes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade default auth.uid(),
  group_id uuid references public.groups(id) on delete cascade,
  tipo text not null default 'gasto' check (tipo in ('gasto', 'ingreso', 'ahorro', 'inversion')),
  amount numeric(12, 2) not null check (amount > 0),
  category text not null default 'Otros',
  fuente text check (fuente is null or fuente in ('sueldo', 'freelance', 'alquiler', 'otro')),
  description text not null default '' check (char_length(description) <= 120),
  medio_pago text check (medio_pago is null or medio_pago in ('efectivo', 'debito', 'credito', 'transferencia')),
  division jsonb check (
    division is null
    or (division->>'tipo' = 'iguales' and jsonb_typeof(division->'entre') = 'array')
    or (division->>'tipo' = 'montos' and jsonb_typeof(division->'partes') = 'object')
  ),
  dia smallint not null check (dia between 1 and 31),
  desde text not null check (desde ~ '^\d{4}-\d{2}$'),
  activo boolean not null default true,
  saltados text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists recurrentes_user_idx on public.recurrentes (user_id);

alter table public.recurrentes enable row level security;

-- Cada fijo es de quien lo creó. En un grupo, tiene que seguir siendo miembro.
drop policy if exists "fijos_select" on public.recurrentes;
create policy "fijos_select" on public.recurrentes
  for select using (user_id = (select auth.uid()));

drop policy if exists "fijos_insert" on public.recurrentes;
create policy "fijos_insert" on public.recurrentes
  for insert with check (
    user_id = (select auth.uid())
    and (group_id is null or public.es_miembro(group_id, (select auth.uid())))
  );

drop policy if exists "fijos_update" on public.recurrentes;
create policy "fijos_update" on public.recurrentes
  for update using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "fijos_delete" on public.recurrentes;
create policy "fijos_delete" on public.recurrentes
  for delete using (user_id = (select auth.uid()));

alter table public.expenses add column if not exists recurrente_id uuid references public.recurrentes(id) on delete set null;

-- Un solo movimiento por fijo y por mes (si confirmás desde dos dispositivos a la vez, el segundo falla).
create unique index if not exists expenses_recurrente_mes_idx
  on public.expenses (recurrente_id, (date_trunc('month', date::timestamp)))
  where recurrente_id is not null;

-- 3) Actividad del grupo: igual que en la 013, pero de una compra en cuotas solo cuenta la primera.
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
    if new.group_id is not null and not new.is_private and coalesce(new.cuota_num, 1) = 1 then
      perform public.registrar_actividad(new.group_id, v_actor, 'gasto_nuevo', jsonb_build_object(
        'descripcion', new.description, 'categoria', new.category, 'tipo', new.tipo,
        'monto', case when new.cuotas_total is null then new.amount else new.amount * new.cuotas_total end,
        'cuotas', new.cuotas_total));
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.group_id is not null and not new.is_private and coalesce(new.cuota_num, 1) = 1 and (
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
    if old.group_id is not null and not old.is_private and coalesce(old.cuota_num, 1) = 1 then
      perform public.registrar_actividad(old.group_id, v_actor, 'gasto_borrado', jsonb_build_object(
        'descripcion', old.description, 'categoria', old.category, 'tipo', old.tipo, 'monto', old.amount));
    end if;
    return old;
  end if;
end;
$$;
