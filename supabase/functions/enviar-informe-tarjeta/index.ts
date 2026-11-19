// Edge Function «enviar-informe-tarjeta» · Intranet Caminos
// Envía por correo el informe de la conciliación de la tarjeta de crédito.
// Se publica con "Verify JWT" activo.
//
// POST, JSON:
//   { extracto_id, asunto, html, texto, csv, csv_nombre, nota }
// Respuesta: { ok: true, destinatarios: [...] } o { error: '…' }
//
// - Solo la gerencia (es_gerencia) puede enviarlo.
// - Los destinatarios son FIJOS (abajo): el navegador no los puede cambiar.
// - El informe lo arma la intranet (es la misma vista previa que ve quien
//   envía); aquí se valida el tamaño, se adjunta el CSV y se registra el
//   envío en tc_envios, salga bien o mal.
// - Un mismo extracto no se reenvía antes de 1 minuto (evita el doble clic).
//
// Secretos (Edge Functions → Secrets):
//   SMTP_USUARIO   cuenta de Google Workspace que envía (ej. intranet@agenciacaminos.com.co)
//   SMTP_CLAVE     contraseña de aplicación de esa cuenta (16 letras)
//   SMTP_REMITENTE opcional, ej. «Intranet Caminos <intranet@agenciacaminos.com.co>»
//   SMTP_SERVIDOR  opcional (smtp.gmail.com) · SMTP_PUERTO opcional (465)
// Supabase bloquea los puertos 25 y 587: se usa 465 (SSL).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

const DESTINATARIOS = [
  { nombre: 'Yenny Huerfano', correo: 'financiero@agenciacaminos.com.co' },
  { nombre: 'Jhon Guataquira', correo: 'director@agenciacaminos.com.co' },
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_HTML = 600_000; // caracteres
const MAX_CSV = 2_000_000;

function responder(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}
const texto = (v: unknown, max: number) => String(v ?? '').slice(0, max);
// Nombre de archivo seguro para el adjunto
const nombreArchivo = (v: unknown) =>
  (String(v ?? '').replace(/[^\w.\-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'conciliacion') +
  (/\.csv$/i.test(String(v ?? '')) ? '' : '.csv');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return responder({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const smtpUsuario = Deno.env.get('SMTP_USUARIO');
  const smtpClave = Deno.env.get('SMTP_CLAVE');
  if (!smtpUsuario || !smtpClave) {
    return responder({ error: 'El correo de salida aún no está configurado (SMTP_USUARIO y SMTP_CLAVE).' }, 503);
  }

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return responder({ error: 'Falta la sesión.' }, 401);

  // Permisos como el usuario que llama: los decide la base.
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const [gerencia, usuario] = await Promise.all([comoUsuario.rpc('es_gerencia'), comoUsuario.auth.getUser(token)]);
  if (gerencia.error || usuario.error || !usuario.data.user) {
    return responder({ error: 'No se pudo verificar tu sesión.' }, 401);
  }
  if (gerencia.data !== true) return responder({ error: 'Solo la gerencia envía el informe de la tarjeta.' }, 403);
  const yo = usuario.data.user.id;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return responder({ error: 'Datos inválidos.' }, 400);
  }
  const extractoId = Number(body.extracto_id);
  const asunto = texto(body.asunto, 200).trim();
  const html = String(body.html ?? '');
  const plano = texto(body.texto, 50_000);
  const csv = String(body.csv ?? '');
  const nota = texto(body.nota, 1000).trim();
  if (!Number.isInteger(extractoId) || extractoId <= 0) return responder({ error: 'Falta el extracto.' }, 400);
  if (!asunto || !html) return responder({ error: 'El informe está vacío.' }, 400);
  if (html.length > MAX_HTML || csv.length > MAX_CSV) return responder({ error: 'El informe es demasiado grande para enviarlo por correo.' }, 413);

  const sb = createClient(url, servicio, { auth: { persistSession: false } });
  const { data: ext, error: eExt } = await sb.from('tc_extractos').select('id, estado').eq('id', extractoId).maybeSingle();
  if (eExt || !ext) return responder({ error: 'Ese extracto no existe.' }, 404);

  const { data: ultimo } = await sb.from('tc_envios').select('enviado_en').eq('extracto_id', extractoId).eq('ok', true)
    .order('enviado_en', { ascending: false }).limit(1).maybeSingle();
  if (ultimo && Date.now() - Date.parse(ultimo.enviado_en) < 60_000) {
    return responder({ error: 'Este informe se acaba de enviar. Espera un minuto para reenviarlo.' }, 429);
  }

  const [{ data: yoPerfil }, avance] = await Promise.all([
    sb.from('perfiles').select('nombre, correo').eq('id', yo).maybeSingle(),
    sb.from('tc_movimientos').select('estado').eq('extracto_id', extractoId),
  ]);
  const movs = avance.data ?? [];
  const pct = movs.length ? Math.round((movs.filter((m) => m.estado !== 'pendiente').length / movs.length) * 100) : 0;

  const transporte = nodemailer.createTransport({
    host: Deno.env.get('SMTP_SERVIDOR') || 'smtp.gmail.com',
    port: Number(Deno.env.get('SMTP_PUERTO') || 465),
    secure: true,
    auth: { user: smtpUsuario, pass: smtpClave },
  });

  let error: string | null = null;
  try {
    await transporte.sendMail({
      from: Deno.env.get('SMTP_REMITENTE') || `Intranet Caminos <${smtpUsuario}>`,
      to: DESTINATARIOS.map((d) => `${d.nombre} <${d.correo}>`).join(', '),
      replyTo: yoPerfil?.correo ? `${yoPerfil.nombre} <${yoPerfil.correo}>` : undefined,
      subject: asunto,
      html,
      text: plano || undefined,
      attachments: csv ? [{ filename: nombreArchivo(body.csv_nombre), content: csv, contentType: 'text/csv; charset=utf-8' }] : [],
    });
  } catch (e) {
    error = String((e as Error)?.message || e).slice(0, 500);
  }

  await sb.from('tc_envios').insert({
    extracto_id: extractoId,
    enviado_por: yo,
    destinatarios: DESTINATARIOS.map((d) => d.correo),
    asunto,
    nota,
    estado_extracto: ext.estado,
    avance: pct,
    ok: !error,
    error,
  });

  if (error) return responder({ error: 'El servidor de correo no aceptó el envío. Revisa SMTP_USUARIO y SMTP_CLAVE.' }, 502);
  return responder({ ok: true, destinatarios: DESTINATARIOS });
});
