-- 019: datos para cobrar (alias y CBU/CVU o IBAN), para saldar deudas de grupo sin salir de la app.
-- Correr una vez en Supabase > SQL Editor. Es idempotente.
--
-- Privacidad: cada persona edita los suyos (como el resto de su fila en users) y solo los ven
-- quienes comparten un grupo con ella, a través de datos_cobro_grupo().

alter table public.users add column if not exists cobro_alias text;
alter table public.users add column if not exists cobro_cuenta text;

alter table public.users drop constraint if exists users_cobro_alias_check;
alter table public.users add constraint users_cobro_alias_check
  check (cobro_alias is null or char_length(cobro_alias) between 3 and 60);

-- CBU/CVU (22 dígitos) o IBAN (letras y números). El dígito verificador del CBU lo valida la app.
alter table public.users drop constraint if exists users_cobro_cuenta_check;
alter table public.users add constraint users_cobro_cuenta_check
  check (cobro_cuenta is null or cobro_cuenta ~ '^[A-Z0-9]{8,34}$');

-- Datos de cobro de los miembros de un grupo, solo si quien pregunta es miembro.
create or replace function public.datos_cobro_grupo(p_group_id uuid)
returns table (user_id uuid, alias text, cuenta text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.cobro_alias, u.cobro_cuenta
  from public.group_members gm
  join public.users u on u.id = gm.user_id
  where gm.group_id = p_group_id
    and public.es_miembro(p_group_id, auth.uid());
$$;

revoke all on function public.datos_cobro_grupo(uuid) from public, anon;
grant execute on function public.datos_cobro_grupo(uuid) to authenticated;
