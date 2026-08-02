import { notifyAssignment } from './notifications.js';

// Cuando un documento entra sin asignar a la etapa de un rol, este módulo
// decide qué hacer según la configuración del proyecto para ese rol:
//  - 'manual': no hace nada, queda disponible para que alguien lo tome
//    (ver api/documents/[id]/claim.js).
//  - 'aleatoria': asigna al azar entre los miembros del proyecto con ese rol.
//  - 'carga': asigna a quien tenga menos documentos (activos o históricos,
//    según project.criterio_carga) en ese rol dentro del proyecto.
export const STAGE_ROLE = [
  {
    estados: ['Pendiente', 'En proceso', 'Devuelto'],
    field: 'creador_id',
    role: 'Creador Experto',
    configKey: 'asignacion_creador',
  },
  {
    estados: ['Revisión Pedagógica'],
    field: 'revisor_pedagogico_id',
    role: 'Revisor Pedagógico',
    configKey: 'asignacion_revisor_pedagogico',
  },
  {
    estados: ['Revisión Estilo'],
    field: 'revisor_estilo_id',
    role: 'Revisor de Estilo',
    configKey: 'asignacion_revisor_estilo',
  },
];

export function stageRoleForEstado(estado) {
  return STAGE_ROLE.find((s) => s.estados.includes(estado)) || null;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Intenta asignar automáticamente `document[field]` si está en null y el
// modo configurado para ese rol no es 'manual'. No lanza errores: si no hay
// nadie con el rol en el proyecto, simplemente deja el documento sin asignar.
// `actorId` (opcional) es quién disparó la transición que llevó a esto —
// solo se usa para la notificación (evita auto-notificarse); si no se pasa
// (ej. lo dispara el worker de generación por IA, sin usuario humano detrás)
// simplemente no hay a quién excluir.
export async function autoAssignIfNeeded(admin, document, project, actorId) {
  const match = stageRoleForEstado(document.estado);
  if (!match) return;
  if (document[match.field]) return; // ya tiene a alguien asignado

  const mode = project?.[match.configKey] || 'manual';
  if (mode === 'manual') return;

  const { data: members } = await admin
    .from('project_users')
    .select('user_id')
    .eq('project_id', document.project_id)
    .eq('role', match.role);
  if (!members || members.length === 0) return; // nadie a quien asignar

  let chosenUserId;
  if (mode === 'aleatoria') {
    chosenUserId = pickRandom(members).user_id;
  } else {
    // 'carga': cuenta cuántos documentos tiene asignados cada miembro en
    // ese campo dentro del proyecto, y elige al de menor carga.
    let query = admin
      .from('documents')
      .select(match.field)
      .eq('project_id', document.project_id)
      .not(match.field, 'is', null);
    if (project?.criterio_carga !== 'historico') {
      query = query.not('estado', 'in', '(Finalizado,Eliminado)');
    }
    const { data: allDocs } = await query;
    const counts = Object.fromEntries(members.map((m) => [m.user_id, 0]));
    for (const d of allDocs || []) {
      if (counts[d[match.field]] !== undefined) counts[d[match.field]]++;
    }
    const minCount = Math.min(...members.map((m) => counts[m.user_id]));
    const candidates = members.filter((m) => counts[m.user_id] === minCount);
    chosenUserId = pickRandom(candidates).user_id;
  }

  await admin.from('documents').update({ [match.field]: chosenUserId }).eq('id', document.id);

  await notifyAssignment({
    admin,
    userId: chosenUserId,
    actorId,
    roleLabel: match.role,
    codigo: document.codigo,
    link: `/documentos/${document.id}`,
    sourceType: 'document',
    sourceId: document.id,
  });
}
