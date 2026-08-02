import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { sendEmail } from '../_lib/email.js';

// Permite al Administrador validar la configuración de correo (Gmail SMTP o
// Resend) desde Parámetros del servidor, sin depender de que ocurra un
// comentario o asignación real primero.
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  requireAdmin(auth);

  const to = auth.profile.email;
  if (!to) throw new ApiError(400, 'Tu usuario no tiene correo registrado');

  const result = await sendEmail({
    to,
    subject: 'METHODYA — correo de prueba',
    html: '<p>Este es un correo de prueba de configuración de notificaciones de METHODYA.</p>',
  });

  if (!result.ok) throw new ApiError(400, result.error || 'No se pudo enviar el correo');
  return res.status(200).json({ ok: true, sent_to: to });
});
