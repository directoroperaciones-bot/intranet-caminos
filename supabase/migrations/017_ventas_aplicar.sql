-- =====================================================================
-- Intranet Caminos · 017 · Informes de gestión: carga desde el servidor
-- La carga del resumen de ventas pasa a aplicar_ventas(filas). La usan:
--   · sincronizar_ventas(clave, filas): el script de Google, con su clave.
--   · la tarea diaria de Claude, que entra a la base con la cuenta de
--     administración del proyecto (postgres). Nadie más puede llamarla.
-- =====================================================================

create function aplicar_ventas(p_filas jsonb) returns int
language plpgsql volatile set search_path = public as $$
declare n int;
begin
  if p_filas is null or jsonb_typeof(p_filas) <> 'array' then
    raise exception 'Se esperaba una lista de ventas.';
  end if;
  n := jsonb_array_length(p_filas);
  if n > 20000 then
    raise exception 'Demasiadas filas (%).', n;
  end if;

  insert into ventas_informe as v (id, asesora, fecha, estado, tipo_venta, tipo_viaje, destino, plan, salida, regreso,
                                   pasajeros, valor, costo, cobrado, pagado_prov, seguimiento, servicios, proveedores)
  select f.id, coalesce(f.asesora, ''), f.fecha, f.estado, coalesce(f.tipo_venta, ''), coalesce(f.tipo_viaje, ''),
         coalesce(f.destino, ''), coalesce(f.plan, ''), f.salida, f.regreso, coalesce(f.pasajeros, 0),
         coalesce(f.valor, 0), coalesce(f.costo, 0), coalesce(f.cobrado, 0), coalesce(f.pagado_prov, 0),
         coalesce(f.seguimiento, ''), coalesce(f.servicios, '[]'), coalesce(f.proveedores, '[]')
  from jsonb_to_recordset(p_filas) as f (id text, asesora text, fecha date, estado text, tipo_venta text, tipo_viaje text,
                                          destino text, plan text, salida date, regreso date, pasajeros int, valor numeric,
                                          costo numeric, cobrado numeric, pagado_prov numeric, seguimiento text,
                                          servicios jsonb, proveedores jsonb)
  on conflict (id) do update set
    asesora = excluded.asesora, fecha = excluded.fecha, estado = excluded.estado, tipo_venta = excluded.tipo_venta,
    tipo_viaje = excluded.tipo_viaje, destino = excluded.destino, plan = excluded.plan, salida = excluded.salida,
    regreso = excluded.regreso, pasajeros = excluded.pasajeros, valor = excluded.valor, costo = excluded.costo,
    cobrado = excluded.cobrado, pagado_prov = excluded.pagado_prov, seguimiento = excluded.seguimiento,
    servicios = excluded.servicios, proveedores = excluded.proveedores
  where (v.*) is distinct from (excluded.*);

  -- Lo que ya no está en la hoja, sale del informe
  delete from ventas_informe v
  where not exists (select 1 from jsonb_array_elements(p_filas) e where e ->> 'id' = v.id);

  update ventas_estado set sincronizado = now(), filas = n where id;
  return n;
end $$;
revoke all on function aplicar_ventas(jsonb) from public, anon, authenticated;
grant execute on function aplicar_ventas(jsonb) to service_role;

-- El script de Google: misma carga, con su clave
create or replace function sincronizar_ventas(p_clave text, p_filas jsonb) returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
begin
  if p_clave is null or not exists (
    select 1 from ventas_clave c where c.huella = encode(digest(p_clave, 'sha256'), 'hex')) then
    raise exception 'Clave de los informes no válida.' using errcode = '28000';
  end if;
  return aplicar_ventas(p_filas);
end $$;
