-- 022: foto de perfil y avatar de grupo (emoji o foto).
-- Correr una vez en Supabase > SQL Editor. Es idempotente.
--
-- Qué hace:
--   1. groups.avatar_emoji / groups.avatar_url: el avatar del grupo (si hay foto, gana la foto).
--      La foto de perfil usa la columna users.avatar_url que ya existía.
--   2. Bucket "avatars" (público, máx. 2 MB, solo imágenes). Las fotos se achican en la app a 256×256.
--      Rutas: users/<id de la persona>/... y groups/<id del grupo>/...
--   3. Permisos: cada persona sube y borra solo en su carpeta; en la de un grupo, solo sus admins.
--      Leer es público (son fotos de perfil, no comprobantes): así se muestran con un <img> simple.

alter table public.groups add column if not exists avatar_emoji text;
alter table public.groups add column if not exists avatar_url text;

alter table public.groups drop constraint if exists groups_avatar_emoji_check;
alter table public.groups add constraint groups_avatar_emoji_check
  check (avatar_emoji is null or char_length(avatar_emoji) between 1 and 16);

alter table public.groups drop constraint if exists groups_avatar_url_check;
alter table public.groups add constraint groups_avatar_url_check
  check (avatar_url is null or (char_length(avatar_url) < 500 and avatar_url like 'https://%'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ¿Puede quien llama tocar esta carpeta del bucket?
create or replace function public.puede_editar_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case (storage.foldername(p_name))[1]
    when 'users' then (storage.foldername(p_name))[2] = auth.uid()::text
    when 'groups' then exists (
      select 1 from public.group_members gm
      where gm.group_id::text = (storage.foldername(p_name))[2]
        and gm.user_id = auth.uid()
        and gm.role = 'admin'
    )
    else false
  end;
$$;

revoke all on function public.puede_editar_avatar(text) from public, anon;
grant execute on function public.puede_editar_avatar(text) to authenticated;

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars' and public.puede_editar_avatar(name));

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and public.puede_editar_avatar(name))
  with check (bucket_id = 'avatars' and public.puede_editar_avatar(name));

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars' and public.puede_editar_avatar(name));

