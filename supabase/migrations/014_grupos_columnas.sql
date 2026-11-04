-- =====================================================================
-- Intranet Caminos · 014 · Siete columnas en el tablero de Grupos
-- Las cinco etapas se renombran en la pantalla y se agregan dos nuevas,
-- sin mover ningún grupo:
--   cotizando     → Cotización / costeo
--   propuesta     → Propuesta comercial                       (nueva)
--   confirmado    → Aprobado parroquia
--   gestion       → Gestión comercial, bloqueos, lanzamiento  (nueva)
--   documentacion → Ejecución grupo
--   en_viaje      → En destino
--   finalizado    → Finalizado
-- =====================================================================

alter type grupo_estado_t add value if not exists 'propuesta' after 'cotizando';
alter type grupo_estado_t add value if not exists 'gestion' after 'confirmado';
