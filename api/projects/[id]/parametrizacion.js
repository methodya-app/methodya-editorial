import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, requireAdmin, roleInProject } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { validateParametrizacionShape } from '../../_lib/parametrizacion.js';

// Parametrización del proyecto: contexto/guía editorial y pedagógica (NO son
// reglas duras, eso es global_validations). Cualquiera con acceso al
// proyecto puede leerla; solo el Administrador puede editarla.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id } = req.query;

  if (req.method === 'GET') {
    if (!roleInProject(auth, id)) throw new ApiError(403, 'Sin acceso al proyecto');
    const { data, error } = await admin.from('projects').select('parametrizacion').eq('id', id).single();
    if (error) throw new ApiError(404, 'Proyecto no encontrado');
    return res.status(200).json({ parametrizacion: data.parametrizacion || {} });
  }

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const errors = validateParametrizacionShape(req.body);
    if (errors.length > 0) throw new ApiError(422, errors.join('; '));

    const { data: current, error: currentError } = await admin
      .from('projects')
      .select('parametrizacion')
      .eq('id', id)
      .single();
    if (currentError) throw new ApiError(404, 'Proyecto no encontrado');

    await admin.from('project_parametrizacion_historial').insert({
      project_id: id,
      snapshot: current.parametrizacion || {},
      actor_id: auth.profile.id,
    });

    const { data, error } = await admin
      .from('projects')
      .update({ parametrizacion: req.body || {}, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('parametrizacion')
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ parametrizacion: data.parametrizacion });
  }

  throw new ApiError(405, 'Método no permitido');
});
