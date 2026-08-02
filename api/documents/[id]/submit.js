import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { loadDocumentWithAccess } from '../../_lib/documentAccess.js';
import { autoAssignIfNeeded } from '../../_lib/groupAssignment.js';

// Matriz de transiciones válidas por acción, según el documento de la beta:
//  - Creador Experto: [enviar a revisión pedagógica]
//  - Revisor Pedagógico: [enviar a revisión estilo] | [devolver al creador]
//  - Revisor de Estilo: [enviar a revisión pedagógica] | [devolver al creador]
//  - Administrador: puede forzar cualquier estado válido (usa PUT /api/documents/:id)
const ACTIONS = {
  send_to_pedagogica: {
    from: ['Pendiente', 'En proceso', 'Devuelto'],
    to: 'Revisión Pedagógica',
    allowedRole: 'isCreador',
  },
  send_to_estilo: {
    from: ['Revisión Pedagógica'],
    to: 'Revisión Estilo',
    allowedRole: 'isRevisorPedagogico',
  },
  return_to_creator_from_pedagogica: {
    from: ['Revisión Pedagógica'],
    to: 'Devuelto',
    allowedRole: 'isRevisorPedagogico',
  },
  send_back_to_pedagogica: {
    from: ['Revisión Estilo'],
    to: 'Revisión Pedagógica',
    allowedRole: 'isRevisorEstilo',
  },
  return_to_creator_from_estilo: {
    from: ['Revisión Estilo'],
    to: 'Devuelto',
    allowedRole: 'isRevisorEstilo',
  },
  mark_finished: {
    from: ['Revisión Estilo'],
    to: 'Finalizado',
    allowedRole: 'isRevisorEstilo',
  },
};

export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const { id } = req.query;
  const { action, nota } = req.body || {};

  const rule = ACTIONS[action];
  if (!rule) throw new ApiError(400, `Acción no reconocida: ${action}`);

  const access = await loadDocumentWithAccess(auth, id);
  if (access.isReadOnly) throw new ApiError(423, 'El documento está en modo solo lectura');

  if (!auth.isAdmin && !access[rule.allowedRole]) {
    throw new ApiError(403, 'Tu rol no puede ejecutar esta acción');
  }
  if (!rule.from.includes(access.document.estado)) {
    throw new ApiError(
      409,
      `No se puede ejecutar "${action}" desde el estado "${access.document.estado}"`
    );
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('documents')
    .update({ estado: rule.to, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);

  await admin.from('document_history').insert({
    document_id: id,
    estado_anterior: access.document.estado,
    estado_nuevo: rule.to,
    actor_id: auth.profile.id,
    nota: nota || null,
  });

  // El documento pudo entrar a una etapa (Pendiente, Revisión Pedagógica,
  // Revisión Estilo, Devuelto) sin nadie asignado en el campo de ese rol;
  // según la configuración del proyecto, se asigna solo o queda disponible.
  await autoAssignIfNeeded(admin, data, access.document.projects, auth.profile.id);

  return res.status(200).json({ document: data });
});
