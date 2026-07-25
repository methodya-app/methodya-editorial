// Elige a alguien de `members` (array de user_id) al azar.
export function pickRandom(members) {
  return members[Math.floor(Math.random() * members.length)];
}

// Elige a quien tenga menos carga según `countsByUserId` (empate al azar).
// Pura y agnóstica de la fuente de datos: la usan tanto la asignación de
// documentos (Postgres, api/_lib/groupAssignment.js) como la de
// subformularios multimedia (Mongo, más abajo).
export function pickByMinLoad(members, countsByUserId) {
  const counts = members.map((m) => countsByUserId[m] || 0);
  const minCount = Math.min(...counts);
  const candidates = members.filter((m) => (countsByUserId[m] || 0) === minCount);
  return pickRandom(candidates);
}

// Decide si/a quién asignar automáticamente un subform_assignment recién
// liberado, según el modo configurado para ese rol en el proyecto
// (multimedia_role_assignment_config) y, en modo 'carga', el criterio de
// carga del proyecto (projects.criterio_carga).
export async function autoAssignSubform({ admin, db, projectId, multimediaRoleId, criterioCarga }) {
  const { data: config } = await admin
    .from('multimedia_role_assignment_config')
    .select('modo')
    .eq('project_id', projectId)
    .eq('multimedia_role_id', multimediaRoleId)
    .maybeSingle();
  const modo = config?.modo || 'manual';
  if (modo === 'manual') return null;

  const { data: members } = await admin
    .from('multimedia_project_users')
    .select('user_id')
    .eq('project_id', projectId)
    .eq('multimedia_role_id', multimediaRoleId);
  if (!members || members.length === 0) return null;
  const memberIds = members.map((m) => m.user_id);

  if (modo === 'aleatoria') return pickRandom(memberIds);

  // 'carga': cuenta cuántos subform_assignments tiene cada miembro en este
  // proyecto y rol (activos, o todo el histórico según criterioCarga).
  const query = { project_id: projectId, multimedia_role_id: multimediaRoleId, assigned_user_id: { $in: memberIds } };
  if (criterioCarga !== 'historico') query.estado = { $nin: ['Finalizado', 'Eliminado'] };
  const assignments = await db.collection('subform_assignments').find(query).project({ assigned_user_id: 1 }).toArray();
  const counts = {};
  for (const a of assignments) counts[a.assigned_user_id] = (counts[a.assigned_user_id] || 0) + 1;
  return pickByMinLoad(memberIds, counts);
}
