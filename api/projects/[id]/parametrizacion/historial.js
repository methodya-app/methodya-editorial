import { withCors, ApiError } from '../../../_lib/cors.js';
import { requireAuth, roleInProject } from '../../../_lib/auth.js';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin.js';

// Historial de cambios de la parametrización del proyecto (últimas 20),
// mismo criterio de acceso que la lectura de la parametrización actual.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const { id } = req.query;
  if (!roleInProject(auth, id)) throw new ApiError(403, 'Sin acceso al proyecto');

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('project_parametrizacion_historial')
    .select('id, snapshot, created_at, actor:actor_id(nombre, apellido)')
    .eq('project_id', id)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new ApiError(500, error.message);

  return res.status(200).json({ historial: data });
});
