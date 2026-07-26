import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { getDb, toObjectId } from '../../_lib/mongo.js';
import { loadDocumentWithAccess } from '../../_lib/documentAccess.js';
import { EDITABLE_STATES, saveDocumentValues } from '../../_lib/documentData.js';

export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const { id } = req.query;
  const access = await loadDocumentWithAccess(auth, id);
  const db = await getDb();

  if (req.method === 'GET') {
    const data = await db.collection('document_data').findOne({ document_id: id });
    return res.status(200).json({ values: data?.values || {} });
  }

  if (req.method === 'PUT') {
    if (access.isReadOnly) throw new ApiError(423, 'El documento está en modo solo lectura');

    const canEdit =
      auth.isAdmin ||
      (access.isCreador && EDITABLE_STATES.creador.includes(access.document.estado)) ||
      (access.isRevisorPedagogico &&
        EDITABLE_STATES.revisor_pedagogico.includes(access.document.estado)) ||
      (access.isRevisorEstilo && EDITABLE_STATES.revisor_estilo.includes(access.document.estado));

    if (!canEdit) {
      throw new ApiError(403, 'Tu rol no puede editar el documento en su estado actual');
    }

    const { values, partial } = req.body || {};
    if (!values || typeof values !== 'object') throw new ApiError(400, 'values es obligatorio');

    const form = await db
      .collection('forms')
      .findOne({ _id: toObjectId(access.document.form_id) });
    if (!form) throw new ApiError(404, 'Formulario asociado no encontrado');

    const admin = supabaseAdmin();
    const result = await saveDocumentValues({ admin, db, document: access.document, form, values, partial });
    if (!result.ok) {
      return res.status(422).json({ error: 'Errores de validación', errors: result.errors });
    }

    // Si el creador guarda parcialmente estando en Pendiente, pasa a "En proceso".
    if (access.isCreador && access.document.estado === 'Pendiente') {
      await admin.from('documents').update({ estado: 'En proceso' }).eq('id', id);
    }

    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
