import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, isProjectImplementationLeader, hasImplementationRole } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';

function canManage(auth, projectId) {
  return isProjectImplementationLeader(auth, projectId);
}

function canView(auth, projectId) {
  return canManage(auth, projectId) || hasImplementationRole(auth, projectId);
}

// Equipo de Implementación de un proyecto: quién es "implementador" y quién
// es "lider" (2 roles fijos, sin catálogo — ver implementacion_project_users
// en db/supabase_schema.sql). Mismo patrón que multimedia-team.js.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id: project_id } = req.query;

  if (req.method === 'GET') {
    if (!canView(auth, project_id)) throw new ApiError(403, 'Sin acceso al equipo de implementación de este proyecto');
    const { data, error } = await admin
      .from('implementacion_project_users')
      .select('id, role, profiles(id, nombre, apellido, email)')
      .eq('project_id', project_id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ implementacion_project_users: data });
  }

  if (req.method === 'POST') {
    if (!canManage(auth, project_id)) {
      throw new ApiError(403, 'Requiere ser Administrador o Líder de implementación de este proyecto');
    }
    const { user_id, role } = req.body || {};
    if (!user_id) throw new ApiError(400, 'user_id es obligatorio');
    if (!['implementador', 'lider'].includes(role)) {
      throw new ApiError(400, 'role debe ser "implementador" o "lider"');
    }

    const { data, error } = await admin
      .from('implementacion_project_users')
      .insert({ project_id, user_id, role })
      .select('id, role, profiles(id, nombre, apellido, email)')
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json({ implementacion_project_user: data });
  }

  if (req.method === 'PUT') {
    if (!canManage(auth, project_id)) {
      throw new ApiError(403, 'Requiere ser Administrador o Líder de implementación de este proyecto');
    }
    const { implementacion_project_user_id, role } = req.body || {};
    if (!implementacion_project_user_id) throw new ApiError(400, 'implementacion_project_user_id es obligatorio');
    if (!['implementador', 'lider'].includes(role)) {
      throw new ApiError(400, 'role debe ser "implementador" o "lider"');
    }

    const { data, error } = await admin
      .from('implementacion_project_users')
      .update({ role })
      .eq('id', implementacion_project_user_id)
      .eq('project_id', project_id)
      .select('id, role, profiles(id, nombre, apellido, email)')
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ implementacion_project_user: data });
  }

  if (req.method === 'DELETE') {
    if (!canManage(auth, project_id)) {
      throw new ApiError(403, 'Requiere ser Administrador o Líder de implementación de este proyecto');
    }
    const { implementacion_project_user_id } = req.body || {};
    if (!implementacion_project_user_id) throw new ApiError(400, 'implementacion_project_user_id es obligatorio');
    const { error } = await admin
      .from('implementacion_project_users')
      .delete()
      .eq('id', implementacion_project_user_id);
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
