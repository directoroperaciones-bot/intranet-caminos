// Edge Function «crear-cliente» · Extranet de clientes de Caminos
// Crea y maneja las cuentas de los clientes de AppSheet (aliados y parroquias).
// Se publica con "Verify JWT" activo. Solo la administración la puede usar.
//
// Acciones (POST, JSON):
//   { accion: 'crear', cliente_id, contrasena }      el correo sale de AppSheet (clientes_ext)
//   { accion: 'restablecer', cliente_id, contrasena } contraseña temporal nueva
//   { accion: 'desactivar' | 'reactivar', cliente_id }
// Respuesta: { ok: true, correo } o { error: '…' }

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return responder({ error: 'Falta la sesión.' }, 401);

  // Quien llama debe ser de la administración (lo decide la base)
  const comoUsuario = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const admin = await comoUsuario.rpc('es_admin');
  if (admin.error) return responder({ error: 'No se pudo verificar tu sesión.' }, 401);
  if (admin.data !== true) return responder({ error: 'Solo la administración maneja las cuentas de clientes.' }, 403);
  const yo = (await comoUsuario.auth.getUser(token)).data.user?.id ?? null;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return responder({ error: 'Datos inválidos.' }, 400); }
  const accion = String(body.accion ?? '');
  const clienteId = String(body.cliente_id ?? '').trim();
  if (!clienteId) return responder({ error: 'Falta el cliente.' }, 400);
  const claveValida = (c: unknown): c is string => typeof c === 'string' && c.length >= 8;

  const sb = createClient(url, servicio, { auth: { persistSession: false } });
  try {
    const cliente = await sb.from('clientes_ext').select('id, nombre, contacto, correo').eq('id', clienteId).maybeSingle();
    if (cliente.error || !cliente.data) return responder({ error: 'Ese cliente no está en AppSheet (hoja CLIENTES).' }, 404);
    const cuenta = await sb.from('cuentas_cliente').select('usuario_id, correo, activo').eq('cliente_id', clienteId).maybeSingle();

    if (accion === 'crear') {
      if (cuenta.data) return responder({ error: 'Este cliente ya tiene cuenta. Usa «Nueva contraseña».' }, 409);
      const correo = String(cliente.data.correo ?? '').trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) {
        return responder({ error: 'Este cliente no tiene un correo válido en AppSheet (hoja CLIENTES, columna Email). Agrégalo allá y actualiza los informes.' }, 400);
      }
      if (!claveValida(body.contrasena)) return responder({ error: 'La contraseña debe tener 8 caracteres o más.' }, 400);
      const nombre = String(cliente.data.contacto || cliente.data.nombre || '');
      const creado = await sb.auth.admin.createUser({
        email: correo, password: body.contrasena, email_confirm: true,
        user_metadata: { debe_cambiar_contrasena: true, nombre, extranet: true },
      });
      if (creado.error || !creado.data.user) {
        const msg = creado.error?.message ?? '';
        if (/already|registered|exists/i.test(msg)) return responder({ error: 'Ese correo ya tiene una cuenta (puede ser del equipo de Caminos). Usa otro correo en AppSheet.' }, 409);
        return responder({ error: 'No se pudo crear la cuenta: ' + msg }, 400);
      }
      // Nunca una cuenta de cliente con perfil del equipo
      const perfil = await sb.from('perfiles').select('id').eq('id', creado.data.user.id).maybeSingle();
      if (perfil.data) { await sb.auth.admin.deleteUser(creado.data.user.id); return responder({ error: 'Ese correo es del equipo.' }, 409); }
      const ins = await sb.from('cuentas_cliente').insert({ usuario_id: creado.data.user.id, cliente_id: clienteId, correo, creado_por: yo });
      if (ins.error) {
        await sb.auth.admin.deleteUser(creado.data.user.id);
        return responder({ error: 'No se pudo guardar la cuenta: ' + ins.error.message }, 400);
      }
      return responder({ ok: true, correo });
    }

    if (!cuenta.data) return responder({ error: 'Este cliente aún no tiene cuenta.' }, 404);
    const id = cuenta.data.usuario_id;

    if (accion === 'restablecer') {
      if (!claveValida(body.contrasena)) return responder({ error: 'La contraseña debe tener 8 caracteres o más.' }, 400);
      const r = await sb.auth.admin.updateUserById(id, { password: body.contrasena, user_metadata: { debe_cambiar_contrasena: true } });
      if (r.error) return responder({ error: 'No se pudo cambiar la contraseña: ' + r.error.message }, 400);
      await sb.from('cuentas_cliente').update({ debe_cambiar: true }).eq('usuario_id', id);
      return responder({ ok: true, correo: cuenta.data.correo });
    }

    if (accion === 'desactivar' || accion === 'reactivar') {
      const activo = accion === 'reactivar';
      const r = await sb.auth.admin.updateUserById(id, { ban_duration: activo ? 'none' : '876000h' });
      if (r.error) return responder({ error: 'No se pudo actualizar el acceso: ' + r.error.message }, 400);
      const u = await sb.from('cuentas_cliente').update({ activo }).eq('usuario_id', id);
      if (u.error) return responder({ error: 'No se pudo actualizar la cuenta: ' + u.error.message }, 400);
      return responder({ ok: true, correo: cuenta.data.correo });
    }

    return responder({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    return responder({ error: 'Error inesperado: ' + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
