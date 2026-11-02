-- 020: resumen mensual con IA.
-- Correr una vez en Supabase > SQL Editor, después de la 014 (usa pg_cron y llamar_wallit_notificaciones). Es idempotente.
--
-- Qué hace:
--   1. resumenes_ia: guarda el texto que escribió la IA para cada mes y espacio, así se genera una sola vez
--      (no gasta puntos de IA cada vez que abrís el resumen, y se ve igual en el celular y en la compu).
--   2. Programa el aviso del día 1 de cada mes a las 10:00 de Argentina (13:00 UTC).

create table if not exists public.resumenes_ia (
  user_id uuid not null references public.users(id) on delete cascade default auth.uid(),
  -- 'personal' o el id del grupo.
  espacio text not null check (espacio = 'personal' or espacio ~ '^[0-9a-f-]{36}$'),
  mes text not null check (mes ~ '^\d{4}-\d{2}$'),
  idioma text not null default 'es' check (idioma in ('es', 'en')),
  contenido jsonb not null check (jsonb_typeof(contenido) = 'object' and pg_column_size(contenido) < 8000),
  created_at timestamptz not null default now(),
  primary key (user_id, espacio, mes, idioma)
);

alter table public.resumenes_ia enable row level security;

drop policy if exists "resumenes_select_own" on public.resumenes_ia;
create policy "resumenes_select_own" on public.resumenes_ia
  for select using (user_id = (select auth.uid()));

drop policy if exists "resumenes_insert_own" on public.resumenes_ia;
create policy "resumenes_insert_own" on public.resumenes_ia
  for insert with check (user_id = (select auth.uid()));

drop policy if exists "resumenes_update_own" on public.resumenes_ia;
create policy "resumenes_update_own" on public.resumenes_ia
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "resumenes_delete_own" on public.resumenes_ia;
create policy "resumenes_delete_own" on public.resumenes_ia
  for delete using (user_id = (select auth.uid()));

-- Aviso mensual (requiere pg_cron y la función de la migración 014).
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'wallit-resumen-mensual';
  perform cron.schedule(
    'wallit-resumen-mensual',
    '0 13 1 * *',
    $job$ select public.llamar_wallit_notificaciones('{"tipo": "resumen"}'::jsonb) $job$
  );
exception
  when undefined_table or invalid_schema_name or undefined_function then
    raise notice 'pg_cron no está habilitado: el aviso mensual queda sin programar.';
end $$;
