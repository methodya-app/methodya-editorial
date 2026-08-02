import { withCors, ApiError } from './_lib/cors.js';
import { requireAuth } from './_lib/auth.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// Autogestión del propio perfil. Por ahora solo la preferencia de correo de
// notificaciones (no existe hoy ninguna pantalla de "mi cuenta").
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);

  if (req.method === 'PUT') {
    const { email_notifications_enabled } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (email_notifications_enabled !== undefined) {
      updates.email_notifications_enabled = !!email_notifications_enabled;
    }

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', auth.profile.id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ profile: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
