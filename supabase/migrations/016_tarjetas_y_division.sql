-- 016: pagos de tarjeta, medio de pago y cómo maneja la plata cada grupo.
-- Correr una vez en Supabase > SQL Editor, después de la 015. Es idempotente.
--
-- Qué hace:
--   1. expenses.tipo acepta 'pago_tarjeta': el pago del resumen cuando las compras ya están cargadas.
--      No suma a gastos (si sumara, cada compra se contaría dos veces).
--   2. expenses.medio_pago: efectivo, débito, crédito o transferencia/QR (opcional).
--   3. groups.divide_gastos: true = "Dividimos gastos" (saldos y deudas), false = "Bolsa común".
--      Al agregarla, los grupos de hogar que nunca usaron las cuentas (sin pagos registrados,
--      sin "pagó otra persona" y sin división por montos) pasan a bolsa común, y se borra la
--      división en partes iguales que la app les ponía sola a sus gastos.

-- 1) Nuevo tipo de movimiento. El check original (migración 006) no tiene nombre fijo: se busca por contenido.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.expenses'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%''inversion''%'
  loop
    execute format('alter table public.expenses drop constraint %I', v_name);
  end loop;
end $$;

alter table public.expenses add constraint expenses_tipo_check
  check (tipo in ('gasto', 'ingreso', 'ahorro', 'inversion', 'pago_tarjeta'));

-- 2) Medio de pago.
alter table public.expenses add column if not exists medio_pago text;
alter table public.expenses drop constraint if exists expenses_medio_pago_check;
alter table public.expenses add constraint expenses_medio_pago_check
  check (medio_pago is null or medio_pago in ('efectivo', 'debito', 'credito', 'transferencia'));

-- 3) Bolsa común o dividimos gastos.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'groups' and column_name = 'divide_gastos'
  ) then
    return; -- ya corrió: no se vuelve a tocar nada
  end if;

  alter table public.groups add column divide_gastos boolean not null default true;

  create temporary table bolsa_comun on commit drop as
  select g.id from public.groups g
  where g.tipo = 'hogar'
    and not exists (select 1 from public.settlements s where s.group_id = g.id)
    and not exists (
      select 1 from public.expenses e
      where e.group_id = g.id and (e.paid_by is not null or e.division->>'tipo' = 'montos')
    );

  update public.groups set divide_gastos = false where id in (select id from bolsa_comun);

  -- Sin el trigger de actividad: es una limpieza, no "Ana editó 40 gastos".
  alter table public.expenses disable trigger actividad_gastos;
  update public.expenses set division = null
  where group_id in (select id from bolsa_comun) and division is not null;
  alter table public.expenses enable trigger actividad_gastos;
end $$;
