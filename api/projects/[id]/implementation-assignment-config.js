import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, isProjectImplementationLeader } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';

// Modo de asignación (manual/carga/aleatoria) del rol "implementador" en un
// proyecto. A diferencia de multimedia-assignment-config.js (un modo por
// rol de un catálogo dinámico), acá es una sola fila por proyecto: solo
// "implementador" recibe trabajo auto-asignable, "lider" no.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id: project_id } = req.query;

  if (req.method === 'GET') {
    const { data: config, error } = await admin
      .from('implementacion_assignment_config')
      .select('modo')
      .eq('project_id', project_id)
      .maybeSingle();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ modo: config?.modo || 'manual' });
  }

  if (req.method === 'PUT') {
    if (!isProjectImplementationLeader(auth, project_id)) {
      throw new ApiError(403, 'Requiere ser Administrador o Líder de implementación de este proyecto');
    }
    const { modo } = req.body || {};
    if (!['manual', 'carga', 'aleatoria'].includes(modo)) {
      throw new ApiError(400, 'modo (manual/carga/aleatoria) es obligatorio');
    }
    const { error } = await admin
      .from('implementacion_assignment_config')
      .upsert({ project_id, modo }, { onConflict: 'project_id' });
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
