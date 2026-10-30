-- 011: comprobantes (fotos de tickets) en Supabase Storage.
-- Correr una vez en Supabase > SQL Editor. Es idempotente: se puede volver a correr sin romper nada.
--
-- Bucket privado "receipts". Cada archivo vive en "<user_id>/<uuid>.jpg" y en expenses.receipt_url
-- se guarda esa ruta (no una URL pública). La app pide URLs firmadas que vencen en una hora.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Subir: solo dentro de tu propia carpeta.
drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Ver: los tuyos, o los de un movimiento NO privado de un grupo del que sos miembro.
drop policy if exists "receipts_select" on storage.objects;
create policy "receipts_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'receipts'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or exists (
        select 1
        from public.expenses e
        join public.group_members gm on gm.group_id = e.group_id
        where e.receipt_url = storage.objects.name
          and e.is_private = false
          and gm.user_id = (select auth.uid())
      )
    )
  );

-- Reemplazar y borrar: solo los tuyos.
drop policy if exists "receipts_update_own" on storage.objects;
create policy "receipts_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
