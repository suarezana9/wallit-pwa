-- 015: detalle de un gasto (ticket con productos, lo que no era tuyo y reintegros).
-- Correr una vez en Supabase > SQL Editor. Es idempotente.
--
-- expenses.amount sigue siendo lo que realmente gastaste (el neto). detalle guarda de dónde sale:
--   {"total": 49352.25,
--    "items": [{"descripcion": "Leche condensada", "monto": 3500, "excluido": true}, ...],
--    "reintegro": 9800, "reintegro_nota": "MODO"}

alter table public.expenses add column if not exists detalle jsonb;

alter table public.expenses drop constraint if exists expenses_detalle_check;
alter table public.expenses add constraint expenses_detalle_check
  check (detalle is null or jsonb_typeof(detalle) = 'object');
