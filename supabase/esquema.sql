-- Mova en Supabase. Pegar completo en SQL Editor > New query > Run.

-- 1. BORRA LA APP BODEGA de este proyecto: tablas, datos y funciones.
--    No se puede deshacer. Hay copia en Documents\Bodega_App\copia-supabase-2026-11-01.
drop function if exists public.register_movement(text, text, integer, text, text);
drop function if exists public.create_loan(text, text, integer, date);
drop function if exists public.return_loan(text);
drop table if exists public.loans cascade;
drop table if exists public.movements cascade;
drop table if exists public.products cascade;
drop table if exists public.categories cascade;

-- 2. Mova: un documento por usuario, con el mismo formato de los respaldos.
--    `version` evita que dos dispositivos se pisen: solo se escribe sobre la versión que se leyó.
create table if not exists public.mova_datos (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  contenido jsonb not null,
  version bigint not null default 1,
  actualizado timestamptz not null default now()
);

-- 3. Cada usuario solo puede ver y cambiar su propia fila.
alter table public.mova_datos enable row level security;

drop policy if exists "mova: leer lo propio" on public.mova_datos;
create policy "mova: leer lo propio" on public.mova_datos
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "mova: crear lo propio" on public.mova_datos;
create policy "mova: crear lo propio" on public.mova_datos
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "mova: cambiar lo propio" on public.mova_datos;
create policy "mova: cambiar lo propio" on public.mova_datos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "mova: borrar lo propio" on public.mova_datos;
create policy "mova: borrar lo propio" on public.mova_datos
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.mova_datos from anon;
grant select, insert, update, delete on public.mova_datos to authenticated;
