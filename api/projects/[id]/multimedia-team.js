import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, isProjectMultimediaCoordinator, multimediaRolesInProject } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';

function canManage(auth, projectId) {
  return isProjectMultimediaCoordinator(auth, projectId);
}

function canView(auth, projectId) {
  return canManage(auth, projectId) || multimediaRolesInProject(auth, projectId).length > 0;
}

// Equipo multimedia de un proyecto: quién tiene cada rol multimedia, y quién
// es el Coordinador Multimedia de ese proyecto. Lo administran el
// Administrador y el Coordinador Multimedia de ESE proyecto.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id: project_id } = req.query;

  if (req.method === 'GET') {
    if (!canView(auth, project_id)) throw new ApiError(403, 'Sin acceso al equipo multimedia de este proyecto');
    const { data, error } = await admin
      .from('multimedia_project_users')
      .select('id, es_coordinador, multimedia_role_id, profiles(id, nombre, apellido, email), multimedia_roles(id, nombre)')
      .eq('project_id', project_id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ multimedia_project_users: data });
  }

  if (req.method === 'POST') {
    if (!canManage(auth, project_id)) throw new ApiError(403, 'Requiere ser Administrador o Coordinador Multimedia de este proyecto');
    const { user_id, multimedia_role_id, es_coordinador } = req.body || {};
    if (!user_id) throw new ApiError(400, 'user_id es obligatorio');
    if (!es_coordinador && !multimedia_role_id) {
      throw new ApiError(400, 'multimedia_role_id es obligatorio (o marcar es_coordinador)');
    }

    const { data, error } = await admin
      .from('multimedia_project_users')
      .insert({
        project_id,
        user_id,
        es_coordinador: !!es_coordinador,
        multimedia_role_id: es_coordinador ? null : multimedia_role_id,
      })
      .select('id, es_coordinador, multimedia_role_id, profiles(id, nombre, apellido, email), multimedia_roles(id, nombre)')
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json({ multimedia_project_user: data });
  }

  if (req.method === 'DELETE') {
    if (!canManage(auth, project_id)) throw new ApiError(403, 'Requiere ser Administrador o Coordinador Multimedia de este proyecto');
    const { multimedia_project_user_id } = req.body || {};
    if (!multimedia_project_user_id) throw new ApiError(400, 'multimedia_project_user_id es obligatorio');
    const { error } = await admin.from('multimedia_project_users').delete().eq('id', multimedia_project_user_id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
