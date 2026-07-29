import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, requireAdmin } from '../../_lib/auth.js';
import { getDb } from '../../_lib/mongo.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';

const ESTADOS_ORDEN = ['Pendiente', 'En proceso', 'Detenido', 'Implementado'];

// Analítica del área de Implementación de un proyecto: embudo por estado de
// los documentos liberados (document_implementations) y carga por
// Implementador. Solo Administrador.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  const auth = await requireAuth(req);
  requireAdmin(auth);
  const { id: project_id } = req.query;
  const db = await getDb();
  const admin = supabaseAdmin();

  const implementations = await db.collection('document_implementations').find({ project_id }).toArray();

  const funnelCounts = Object.fromEntries(ESTADOS_ORDEN.map((e) => [e, 0]));
  for (const i of implementations) {
    if (funnelCounts[i.estado] !== undefined) funnelCounts[i.estado]++;
  }
  const funnel = ESTADOS_ORDEN.map((estado) => ({ estado, count: funnelCounts[estado] }));

  const { data: teamRows } = await admin
    .from('implementacion_project_users')
    .select('user_id, profiles(nombre, apellido)')
    .eq('project_id', project_id)
    .eq('role', 'implementador');

  const workload = (teamRows || []).map((r) => {
    const asignados = implementations.filter((i) => i.assigned_user_id === r.user_id);
    const implementados = asignados.filter((i) => i.estado === 'Implementado');
    return {
      user_id: r.user_id,
      nombre: r.profiles ? `${r.profiles.nombre} ${r.profiles.apellido}` : '—',
      asignados: asignados.length,
      implementados: implementados.length,
    };
  });

  return res.status(200).json({
    total: implementations.length,
    funnel,
    workload,
  });
});
