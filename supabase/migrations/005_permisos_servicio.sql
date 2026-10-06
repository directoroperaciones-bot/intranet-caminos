-- =====================================================================
-- Intranet Caminos · 005 · Permisos del rol de servicio
-- Con la exposición automática apagada, service_role (que usa la Edge
-- Function crear-usuario) también necesita permisos explícitos. Sin esto,
-- crear cuentas falla con "permission denied for table perfiles".
-- =====================================================================

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
