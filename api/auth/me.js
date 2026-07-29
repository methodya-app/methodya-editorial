import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { data: projectRoles } = await admin
    .from('project_users')
    .select('project_id, role, projects(nombre, codigo, estado)')
    .eq('user_id', auth.profile.id);

  const { data: multimediaProjectRoles } = await admin
    .from('multimedia_project_users')
    .select('project_id, es_coordinador, multimedia_role_id, multimedia_roles(nombre), projects(nombre, codigo, estado)')
    .eq('user_id', auth.profile.id);

  const { data: implementacionProjectRoles } = await admin
    .from('implementacion_project_users')
    .select('project_id, role, projects(nombre, codigo, estado)')
    .eq('user_id', auth.profile.id);

  res.status(200).json({
    profile: auth.profile,
    is_admin: auth.isAdmin,
    project_roles: projectRoles || [],
    multimedia_project_roles: multimediaProjectRoles || [],
    is_multimedia_coordinator: auth.isAdmin || (multimediaProjectRoles || []).some((mr) => mr.es_coordinador),
    implementacion_project_roles: implementacionProjectRoles || [],
    is_implementacion_lider: auth.isAdmin || (implementacionProjectRoles || []).some((r) => r.role === 'lider'),
  });
});
