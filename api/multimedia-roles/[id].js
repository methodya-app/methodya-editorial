import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireMultimediaCoordinator } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id } = req.query;

  if (req.method === 'PUT') {
    requireMultimediaCoordinator(auth);
    const allowed = ['nombre', 'subform_ids', 'activo'];
    const updates = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    const { data, error } = await admin
      .from('multimedia_roles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ multimedia_role: data });
  }

  if (req.method === 'DELETE') {
    requireMultimediaCoordinator(auth);
    const { error } = await admin.from('multimedia_roles').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
