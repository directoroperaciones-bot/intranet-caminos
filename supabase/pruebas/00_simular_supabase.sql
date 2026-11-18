-- =====================================================================
-- Simula lo mínimo de Supabase en un Postgres local para probar permisos.
-- Roles anon/authenticated/service_role, auth.users + auth.uid(),
-- storage.buckets + storage.objects (con RLS).
--
-- Limitación: aquí los roles reciben permisos por defecto amplios, así que
-- esto NO detecta permisos faltantes de service_role. Crear una cuenta
-- real en el Supabase de Caminos es parte obligatoria de la prueba final.
-- =====================================================================

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}',
  banned_until timestamptz,
  created_at timestamptz not null default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant select on auth.users to service_role;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text not null,
  owner uuid default auth.uid(),
  created_at timestamptz not null default now()
);
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
grant select on storage.buckets to authenticated, service_role;

-- pg_net simulado: guarda los pedidos en vez de llamar a internet
create schema net;
create table net.pedidos (id bigserial primary key, url text, body jsonb, headers jsonb, creado timestamptz default now());
create table net._http_response (id bigint primary key, status_code int, content text, error_msg text, created timestamptz default now());
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
returns bigint language sql as $$ insert into net.pedidos (url, body, headers) values (url, body, headers) returning id $$;

-- Vault simulado (en Supabase cifra los secretos)
create schema vault;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text default '');
create function vault.create_secret(new_secret text, new_name text default null, new_description text default '', new_key_id uuid default null)
returns uuid language sql as $$ insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id $$;
create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null, new_description text default null, new_key_id uuid default null)
returns void language sql as $$ update vault.secrets set secret = coalesce(new_secret, secret) where id = secret_id $$;
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
