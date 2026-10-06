-- =====================================================================
-- Intranet Caminos · 002 · Archivos (Storage)
-- Buckets privados de comunicados y soportes. La primera carpeta de la
-- ruta es el id del registro dueño, así las reglas heredan sus permisos.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('comunicados', 'comunicados', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('soportes', 'soportes', false, 10485760,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'])
on conflict (id) do nothing;

-- '15/1730000000-1-foto.jpg' → 15
create function carpeta_id(ruta text) returns bigint
language sql immutable set search_path = public as $$
  select case when split_part(ruta, '/', 1) ~ '^[0-9]+$'
              then split_part(ruta, '/', 1)::bigint end
$$;

revoke all on function carpeta_id(text) from public, anon;
grant execute on function carpeta_id(text) to authenticated;

-- Comunicados: ver si se ve el comunicado; subir y borrar, autor o gerencia
create policy comunicados_ver on storage.objects for select to authenticated
  using (bucket_id = 'comunicados'
         and exists (select 1 from public.comunicados c where c.id = public.carpeta_id(name)));
create policy comunicados_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'comunicados'
              and exists (select 1 from public.comunicados c
                          where c.id = public.carpeta_id(name)
                            and (c.autor_id = auth.uid() or public.es_gerencia())));
create policy comunicados_quitar on storage.objects for delete to authenticated
  using (bucket_id = 'comunicados'
         and exists (select 1 from public.comunicados c
                     where c.id = public.carpeta_id(name)
                       and (c.autor_id = auth.uid() or public.es_gerencia())));

-- Soportes: ver si se ve la solicitud; subir, la dueña mientras está pendiente
create policy soportes_ver on storage.objects for select to authenticated
  using (bucket_id = 'soportes' and public.puede_ver_solicitud(public.carpeta_id(name)));
create policy soportes_subir on storage.objects for insert to authenticated
  with check (bucket_id = 'soportes'
              and exists (select 1 from public.solicitudes s
                          where s.id = public.carpeta_id(name)
                            and s.persona_id = auth.uid() and s.estado = 'pendiente'));
