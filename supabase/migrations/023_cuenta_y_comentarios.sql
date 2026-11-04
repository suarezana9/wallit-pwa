-- 023: eliminar la cuenta y enviar comentarios.
-- Correr una vez en Supabase > SQL Editor. Es idempotente.
--
-- 1. eliminar_mi_cuenta(): borra los datos personales de quien la llama y anonimiza su usuario.
--    No se borra la fila de users ni la de auth.users: settlements y otras tablas tienen "on delete cascade"
--    hacia users, y borrarla haría desaparecer pagos y gastos de los grupos compartidos (le cambiaría las
--    cuentas a los demás). En cambio:
--      - se borra todo lo personal: movimientos del espacio Personal y privados, presupuestos personales,
--        fijos, resúmenes de IA, uso de IA, suscripciones a avisos;
--      - los grupos donde era el único miembro se borran enteros;
--      - en los grupos compartidos sale del grupo (queda como "ex miembro", igual que si se hubiera ido) y,
--        si era el único admin, pasa a serlo quien entró primero;
--      - users y auth.users quedan sin nombre, email, foto ni datos de cobro; se cierran sus sesiones y se
--        desvincula Google: con ese email se puede volver a crear una cuenta nueva, de cero.
--    Las fotos (perfil y tickets) las borra la app antes de llamar a esta función.
-- 2. comentarios: lo que la gente manda desde Cuenta > Enviar comentarios. Se leen en Table Editor.

alter table public.users add column if not exists eliminado_at timestamptz;

create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_group record;
begin
  if v_user is null then
    raise exception 'UNAUTHORIZED';
  end if;

  -- Grupos
  for v_group in
    select gm.group_id,
           gm.role,
           (select count(*) from public.group_members o where o.group_id = gm.group_id and o.user_id <> v_user) as others,
           (select count(*) from public.group_members o where o.group_id = gm.group_id and o.user_id <> v_user and o.role = 'admin') as other_admins
    from public.group_members gm
    where gm.user_id = v_user
  loop
    if v_group.others = 0 then
      -- Era el único: el grupo entero se va (explícito, por si alguna tabla no tiene cascade).
      delete from public.expenses where group_id = v_group.group_id;
      delete from public.settlements where group_id = v_group.group_id;
      delete from public.recurrentes where group_id = v_group.group_id;
      delete from public.budgets where group_id = v_group.group_id;
      delete from public.group_activity where group_id = v_group.group_id;
      delete from public.group_members where group_id = v_group.group_id;
      delete from public.groups where id = v_group.group_id;
    else
      if v_group.role = 'admin' and v_group.other_admins = 0 then
        update public.group_members set role = 'admin'
        where group_id = v_group.group_id
          and user_id = (
            select user_id from public.group_members
            where group_id = v_group.group_id and user_id <> v_user
            order by joined_at asc limit 1
          );
      end if;
      -- Lo privado dentro del grupo era solo suyo.
      delete from public.expenses where group_id = v_group.group_id and user_id = v_user and is_private;
      delete from public.group_members where group_id = v_group.group_id and user_id = v_user;
    end if;
  end loop;

  -- Datos personales
  delete from public.expenses where user_id = v_user and group_id is null;
  delete from public.recurrentes where user_id = v_user;
  delete from public.budgets where user_id = v_user and group_id is null;
  delete from public.push_subscriptions where user_id = v_user;
  begin
    delete from public.resumenes_ia where user_id = v_user;
  exception when undefined_table then null;
  end;

  -- Usuario anonimizado (los gastos que quedan en grupos compartidos lo muestran como "ex miembro").
  update public.users
  set name = null,
      email = 'eliminado+' || v_user || '@wallit.invalid',
      avatar_url = null,
      push_token = null,
      notif_config = null,
      categoria_config = null,
      cobro_alias = null,
      cobro_cuenta = null,
      eliminado_at = now()
  where id = v_user;

  -- Cuenta de acceso: sin email real, sin Google, sin sesiones y bloqueada.
  delete from auth.identities where user_id = v_user;
  begin
    delete from auth.sessions where user_id = v_user;
    delete from auth.refresh_tokens where user_id = v_user::text;
  exception when others then null;
  end;
  update auth.users
  set email = 'eliminado+' || v_user || '@wallit.invalid',
      phone = null,
      encrypted_password = '',
      raw_user_meta_data = '{}'::jsonb,
      banned_until = now() + interval '100 years'
  where id = v_user;
end;
$$;

revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

-- Comentarios
create table if not exists public.comentarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null default auth.uid(),
  texto text not null check (char_length(btrim(texto)) between 1 and 2000),
  pantalla text check (pantalla is null or char_length(pantalla) <= 200),
  dispositivo text check (dispositivo is null or char_length(dispositivo) <= 300),
  created_at timestamptz not null default now()
);

alter table public.comentarios enable row level security;

-- Cada persona solo puede mandar a su nombre; leerlos es solo desde el panel de Supabase.
drop policy if exists "comentarios_insert_own" on public.comentarios;
create policy "comentarios_insert_own" on public.comentarios
  for insert to authenticated with check (user_id = (select auth.uid()));
