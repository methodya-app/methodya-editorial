import { withCors, ApiError } from '../_lib/cors.js';
import { supabaseAdmin, supabaseAnon } from '../_lib/supabaseAdmin.js';

export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');

  const { email, password } = req.body || {};
  if (!email || !password) throw new ApiError(400, 'Correo y clave son obligatorios');

  const anon = supabaseAnon();
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data?.session) {
    throw new ApiError(401, 'Credenciales inválidas');
  }

  const admin = supabaseAdmin();
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError || !profile) throw new ApiError(401, 'Perfil de usuario no encontrado');
  if (!profile.activo) throw new ApiError(403, 'Usuario suspendido, contacta al administrador');

  const { data: projectRoles } = await admin
    .from('project_users')
    .select('project_id, role, projects(nombre, codigo, estado)')
    .eq('user_id', profile.id);

  const { data: multimediaProjectRoles } = await admin
    .from('multimedia_project_users')
    .select('project_id, es_coordinador, multimedia_role_id, multimedia_roles(nombre), projects(nombre, codigo, estado)')
    .eq('user_id', profile.id);

  res.status(200).json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    profile,
    project_roles: projectRoles || [],
    multimedia_project_roles: multimediaProjectRoles || [],
    is_multimedia_coordinator: !!profile.is_admin || (multimediaProjectRoles || []).some((mr) => mr.es_coordinador),
  });
});
