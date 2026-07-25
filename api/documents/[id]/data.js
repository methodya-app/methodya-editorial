import { randomUUID } from 'node:crypto';
import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { getDb, toObjectId } from '../../_lib/mongo.js';
import { loadDocumentWithAccess } from '../../_lib/documentAccess.js';
import { validateFieldValue } from '../../_lib/validation.js';

// Estados en los que cada rol puede EDITAR el contenido del documento.
const EDITABLE_STATES = {
  creador: ['Pendiente', 'En proceso', 'Devuelto'],
  revisor_pedagogico: ['Revisión Pedagógica'],
  revisor_estilo: ['Revisión Estilo'],
};

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
    const { data: globalValidations } = await admin
      .from('global_validations')
      .select('*')
      .eq('project_id', access.document.project_id)
      .eq('activo', true);

    const allFields = form.sections.flatMap((s) => s.fields);

    // Solo se exige el cumplimiento estricto de validaciones cuando NO es
    // un guardado parcial (autosave del creador mientras trabaja).
    if (!partial) {
      const errors = {};
      for (const field of allFields) {
        if (field.type === 'subform') continue; // se valida dentro del subformulario, fuera de alcance beta
        const value = values[field.variable];
        const fieldErrors = validateFieldValue(field, value, globalValidations || []);
        if (fieldErrors.length) errors[field.variable] = fieldErrors;
      }
      if (Object.keys(errors).length > 0) {
        return res.status(422).json({ error: 'Errores de validación', errors });
      }
    }

    // A toda instancia de subformulario sin "id" (datos guardados antes de
    // que el equipo multimedia existiera) se le asigna uno estable, para
    // poder liberarla al equipo multimedia como tarea independiente.
    const subformFields = allFields.filter((f) => f.type === 'subform');
    for (const field of subformFields) {
      const fieldValue = values[field.variable];
      if (fieldValue && Array.isArray(fieldValue.instances)) {
        fieldValue.instances = fieldValue.instances.map((inst) =>
          inst.id ? inst : { ...inst, id: randomUUID() }
        );
      }
    }

    // Código automático de cada instancia: {código del documento}-{prefijo
    // del subformulario}-{consecutivo del tipo dentro del documento}, ej:
    // G1-001-VID-1, G1-001-VID-2. El consecutivo se cuenta por subform_id en
    // todo el documento (el mismo tipo puede repetirse en varios campos).
    const subformIdsUsed = [
      ...new Set(subformFields.map((f) => values[f.variable]?.subform_id).filter(Boolean)),
    ];
    if (subformIdsUsed.length > 0) {
      const subformDocs = await db
        .collection('subforms')
        .find({ _id: { $in: subformIdsUsed.map(toObjectId) } })
        .toArray();
      const prefijoById = new Map(subformDocs.map((sf) => [sf._id.toString(), sf.prefijo]));

      const maxConsecutivoById = new Map();
      for (const field of subformFields) {
        const fieldValue = values[field.variable];
        for (const inst of fieldValue?.instances || []) {
          const match = inst.codigo && inst.codigo.match(/-(\d+)$/);
          if (!match) continue;
          const n = parseInt(match[1], 10);
          const key = fieldValue.subform_id;
          if (n > (maxConsecutivoById.get(key) || 0)) maxConsecutivoById.set(key, n);
        }
      }

      for (const field of subformFields) {
        const fieldValue = values[field.variable];
        if (!fieldValue || !Array.isArray(fieldValue.instances)) continue;
        const prefijo = prefijoById.get(fieldValue.subform_id);
        if (!prefijo) continue; // subformulario sin prefijo configurado aún
        fieldValue.instances = fieldValue.instances.map((inst) => {
          if (inst.codigo) return inst;
          const next = (maxConsecutivoById.get(fieldValue.subform_id) || 0) + 1;
          maxConsecutivoById.set(fieldValue.subform_id, next);
          return { ...inst, codigo: `${access.document.codigo}-${prefijo}-${next}` };
        });
      }
    }

    await db.collection('document_data').updateOne(
      { document_id: id },
      {
        $set: { document_id: id, form_id: access.document.form_id, values, updated_at: new Date() },
        $setOnInsert: { comments: [] },
      },
      { upsert: true }
    );

    // Si el creador guarda parcialmente estando en Pendiente, pasa a "En proceso".
    if (access.isCreador && access.document.estado === 'Pendiente') {
      await admin.from('documents').update({ estado: 'En proceso' }).eq('id', id);
    }

    return res.status(200).json({ ok: true });
  }

  throw new ApiError(405, 'Método no permitido');
});
