import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, isProjectMultimediaCoordinator } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';

// Modo de asignación (manual/carga/aleatoria) por rol multimedia, dentro de
// un proyecto. Mismo mecanismo que ya existe para Creador/Revisor
// (ver api/_lib/groupAssignment.js), generalizado a un catálogo dinámico de
// roles — por eso vive en una tabla aparte en vez de columnas fijas.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();
  const { id: project_id } = req.query;

  if (req.method === 'GET') {
    const { data: roles, error: rolesError } = await admin
      .from('multimedia_roles')
      .select('id, nombre')
      .order('nombre');
    if (rolesError) throw new ApiError(500, rolesError.message);

    const { data: config, error: configError } = await admin
      .from('multimedia_role_assignment_config')
      .select('multimedia_role_id, modo')
      .eq('project_id', project_id);
    if (configError) throw new ApiError(500, configError.message);

    const modoByRole = Object.fromEntries((config || []).map((c) => [c.multimedia_role_id, c.modo]));
    return res.status(200).json({
      roles: roles.map((r) => ({ ...r, modo: modoByRole[r.id] || 'manual' })),
    });
  }

  if (req.method === 'PUT') {
    if (!isProjectMultimediaCoordinator(auth, project_id)) {
      throw new ApiError(403, 'Requiere ser Administrador o Coordinador Multimedia de este proyecto');
    }
    const { multimedia_role_id, modo } = req.body || {};
    if (!multimedia_role_id || !['manual', 'carga', 'aleatoria'].includes(modo)) {
      throw new ApiError(400, 'multimedia_role_id y modo (manual/carga/aleatoria) son obligatorios');
    }
    const { error } = await admin
      .from('multimedia_role_assignment_config')
      .upsert({ project_id, multimedia_role_id, modo }, { onConflict: 'project_id,multimedia_role_id' });
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
