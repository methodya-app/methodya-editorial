import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await admin.from('dotacion_referencias').select('*').eq('id', id).single();
    if (error) throw new ApiError(404, 'Referencia de dotación no encontrada');
    return res.status(200).json({ dotacion_referencia: data });
  }

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const { referencia, nombre, descripcion, especificaciones, resumen, fuente } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (referencia !== undefined) {
      if (!referencia.trim()) throw new ApiError(400, 'referencia no puede quedar vacía');
      updates.referencia = referencia.trim();
    }
    if (nombre !== undefined) {
      if (!nombre.trim()) throw new ApiError(400, 'nombre no puede quedar vacío');
      updates.nombre = nombre.trim();
    }
    if (descripcion !== undefined) updates.descripcion = descripcion || null;
    if (especificaciones !== undefined) {
      updates.especificaciones = especificaciones && typeof especificaciones === 'object' ? especificaciones : {};
    }
    if (resumen !== undefined) updates.resumen = resumen || null;
    if (fuente !== undefined) updates.fuente = fuente === 'ia_archivo' ? 'ia_archivo' : 'manual';

    const { data, error } = await admin
      .from('dotacion_referencias')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ dotacion_referencia: data });
  }

  if (req.method === 'DELETE') {
    requireAdmin(auth);
    const { error } = await admin.from('dotacion_referencias').update({ activo: false }).eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
