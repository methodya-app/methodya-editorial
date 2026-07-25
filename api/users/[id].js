import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  requireAdmin(auth);
  const admin = supabaseAdmin();
  const { id } = req.query;

  if (req.method === 'PUT') {
    const { nombre, apellido, email, is_admin, activo, eliminado, password } = req.body || {};
    const updates = {};
    if (nombre !== undefined) updates.nombre = nombre;
    if (apellido !== undefined) updates.apellido = apellido;
    if (email !== undefined) updates.email = email;
    if (is_admin !== undefined) updates.is_admin = is_admin;
    if (activo !== undefined) updates.activo = activo;
    if (eliminado !== undefined) updates.eliminado = eliminado;
    updates.updated_at = new Date().toISOString();

    if (email !== undefined) {
      const { error: emailError } = await admin.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (emailError) throw new ApiError(400, emailError.message);
    }
    if (password) {
      const { error: pwError } = await admin.auth.admin.updateUserById(id, { password });
      if (pwError) throw new ApiError(400, pwError.message);
    }

    const { data, error } = await admin
      .from('profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ user: data });
  }

  if (req.method === 'DELETE') {
    // Eliminación lógica: inactiva (no puede iniciar sesión) y lo envía a la
    // papelera (desaparece del listado principal hasta que se restaure).
    const { data, error } = await admin
      .from('profiles')
      .update({ activo: false, eliminado: true })
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ user: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
