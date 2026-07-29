import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, requireAdmin } from '../../_lib/auth.js';
import { getDb } from '../../_lib/mongo.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';

const ESTADOS_ORDEN = ['Asignado', 'En proceso', 'Finalizado', 'Eliminado'];

// Analítica del equipo multimedia de un proyecto: embudo por estado de las
// tareas liberadas (subform_assignments), qué tipos de subformulario se han
// liberado más, y carga por miembro del equipo. Solo Administrador.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  requireAdmin(auth);
  const { id: project_id } = req.query;
  const db = await getDb();
  const admin = supabaseAdmin();

  const assignments = await db.collection('subform_assignments').find({ project_id }).toArray();

  const funnelCounts = Object.fromEntries(ESTADOS_ORDEN.map((e) => [e, 0]));
  const bySubformCounts = {};
  for (const a of assignments) {
    if (funnelCounts[a.estado] !== undefined) funnelCounts[a.estado]++;
    const key = a.subform_nombre || 'Sin tipo';
    bySubformCounts[key] = (bySubformCounts[key] || 0) + 1;
  }
  const funnel = ESTADOS_ORDEN.map((estado) => ({ estado, count: funnelCounts[estado] }));
  const by_subform_type = Object.entries(bySubformCounts).map(([nombre, count]) => ({ nombre, count }));

  const { data: teamRows } = await admin
    .from('multimedia_project_users')
    .select('user_id, es_coordinador, multimedia_roles(nombre), profiles(nombre, apellido)')
    .eq('project_id', project_id);

  const workload = (teamRows || [])
    .filter((r) => !r.es_coordinador)
    .map((r) => {
      const asignados = assignments.filter((a) => a.assigned_user_id === r.user_id);
      const finalizados = asignados.filter((a) => a.estado === 'Finalizado');
      return {
        user_id: r.user_id,
        nombre: r.profiles ? `${r.profiles.nombre} ${r.profiles.apellido}` : '—',
        role: r.multimedia_roles?.nombre || '',
        asignados: asignados.length,
        finalizados: finalizados.length,
      };
    });

  return res.status(200).json({
    total: assignments.length,
    funnel,
    by_subform_type,
    workload,
  });
});
