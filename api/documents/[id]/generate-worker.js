import { withCors, ApiError } from '../../_lib/cors.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { getDb, toObjectId } from '../../_lib/mongo.js';
import {
  EDITABLE_STATES,
  validateDocumentValues,
  saveDocumentValues,
  fetchSubformsLibrary,
} from '../../_lib/documentData.js';
import { buildContextText } from '../../_lib/parametrizacion.js';
import { generateDocumentValues } from '../../_lib/gemini.js';
import { pickRandom } from '../../_lib/multimediaAssignment.js';
import { assertWorkerSecret } from '../../_lib/qstash.js';
import { autoAssignIfNeeded } from '../../_lib/groupAssignment.js';

const MAX_ATTEMPTS = 3;

// El Creador Experto es el agente sintético: nunca inicia sesión, así que
// nadie puede darle clic a "Enviar a revisión pedagógica" en su nombre. Por
// eso el worker mismo hace esa transición al terminar, tanto si el
// contenido pasó la validación como si no (queda como borrador para que el
// Revisor Pedagógico lo corrija, en vez de esperar a que un Administrador
// lo empuje manualmente). Mismo mecanismo que la acción "send_to_pedagogica"
// de submit.js: mueve el estado, dejarlo en el historial y auto-asigna
// revisor según la configuración del proyecto.
async function sendToRevisionPedagogica({ admin, document, agentId, nota }) {
  const { data: updated, error } = await admin
    .from('documents')
    .update({ estado: 'Revisión Pedagógica', updated_at: new Date().toISOString() })
    .eq('id', document.id)
    .select()
    .single();
  if (error) throw new ApiError(500, error.message);

  await admin.from('document_history').insert({
    document_id: document.id,
    estado_anterior: document.estado,
    estado_nuevo: 'Revisión Pedagógica',
    actor_id: agentId,
    nota,
  });

  await autoAssignIfNeeded(admin, updated, document.projects);
}

// A diferencia de generate.js (que solo encola y responde en milisegundos),
// acá nadie está esperando con el navegador abierto: lo llama QStash, así
// que puede tomarse el tiempo de las hasta 3 llamadas reales a Gemini. La
// duración máxima (300s) se configura en vercel.json, no acá: este no es un
// proyecto Next.js, y export const config solo funciona en ese framework.

// Worker de la generación por IA: lo invoca QStash, no el navegador. No usa
// requireAuth (no hay sesión de usuario en una llamada de QStash) — se
// autentica con el secreto compartido en la URL, y todas las validaciones
// de permisos/estado ya las hizo generate.js antes de encolar.
export default withCors(async (req, res) => {
  if (req.method !== 'POST') throw new ApiError(405, 'Método no permitido');
  if (!assertWorkerSecret(req)) throw new ApiError(403, 'Secreto de worker inválido');

  const { id } = req.query;
  const { job_id } = req.body || {};
  const admin = supabaseAdmin();

  const markJob = async (updates) => {
    if (!job_id) return;
    await admin
      .from('document_generation_jobs')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', job_id);
  };

  try {
    await markJob({ estado: 'procesando' });

    // Se recarga todo desde cero (no se confía en lo que se vio al
    // encolar): entre el encolado y este momento pudo cambiar el documento,
    // el agente o la parametrización del proyecto.
    const { data: document, error: docError } = await admin
      .from('documents')
      .select('*, projects(parametrizacion, asignacion_revisor_pedagogico, criterio_carga)')
      .eq('id', id)
      .single();
    if (docError || !document) throw new ApiError(404, 'Documento no encontrado');

    if (!EDITABLE_STATES.creador.includes(document.estado)) {
      throw new ApiError(400, `El documento ya no está en un estado editable (estado actual: ${document.estado})`);
    }

    const { data: agent, error: agentError } = await admin
      .from('profiles')
      .select('id, is_synthetic, persona_prompt, persona_model')
      .eq('id', document.creador_id)
      .single();
    if (agentError || !agent) throw new ApiError(400, 'El documento no tiene un Creador Experto asignado');
    if (!agent.is_synthetic) throw new ApiError(400, 'El Creador Experto asignado no es un agente sintético');
    if (!document.poblacion_objetivo_id) {
      throw new ApiError(400, 'El documento no tiene una población objetivo asignada');
    }

    const parametrizacion = document.projects?.parametrizacion || {};
    const allowedPoblacionIds = parametrizacion.poblacion_objetivo?.poblacion_ids || [];
    let projectPoblaciones = [];
    if (allowedPoblacionIds.length > 0) {
      const { data } = await admin.from('poblaciones_objetivo').select('*').in('id', allowedPoblacionIds);
      projectPoblaciones = data || [];
    }
    const poblacionDelDocumento = projectPoblaciones.find((p) => p.id === document.poblacion_objetivo_id);
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

    // Enfoque narrativo al azar para ESTE documento (ver
    // api/enfoques-narrativos/): uno solo por corrida, no por intento — es
    // una decisión de contenido, no algo que deba cambiar si un intento
    // falla la validación.
    const excludedEnfoqueIds = parametrizacion.pedagogia?.enfoques_narrativos_excluidos || [];
    const { data: enfoquesNarrativosData } = await admin
      .from('enfoques_narrativos')
      .select('id, texto')
      .eq('activo', true);
    const enfoquesDisponibles = (enfoquesNarrativosData || []).filter((e) => !excludedEnfoqueIds.includes(e.id));
    const enfoqueNarrativo =
      enfoquesDisponibles.length > 0 ? pickRandom(enfoquesDisponibles.map((e) => e.texto)) : null;

    const contextText = buildContextText(parametrizacion, {
      poblaciones: [poblacionDelDocumento],
      dotacionReferencias,
    });

    const db = await getDb();
    const form = await db.collection('forms').findOne({ _id: toObjectId(document.form_id) });
    if (!form) throw new ApiError(404, 'Formulario asociado no encontrado');

    const subformsLibrary = await fetchSubformsLibrary(db);

    const { data: globalValidations } = await admin
      .from('global_validations')
      .select('*')
      .eq('project_id', document.project_id)
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
        subformsLibrary,
        enfoqueNarrativo,
        idioma: document.idioma,
      });

      const errors = validateDocumentValues({
        form,
        values: generation.values,
        globalValidations: globalValidations || [],
        subformsLibrary,
      });
      const valido = Object.keys(errors).length === 0;

      await admin.from('document_generations').insert({
        document_id: id,
        agent_id: agent.id,
        intento,
        valido,
        errores: valido ? null : errors,
        modelo: generation.model,
        prompt_tokens: generation.usage?.promptTokens ?? null,
        completion_tokens: generation.usage?.completionTokens ?? null,
        total_tokens: generation.usage?.totalTokens ?? null,
      });

      lastValues = generation.values;
      lastErrors = valido ? null : errors;

      if (valido) break;
    }

    if (lastErrors) {
      // Guarda el mejor borrador (sin validar en firme) para que un humano
      // lo revise, en vez de dejar el documento sin ningún avance.
      await saveDocumentValues({
        admin,
        db,
        document,
        form,
        values: lastValues,
        partial: true,
        subformsLibrary,
      });
      await sendToRevisionPedagogica({
        admin,
        document,
        agentId: agent.id,
        nota: `Generado por el agente sintético, pero no pasó la validación tras ${MAX_ATTEMPTS} intentos. Requiere corrección manual.`,
      });
      await markJob({ estado: 'completado', needs_human_review: true, errores: lastErrors });
      return res.status(200).json({ ok: true, needs_human_review: true });
    }

    await saveDocumentValues({
      admin,
      db,
      document,
      form,
      values: lastValues,
      partial: false,
      subformsLibrary,
    });

    await sendToRevisionPedagogica({
      admin,
      document,
      agentId: agent.id,
      nota: 'Generado y validado por el agente sintético.',
    });

    await markJob({ estado: 'completado', needs_human_review: false, errores: null });
    return res.status(200).json({ ok: true, needs_human_review: false });
  } catch (err) {
    // Deja el error visible en el job (el frontend lo muestra) y responde
    // 500 para que QStash lo reintente por su cuenta.
    await markJob({ estado: 'error', error_message: err.message || 'Error desconocido' });
    throw err;
  }
});
