import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await admin.from('dotacion_tipos').select('*').eq('id', id).single();
    if (error) throw new ApiError(404, 'Tipo de dotación no encontrado');
    return res.status(200).json({ dotacion_tipo: data });
  }

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const { nombre, descripcion } = req.body || {};
    const updates = {};
    if (nombre !== undefined) {
      if (!nombre.trim()) throw new ApiError(400, 'nombre no puede quedar vacío');
      updates.nombre = nombre.trim();
    }
    if (descripcion !== undefined) updates.descripcion = descripcion || null;

    const { data, error } = await admin.from('dotacion_tipos').update(updates).eq('id', id).select().single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ dotacion_tipo: data });
  }

  if (req.method === 'DELETE') {
    requireAdmin(auth);
    // Eliminación lógica: deja de listarse/ofrecerse (y con ello, sus
    // referencias), pero los proyectos que ya las referencian conservan el id.
    const { error } = await admin.from('dotacion_tipos').update({ activo: false }).eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
