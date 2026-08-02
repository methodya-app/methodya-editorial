import { withCors, ApiError } from '../../../_lib/cors.js';
import { requireAuth } from '../../../_lib/auth.js';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin.js';
import { getDb } from '../../../_lib/mongo.js';
import { loadDocumentWithAccess } from '../../../_lib/documentAccess.js';
import { autoAssignImplementation } from '../../../_lib/implementationAssignment.js';
import { notifyAssignment } from '../../../_lib/notifications.js';

// Libera el documento COMPLETO (ya Finalizado) al área de Implementación,
// como una única tarea de solo lectura + comentarios. A diferencia de
// subforms/release.js (por instancia), acá es un documento = una tarea, y
// solo se puede liberar una vez (índice único en document_implementations).
// Solo el Revisor de Estilo (asignado a este documento) o el Administrador
// pueden liberar.
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const { id: document_id } = req.query;
  const access = await loadDocumentWithAccess(auth, document_id);

  if (!auth.isAdmin && !access.isRevisorEstilo) {
    throw new ApiError(403, 'Tu rol no puede liberar este documento a implementación');
  }
  if (access.document.estado !== 'Finalizado') {
    throw new ApiError(400, 'El documento debe estar Finalizado para enviarlo a implementación');
  }

  const db = await getDb();
  const admin = supabaseAdmin();

  const existing = await db.collection('document_implementations').findOne({ document_id });
  if (existing) throw new ApiError(409, 'Este documento ya fue enviado a implementación');

  const { data: project } = await admin
    .from('projects')
    .select('criterio_carga')
    .eq('id', access.document.project_id)
    .single();

  const implementation = {
    document_id,
    document_codigo: access.document.codigo,
    project_id: access.document.project_id,
    assigned_user_id: null,
    estado: 'Pendiente',
    comments: [],
    released_by: auth.profile.id,
    released_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };

  const insertResult = await db.collection('document_implementations').insertOne(implementation);
  const assignedUserId = await autoAssignImplementation({
    admin,
    db,
    projectId: access.document.project_id,
    criterioCarga: project?.criterio_carga,
  });
  if (assignedUserId) {
    await db
      .collection('document_implementations')
      .updateOne({ _id: insertResult.insertedId }, { $set: { assigned_user_id: assignedUserId } });
    await notifyAssignment({
      admin,
      userId: assignedUserId,
      actorId: auth.profile.id,
      roleLabel: 'Implementador',
      codigo: implementation.document_codigo,
      link: `/implementacion/tarea/${insertResult.insertedId}`,
      sourceType: 'implementation',
      sourceId: insertResult.insertedId.toString(),
    });
  }

  return res.status(200).json({ ok: true, id: insertResult.insertedId.toString() });
});
