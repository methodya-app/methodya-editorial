import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id } = req.query;

  if (req.method === 'GET') {
    const { data, error } = await admin.from('poblaciones_objetivo').select('*').eq('id', id).single();
    if (error) throw new ApiError(404, 'Población objetivo no encontrada');
    return res.status(200).json({ poblacion_objetivo: data });
  }

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const {
      nombre,
      edad_min,
      edad_max,
      nivel_lector,
      desarrollo_cognitivo,
      pensamiento_logico_steam,
      socioemocional_comunicacion,
    } = req.body || {};

    const updates = { updated_at: new Date().toISOString() };
    if (nombre !== undefined) {
      if (!nombre.trim()) throw new ApiError(400, 'nombre no puede quedar vacío');
      updates.nombre = nombre.trim();
    }
    if (edad_min !== undefined) {
      if (isNaN(Number(edad_min))) throw new ApiError(400, 'edad_min debe ser numérica');
      updates.edad_min = Number(edad_min);
    }
    if (edad_max !== undefined) {
      if (isNaN(Number(edad_max))) throw new ApiError(400, 'edad_max debe ser numérica');
      updates.edad_max = Number(edad_max);
    }
    if (
      updates.edad_min !== undefined &&
      updates.edad_max !== undefined &&
      updates.edad_min > updates.edad_max
    ) {
      throw new ApiError(400, 'edad_min no puede ser mayor que edad_max');
    }
    if (nivel_lector !== undefined) {
      if (!nivel_lector.trim()) throw new ApiError(400, 'nivel_lector no puede quedar vacío');
      updates.nivel_lector = nivel_lector;
    }
    if (desarrollo_cognitivo !== undefined) updates.desarrollo_cognitivo = desarrollo_cognitivo || null;
    if (pensamiento_logico_steam !== undefined) updates.pensamiento_logico_steam = pensamiento_logico_steam || null;
    if (socioemocional_comunicacion !== undefined) {
      updates.socioemocional_comunicacion = socioemocional_comunicacion || null;
    }

    const { data, error } = await admin
      .from('poblaciones_objetivo')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ poblacion_objetivo: data });
  }

  if (req.method === 'DELETE') {
    requireAdmin(auth);
    // Eliminación lógica: deja de listarse/ofrecerse, pero los proyectos que
    // ya la referencian conservan el id (se muestra como "no disponible").
    const { error } = await admin.from('poblaciones_objetivo').update({ activo: false }).eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
