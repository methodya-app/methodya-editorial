import { randomUUID } from 'node:crypto';
import { toObjectId } from './mongo.js';
import { validateFieldValue } from './validation.js';

// Estados en los que el Creador Experto (humano o agente sintético) puede
// editar el contenido del documento. Lo usan tanto el guardado normal
// (api/documents/[id]/data.js) como la generación por IA
// (api/documents/[id]/generate.js).
export const EDITABLE_STATES = {
  creador: ['Pendiente', 'En proceso', 'Devuelto'],
  revisor_pedagogico: ['Revisión Pedagógica'],
  revisor_estilo: ['Revisión Estilo'],
};

// Valida todos los campos de un formulario (excepto los de tipo 'subform',
// que se validan dentro del subformulario, fuera de alcance beta) contra su
// propia regla y las validaciones globales del proyecto. Devuelve un objeto
// { variable: [errores] }, vacío si todo calza.
export function validateDocumentValues({ form, values, globalValidations = [] }) {
  const allFields = form.sections.flatMap((s) => s.fields);
  const errors = {};
  for (const field of allFields) {
    if (field.type === 'subform') continue;
    const value = values[field.variable];
    const fieldErrors = validateFieldValue(field, value, globalValidations);
    if (fieldErrors.length) errors[field.variable] = fieldErrors;
  }
  return errors;
}

// A toda instancia de subformulario sin "id" se le asigna uno estable (para
// poder liberarla al equipo multimedia), y se le arma su código automático
// {código del documento}-{prefijo del subformulario}-{consecutivo del tipo
// dentro del documento}, ej: G1-001-VID-1, G1-001-VID-2. Muta `values` en
// el sitio.
async function backfillSubformInstances({ db, document, form, values }) {
  const allFields = form.sections.flatMap((s) => s.fields);
  const subformFields = allFields.filter((f) => f.type === 'subform');

  for (const field of subformFields) {
    const fieldValue = values[field.variable];
    if (fieldValue && Array.isArray(fieldValue.instances)) {
      fieldValue.instances = fieldValue.instances.map((inst) =>
        inst.id ? inst : { ...inst, id: randomUUID() }
      );
    }
  }

  const subformIdsUsed = [
    ...new Set(subformFields.map((f) => values[f.variable]?.subform_id).filter(Boolean)),
  ];
  if (subformIdsUsed.length === 0) return;

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
      return { ...inst, codigo: `${document.codigo}-${prefijo}-${next}` };
    });
  }
}

// Valida (si no es guardado parcial) y guarda los valores diligenciados de
// un documento en document_data, incluyendo la asignación de id/código a
// instancias de subformulario. La usan tanto el guardado humano
// (api/documents/[id]/data.js) como la generación por IA
// (api/documents/[id]/generate.js), para que ambos caminos pasen por
// exactamente el mismo motor de validación y persistencia. Devuelve
// { ok: false, errors } si la validación estricta falla, o { ok: true }.
export async function saveDocumentValues({ admin, db, document, form, values, partial }) {
  if (!partial) {
    const { data: globalValidations } = await admin
      .from('global_validations')
      .select('*')
      .eq('project_id', document.project_id)
      .eq('activo', true);

    const errors = validateDocumentValues({ form, values, globalValidations: globalValidations || [] });
    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }
  }

  await backfillSubformInstances({ db, document, form, values });

  await db.collection('document_data').updateOne(
    { document_id: document.id },
    {
      $set: { document_id: document.id, form_id: document.form_id, values, updated_at: new Date() },
      $setOnInsert: { comments: [] },
    },
    { upsert: true }
  );

  return { ok: true };
}
