import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';
import { getDb, toObjectId } from '../_lib/mongo.js';
import { loadDocumentWithAccess } from '../_lib/documentAccess.js';
import { autoAssignIfNeeded } from '../_lib/groupAssignment.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const { id } = req.query;

  if (req.method === 'GET') {
    const access = await loadDocumentWithAccess(auth, id);
    const db = await getDb();
    const form = await db.collection('forms').findOne({ _id: toObjectId(access.document.form_id) });
    const data = await db.collection('document_data').findOne({ document_id: id });

    // Estado de liberación al equipo multimedia de cada instancia de
    // subformulario (para no ofrecer "Enviar a multimedia" dos veces).
    const releases = await db
      .collection('subform_assignments')
      .find({ document_id: id, estado: { $ne: 'Eliminado' } })
      .project({ instance_id: 1, estado: 1 })
      .toArray();
    const subformReleaseStatus = Object.fromEntries(releases.map((r) => [r.instance_id, r.estado]));

    return res.status(200).json({
      document: access.document,
      form,
      values: data?.values || {},
      comments: data?.comments || [],
      vaciado_resultado: data?.vaciado_resultado || null,
      vaciado_drive_file_id: data?.vaciado_drive_file_id || null,
      vaciado_pdf_resultado: data?.vaciado_pdf_resultado || null,
      vaciado_pdf_file_id: data?.vaciado_pdf_file_id || null,
      subform_release_status: subformReleaseStatus,
      access: {
        role: access.projectRole,
        is_creador: access.isCreador,
        is_revisor_pedagogico: access.isRevisorPedagogico,
        is_revisor_estilo: access.isRevisorEstilo,
        is_read_only: access.isReadOnly,
      },
    });
  }

  if (req.method === 'PUT') {
    requireAdmin(auth);
    const admin = supabaseAdmin();
    const allowed = [
      'document_type_id',
      'creador_id',
      'revisor_pedagogico_id',
      'revisor_estilo_id',
      'estado',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body?.[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { data: before, error: beforeError } = await admin
      .from('documents')
      .select(
        'estado, project_id, projects(asignacion_creador, asignacion_revisor_pedagogico, asignacion_revisor_estilo, criterio_carga)'
      )
      .eq('id', id)
      .single();
    if (beforeError) throw new ApiError(404, 'Documento no encontrado');

    const { data, error } = await admin
      .from('documents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);

    // Registra en el historial cualquier cambio de estado hecho por el
    // Administrador (edición manual, envío a la papelera o restauración).
    if (updates.estado && updates.estado !== before.estado) {
      let nota = 'Editado por el Administrador';
      if (updates.estado === 'Eliminado') nota = 'Enviado a la papelera';
      else if (before.estado === 'Eliminado') nota = 'Restaurado desde la papelera';

      await admin.from('document_history').insert({
        document_id: id,
        estado_anterior: before.estado,
        estado_nuevo: updates.estado,
        actor_id: auth.profile.id,
        nota,
      });
    }

    // El Administrador pudo dejar el documento sin nadie asignado en el
    // campo de su rol (o mover el estado a una etapa cuyo campo está
    // vacío); según la configuración del proyecto, se asigna solo o queda
    // disponible para que alguien lo tome.
    await autoAssignIfNeeded(admin, data, before.projects);

    return res.status(200).json({ document: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
