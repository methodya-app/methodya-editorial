import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, requireAdmin } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { getDb, toObjectId } from '../../_lib/mongo.js';
import { loadDocumentWithAccess } from '../../_lib/documentAccess.js';
import { EDITABLE_STATES, validateDocumentValues, saveDocumentValues } from '../../_lib/documentData.js';
import { buildContextText } from '../../_lib/parametrizacion.js';
import { generateDocumentValues } from '../../_lib/gemini.js';

const MAX_ATTEMPTS = 3;

// Hasta 3 llamadas reales a Gemini en serie no caben holgadas en el límite
// general de 30s (ver vercel.json). Se configura aquí (en vez de con un
// patrón glob en vercel.json) porque Vercel no matchea de forma confiable
// patrones "functions" contra rutas dinámicas con corchetes como [id]. No
// se fija "memory": con Fluid Compute (activo por defecto) eso se controla
// desde Project Settings > Functions en el dashboard, no desde código.
export const config = { maxDuration: 60 };

// Agente Creador Sintético: genera el contenido de un documento con IA,
// reutilizando el mismo flujo editorial que un Creador Experto humano (no
// hay un flujo paralelo). Solo el Administrador puede dispararlo.
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  requireAdmin(auth);
  const { id } = req.query;
  const access = await loadDocumentWithAccess(auth, id);

  if (access.isReadOnly) throw new ApiError(423, 'El documento está en modo solo lectura');
  if (!EDITABLE_STATES.creador.includes(access.document.estado)) {
    throw new ApiError(
      400,
      `El documento no está en un estado editable por el Creador Experto (estado actual: ${access.document.estado})`
    );
  }

  const admin = supabaseAdmin();

  const { data: agent, error: agentError } = await admin
    .from('profiles')
    .select('id, is_synthetic, persona_prompt, persona_model')
    .eq('id', access.document.creador_id)
    .single();
  if (agentError || !agent) throw new ApiError(400, 'El documento no tiene un Creador Experto asignado');
  if (!agent.is_synthetic) throw new ApiError(400, 'El Creador Experto asignado no es un agente sintético');

  if (!access.document.poblacion_objetivo_id) {
    throw new ApiError(400, 'El documento no tiene una población objetivo asignada');
  }

  // Trae TODAS las poblaciones configuradas para el proyecto en una sola
  // consulta: sirve tanto para el contexto (solo la del documento) como
  // para las opciones dinámicas del tipo de campo "poblacion_objetivo".
  const parametrizacion = access.document.projects?.parametrizacion || {};
  const allowedPoblacionIds = parametrizacion.poblacion_objetivo?.poblacion_ids || [];
  let projectPoblaciones = [];
  if (allowedPoblacionIds.length > 0) {
    const { data } = await admin.from('poblaciones_objetivo').select('*').in('id', allowedPoblacionIds);
    projectPoblaciones = data || [];
  }
  const poblacionDelDocumento = projectPoblaciones.find((p) => p.id === access.document.poblacion_objetivo_id);
  if (!poblacionDelDocumento) throw new ApiError(400, 'No se pudo cargar la población objetivo del documento');

  const referenciaIds = parametrizacion.dotacion?.referencia_ids || [];
  let dotacionReferencias = [];
  if (referenciaIds.length > 0) {
    const { data } = await admin
      .from('dotacion_referencias')
      .select('*, dotacion_tipos(nombre)')
      .in('id', referenciaIds);
    dotacionReferencias = data || [];
  }
  const projectTemas = parametrizacion.temas_focos?.temas || [];

  const contextText = buildContextText(parametrizacion, {
    poblaciones: [poblacionDelDocumento],
    dotacionReferencias,
  });

  const db = await getDb();
  const form = await db.collection('forms').findOne({ _id: toObjectId(access.document.form_id) });
  if (!form) throw new ApiError(404, 'Formulario asociado no encontrado');

  const { data: globalValidations } = await admin
    .from('global_validations')
    .select('*')
    .eq('project_id', access.document.project_id)
    .eq('activo', true);

  let lastValues = null;
  let lastErrors = null;

  for (let intento = 1; intento <= MAX_ATTEMPTS; intento++) {
    const generation = await generateDocumentValues({
      form,
      personaPrompt: agent.persona_prompt || '',
      contextText,
      previousErrors: lastErrors,
      model: agent.persona_model || undefined,
      projectPoblaciones,
      projectTemas,
      projectDotacionReferencias: dotacionReferencias,
    });

    const errors = validateDocumentValues({ form, values: generation.values, globalValidations: globalValidations || [] });
    const valido = Object.keys(errors).length === 0;

    await admin.from('document_generations').insert({
      document_id: id,
      agent_id: agent.id,
      intento,
      valido,
      errores: valido ? null : errors,
      modelo: generation.model,
    });

    lastValues = generation.values;
    lastErrors = valido ? null : errors;

    if (valido) break;
  }

  if (lastErrors) {
    // Guarda el mejor borrador (sin validar en firme) para que un humano lo
    // revise, en vez de bloquear al agente o dejarlo sin ningún avance.
    await saveDocumentValues({ admin, db, document: access.document, form, values: lastValues, partial: true });
    return res.status(200).json({ ok: true, needs_human_review: true, errors: lastErrors });
  }

  await saveDocumentValues({ admin, db, document: access.document, form, values: lastValues, partial: false });

  // Si el documento estaba Pendiente, el mismo criterio que el guardado
  // humano lo pasa a "En proceso" al recibir su primer contenido.
  if (access.document.estado === 'Pendiente') {
    await admin.from('documents').update({ estado: 'En proceso' }).eq('id', id);
  }

  return res.status(200).json({ ok: true, needs_human_review: false });
});
