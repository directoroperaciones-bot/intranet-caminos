-- =====================================================================
-- 024 · Informe de la conciliación de la tarjeta por correo
--
-- En la pestaña Tarjeta, la gerencia toca «Enviar informe por correo» y la
-- Edge Function `enviar-informe-tarjeta` manda el informe del extracto
-- (resumen, gasto por categoría, alertas y el CSV para Excel) a los
-- destinatarios fijos de finanzas y dirección. Los destinatarios están en la
-- función, no los elige el navegador.
--
-- Esta tabla guarda cada envío: quién, cuándo, a quién y si salió. Solo la
-- gerencia la lee; solo el servidor (service_role) escribe en ella.
-- =====================================================================

create table tc_envios (
  id bigint generated always as identity primary key,
  extracto_id bigint not null references tc_extractos (id) on delete cascade,
  enviado_por uuid references perfiles (id) on delete set null,
  enviado_en timestamptz not null default now(),
  destinatarios text[] not null check (cardinality(destinatarios) between 1 and 10),
  asunto text not null check (char_length(asunto) between 1 and 200),
  nota text not null default '' check (char_length(nota) <= 1000),
  estado_extracto text not null check (estado_extracto in ('abierto', 'cerrado')),
  avance smallint not null default 0 check (avance between 0 and 100),
  ok boolean not null default true,
  error text check (error is null or char_length(error) <= 500)
);
create index tc_envios_extracto_idx on tc_envios (extracto_id, enviado_en desc);

alter table tc_envios enable row level security;
create policy tc_envios_ver on tc_envios for select to authenticated using (es_gerencia());

revoke all on tc_envios from anon, authenticated;
grant select on tc_envios to authenticated;
grant all on tc_envios to service_role;
