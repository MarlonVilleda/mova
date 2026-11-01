-- Dispositivos de cada usuario. Pegar en SQL Editor > New query > Run.
-- No borra nada y se puede correr más de una vez.
create table if not exists public.mova_dispositivos (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 40),
  plataforma text not null check (plataforma in ('iphone', 'ipad', 'android', 'mac', 'windows', 'otro')),
  metodo text not null check (char_length(metodo) <= 40),
  bloqueo boolean not null default false,
  ultimo_acceso timestamptz not null default now(),
  creado timestamptz not null default now()
);

create index if not exists mova_dispositivos_user_id_idx on public.mova_dispositivos (user_id);

alter table public.mova_dispositivos enable row level security;

drop policy if exists "dispositivos: leer los propios" on public.mova_dispositivos;
create policy "dispositivos: leer los propios" on public.mova_dispositivos
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "dispositivos: crear los propios" on public.mova_dispositivos;
create policy "dispositivos: crear los propios" on public.mova_dispositivos
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "dispositivos: cambiar los propios" on public.mova_dispositivos;
create policy "dispositivos: cambiar los propios" on public.mova_dispositivos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dispositivos: borrar los propios" on public.mova_dispositivos;
create policy "dispositivos: borrar los propios" on public.mova_dispositivos
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.mova_dispositivos from anon;
grant select, insert, update, delete on public.mova_dispositivos to authenticated;
