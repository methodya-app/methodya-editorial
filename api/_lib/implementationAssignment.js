import { pickRandom, pickByMinLoad } from './multimediaAssignment.js';

// Decide si/a quién asignar automáticamente un document_implementations
// recién liberado, según el modo configurado para el proyecto
// (implementacion_assignment_config, una sola fila por proyecto — solo el
// rol "implementador" recibe trabajo asignable) y, en modo 'carga', el
// criterio de carga del proyecto (projects.criterio_carga). Mismo mecanismo
// que autoAssignSubform (api/_lib/multimediaAssignment.js), adaptado a que
// acá el trabajo es por documento completo, no por instancia.
export async function autoAssignImplementation({ admin, db, projectId, criterioCarga }) {
  const { data: config } = await admin
    .from('implementacion_assignment_config')
    .select('modo')
    .eq('project_id', projectId)
    .maybeSingle();
  const modo = config?.modo || 'manual';
  if (modo === 'manual') return null;

  const { data: members } = await admin
    .from('implementacion_project_users')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('role', 'implementador');
  if (!members || members.length === 0) return null;
  const memberIds = members.map((m) => m.user_id);

  if (modo === 'aleatoria') return pickRandom(memberIds);

  // 'carga': cuenta cuántos document_implementations tiene cada miembro en
  // este proyecto (activos, o todo el histórico según criterioCarga).
  const query = { project_id: projectId, assigned_user_id: { $in: memberIds } };
  if (criterioCarga !== 'historico') query.estado = { $ne: 'Implementado' };
  const assignments = await db
    .collection('document_implementations')
    .find(query)
    .project({ assigned_user_id: 1 })
    .toArray();
  const counts = {};
  for (const a of assignments) counts[a.assigned_user_id] = (counts[a.assigned_user_id] || 0) + 1;
  return pickByMinLoad(memberIds, counts);
}
