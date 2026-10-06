// Edge Function «crear-usuario» · Intranet Caminos
// Única pieza que usa la llave de servicio. Se publica con "Verify JWT" activo.
//
// Acciones (POST, JSON):
//   { accion: 'crear', correo, nombre, sede_id, area_id, rol, contrasena }
//   { accion: 'restablecer', id, contrasena }
//   { accion: 'desactivar' | 'reactivar', id }
// Respuesta: { ok: true } o { error: '…' }
//
// Quien llama debe poder gestionar cuentas (administración o supervisor).
// Un supervisor solo crea y toca colaboradores sin administración, y nunca su propia cuenta.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLES = ['colaborador', 'supervisor', 'directora', 'gerente'];

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return responder({ error: 'Falta la sesión.' }, 401);

  // Cliente como el usuario que llama: sus permisos los decide la base.
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const [gestiona, admin, usuario] = await Promise.all([
    comoUsuario.rpc('puede_gestionar_cuentas'),
    comoUsuario.rpc('es_admin'),
    comoUsuario.auth.getUser(token),
  ]);
  if (gestiona.error || admin.error || usuario.error || !usuario.data.user) {
    return responder({ error: 'No se pudo verificar tu sesión.' }, 401);
  }
  if (gestiona.data !== true) {
    return responder({ error: 'No tienes permiso para administrar cuentas.' }, 403);
  }
  const esAdmin = admin.data === true;
  const yo = usuario.data.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return responder({ error: 'Datos inválidos.' }, 400);
  }

  const sb = createClient(url, servicio, { auth: { persistSession: false } });
  const accion = String(body.accion ?? '');

  // Un supervisor solo toca colaboradores sin administración, nunca su propia cuenta.
  async function puedeTocar(id: string): Promise<string | null> {
    if (!id) return 'Falta la persona.';
    if (id === yo) return 'No puedes cambiar tu propia cuenta desde aquí.';
    if (esAdmin) return null;
    const { data, error } = await sb.from('perfiles').select('rol, es_admin').eq('id', id).maybeSingle();
    if (error || !data) return 'No se encontró la persona.';
    if (data.rol !== 'colaborador' || data.es_admin) {
      return 'Solo la administración puede cambiar esta cuenta.';
    }
    return null;
  }

  function claveValida(c: unknown): c is string {
    return typeof c === 'string' && c.length >= 8;
  }

  try {
    if (accion === 'crear') {
      const correo = String(body.correo ?? '').trim().toLowerCase();
      const nombre = String(body.nombre ?? '').trim();
      const rol = String(body.rol ?? 'colaborador');
      const sede_id = Number(body.sede_id);
      const area_id = body.area_id == null || body.area_id === '' ? null : Number(body.area_id);
      const contrasena = body.contrasena;

      if (!correo.includes('@') || !nombre) return responder({ error: 'Escribe el nombre y un correo válido.' }, 400);
      if (!sede_id) return responder({ error: 'Elige la sede.' }, 400);
      if (!ROLES.includes(rol)) return responder({ error: 'Rol inválido.' }, 400);
      if (!esAdmin && rol !== 'colaborador') {
        return responder({ error: 'Las cuentas de supervisores, directoras y gerentes las crea la administración.' }, 403);
      }
      if (!claveValida(contrasena)) return responder({ error: 'La contraseña debe tener 8 caracteres o más.' }, 400);

      const creado = await sb.auth.admin.createUser({
        email: correo,
        password: contrasena,
        email_confirm: true,
        user_metadata: { debe_cambiar_contrasena: true, nombre },
      });
      if (creado.error || !creado.data.user) {
        const msg = creado.error?.message ?? '';
        if (/already|registered|exists/i.test(msg)) return responder({ error: 'Ya existe una cuenta con ese correo.' }, 409);
        return responder({ error: 'No se pudo crear la cuenta: ' + msg }, 400);
      }

      const perfil = await sb.from('perfiles').insert({
        id: creado.data.user.id, nombre, correo, sede_id, area_id, rol,
      });
      if (perfil.error) {
        await sb.auth.admin.deleteUser(creado.data.user.id);
        return responder({ error: 'No se pudo guardar el perfil: ' + perfil.error.message }, 400);
      }
      return responder({ ok: true, id: creado.data.user.id });
    }

    if (accion === 'restablecer') {
      const id = String(body.id ?? '');
      const no = await puedeTocar(id);
      if (no) return responder({ error: no }, 403);
      if (!claveValida(body.contrasena)) return responder({ error: 'La contraseña debe tener 8 caracteres o más.' }, 400);
      const { error } = await sb.auth.admin.updateUserById(id, {
        password: body.contrasena,
        user_metadata: { debe_cambiar_contrasena: true },
      });
      if (error) return responder({ error: 'No se pudo cambiar la contraseña: ' + error.message }, 400);
      return responder({ ok: true });
    }

    if (accion === 'desactivar' || accion === 'reactivar') {
      const id = String(body.id ?? '');
      const no = await puedeTocar(id);
      if (no) return responder({ error: no }, 403);
      const activo = accion === 'reactivar';
      const auth = await sb.auth.admin.updateUserById(id, { ban_duration: activo ? 'none' : '876000h' });
      if (auth.error) return responder({ error: 'No se pudo actualizar el acceso: ' + auth.error.message }, 400);
      const { error } = await sb.from('perfiles').update({ activo }).eq('id', id);
      if (error) return responder({ error: 'No se pudo actualizar el perfil: ' + error.message }, 400);
      return responder({ ok: true });
    }

    return responder({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    return responder({ error: 'Error inesperado: ' + (e instanceof Error ? e.message : String(e)) }, 500);
  }
});
