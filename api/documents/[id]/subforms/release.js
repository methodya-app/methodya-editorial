import { withCors, ApiError } from '../../../_lib/cors.js';
import { requireAuth } from '../../../_lib/auth.js';
import { supabaseAdmin } from '../../../_lib/supabaseAdmin.js';
import { getDb, toObjectId } from '../../../_lib/mongo.js';
import { loadDocumentWithAccess } from '../../../_lib/documentAccess.js';
import { autoAssignSubform } from '../../../_lib/multimediaAssignment.js';
import { notifyAssignment } from '../../../_lib/notifications.js';

// Libera una o varias instancias de subformulario (individual o en lote)
// como tareas independientes para el equipo multimedia. Solo el Revisor
// Pedagógico, el Revisor de Estilo (asignados a este documento) o el
// Administrador pueden liberar.
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  const { id: document_id } = req.query;
  const access = await loadDocumentWithAccess(auth, document_id);

  if (!auth.isAdmin && !access.isRevisorPedagogico && !access.isRevisorEstilo) {
    throw new ApiError(403, 'Tu rol no puede liberar subformularios al equipo multimedia');
  }

  const { instance_ids } = req.body || {};
  if (!Array.isArray(instance_ids) || instance_ids.length === 0) {
    throw new ApiError(400, 'instance_ids es obligatorio (arreglo no vacío)');
  }

  const db = await getDb();
  const admin = supabaseAdmin();

  const form = await db.collection('forms').findOne({ _id: toObjectId(access.document.form_id) });
  if (!form) throw new ApiError(404, 'Formulario asociado no encontrado');
  const docData = await db.collection('document_data').findOne({ document_id });
  const values = docData?.values || {};

  const subformFields = form.sections.flatMap((s) => s.fields).filter((f) => f.type === 'subform');

  // Ubica cada instancia solicitada dentro de los campos de tipo subform.
  const found = new Map(); // instance_id -> { field, instance, subform }
  for (const field of subformFields) {
    const fieldValue = values[field.variable];
    if (!fieldValue || !Array.isArray(fieldValue.instances)) continue;
    for (const instance of fieldValue.instances) {
      if (instance.id && instance_ids.includes(instance.id)) {
        found.set(instance.id, { field, instance, subform_id: fieldValue.subform_id });
      }
    }
  }

  const { data: multimediaRoles } = await admin.from('multimedia_roles').select('id, nombre, subform_ids');
  const { data: project } = await admin
    .from('projects')
    .select('criterio_carga')
    .eq('id', access.document.project_id)
    .single();

  const released = [];
  const skipped = [];

  for (const instanceId of instance_ids) {
    const match = found.get(instanceId);
    if (!match) {
      skipped.push({ instance_id: instanceId, reason: 'No se encontró esa instancia en el documento' });
      continue;
    }

    const existing = await db.collection('subform_assignments').findOne({
      document_id,
      field_variable: match.field.variable,
      instance_id: instanceId,
      estado: { $ne: 'Eliminado' },
    });
    if (existing) {
      skipped.push({ instance_id: instanceId, reason: 'Ya fue liberado antes' });
      continue;
    }

    const role = (multimediaRoles || []).find((r) => (r.subform_ids || []).includes(match.subform_id));
    if (!role) {
      skipped.push({
        instance_id: instanceId,
        reason: `No hay un rol multimedia configurado para "${match.field.label}"`,
      });
      continue;
    }

    // Nombre del subformulario, guardado aparte para no depender de la
    // biblioteca (y para nombrar la subcarpeta de Drive al cargar el recurso).
    const subformDoc = await db.collection('subforms').findOne({ _id: toObjectId(match.subform_id) });

    const assignment = {
      document_id,
      document_codigo: access.document.codigo,
      project_id: access.document.project_id,
      field_variable: match.field.variable,
      instance_id: instanceId,
      subform_id: match.subform_id,
      subform_nombre: subformDoc?.nombre || match.field.label,
      subform_codigo: match.instance.codigo || '',
      titulo: match.instance.values?.titulo || '',
      multimedia_role_id: role.id,
      assigned_user_id: null,
      estado: 'Asignado',
      comments: [],
      recursos: [],
      released_by: auth.profile.id,
      released_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    const insertResult = await db.collection('subform_assignments').insertOne(assignment);
    const assignedUserId = await autoAssignSubform({
      admin,
      db,
      projectId: access.document.project_id,
      multimediaRoleId: role.id,
      criterioCarga: project?.criterio_carga,
    });
    if (assignedUserId) {
      await db
        .collection('subform_assignments')
        .updateOne({ _id: insertResult.insertedId }, { $set: { assigned_user_id: assignedUserId } });
      await notifyAssignment({
        admin,
        userId: assignedUserId,
        actorId: auth.profile.id,
        roleLabel: role.nombre,
        codigo: assignment.subform_codigo || assignment.document_codigo,
        link: `/multimedia/tarea/${insertResult.insertedId}`,
        sourceType: 'subform_assignment',
        sourceId: insertResult.insertedId.toString(),
      });
    }

    released.push({ instance_id: instanceId, id: insertResult.insertedId.toString(), role: role.nombre });
  }

  return res.status(200).json({ released, skipped });
});
