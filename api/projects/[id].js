import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin, roleInProject } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id } = req.query;

  if (req.method === 'GET') {
    const role = roleInProject(auth, id);
    if (!role) throw new ApiError(403, 'No tienes acceso a este proyecto');

    const { data, error } = await admin.from('projects').select('*').eq('id', id).single();
    if (error) throw new ApiError(404, 'Proyecto no encontrado');
    return res.status(200).json({ project: data, my_role: role });
  }

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const allowed = [
      'nombre',
      'fecha_inicio',
      'fecha_fin',
      'estado',
      'plantilla_tipo',
      'plantilla_url',
      'drive_folder_url',
      'plantilla_texto_simulado',
      'asignacion_creador',
      'asignacion_revisor_pedagogico',
      'asignacion_revisor_estilo',
      'criterio_carga',
      'vaciado_formato',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await admin
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ project: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
