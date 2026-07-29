import { randomUUID } from 'node:crypto';
import { toObjectId } from './mongo.js';
import { validateFieldValue, validateSubformFieldValue, validateSubformLimits } from './validation.js';

// Trae la biblioteca de subformularios con "_id" ya como string (Mongo lo
// devuelve como ObjectId; el resto del código -incluidos los valores
// guardados en document_data- siempre lo maneja como string). La usan
// saveDocumentValues (validación) y api/documents/[id]/generate.js
// (descripción del prompt del agente sintético), para no repetir la
// consulta ni el mapeo de "_id".
export async function fetchSubformsLibrary(db) {
  const docs = await db.collection('subforms').find({}).toArray();
  return docs.map((sf) => ({ ...sf, _id: sf._id.toString() }));
}

// Estados en los que el Creador Experto (humano o agente sintético) puede
// editar el contenido del documento. Lo usan tanto el guardado normal
// (api/documents/[id]/data.js) como la generación por IA
// (api/documents/[id]/generate.js).
export const EDITABLE_STATES = {
  creador: ['Pendiente', 'En proceso', 'Devuelto'],
  revisor_pedagogico: ['Revisión Pedagógica'],
  revisor_estilo: ['Revisión Estilo'],
};

// Valida todos los campos de un formulario -incluido el contenido interno
// de cada instancia de subformulario (antes no se validaba en absoluto)-
// contra su propia regla y las validaciones globales del proyecto, más los
// límites de cantidad de instancias por tipo de subformulario definidos a
// nivel de todo el formulario (ver FormBuilder.jsx). Devuelve un objeto
// { variable: [errores] }, vacío si todo calza.
export function validateDocumentValues({ form, values, globalValidations = [], subformsLibrary = [] }) {
  const allFields = form.sections.flatMap((s) => s.fields);
  const errors = {};
  for (const field of allFields) {
    if (field.type === 'subform') {
      const subErrors = validateSubformFieldValue(field, values[field.variable], subformsLibrary);
      if (subErrors.length) errors[field.variable] = subErrors;
      continue;
    }
    const value = values[field.variable];
    const fieldErrors = validateFieldValue(field, value, globalValidations);
    if (fieldErrors.length) errors[field.variable] = fieldErrors;
  }
  const limitErrors = validateSubformLimits(form, values);
  for (const [variable, msgs] of Object.entries(limitErrors)) {
    errors[variable] = [...(errors[variable] || []), ...msgs];
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
export async function saveDocumentValues({ admin, db, document, form, values, partial, subformsLibrary }) {
  if (!partial) {
    const { data: globalValidations } = await admin
      .from('global_validations')
      .select('*')
      .eq('project_id', document.project_id)
      .eq('activo', true);

    const library = subformsLibrary || (await fetchSubformsLibrary(db));
    const errors = validateDocumentValues({
      form,
      values,
      globalValidations: globalValidations || [],
      subformsLibrary: library,
    });
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
