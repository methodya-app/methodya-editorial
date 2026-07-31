import { withCors, ApiError } from '../../_lib/cors.js';
import { requireAuth, requireAdmin } from '../../_lib/auth.js';
import { supabaseAdmin } from '../../_lib/supabaseAdmin.js';
import { loadDocumentWithAccess } from '../../_lib/documentAccess.js';
import { EDITABLE_STATES } from '../../_lib/documentData.js';
import { qstashClient, workerUrl } from '../../_lib/qstash.js';

// Agente Creador Sintético: ENCOLA la generación de contenido y responde de
// inmediato. El trabajo real (hasta 3 llamadas a Gemini, que pueden tardar
// minutos) lo hace después generate-worker.js, invocado por QStash — así el
// navegador no tiene que quedarse esperando y se pueden disparar varias
// generaciones a la vez, desatendidas. El seguimiento se hace por polling a
// generate-status.js. Solo el Administrador puede dispararlo.
//
// Las validaciones que sí se hacen aquí (permisos, estado del documento,
// agente sintético válido) son a propósito síncronas: fallan rápido y con
// un mensaje visible, antes de encolar nada.
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
    .select('id, is_synthetic')
    .eq('id', access.document.creador_id)
    .single();
  if (agentError || !agent) throw new ApiError(400, 'El documento no tiene un Creador Experto asignado');
  if (!agent.is_synthetic) throw new ApiError(400, 'El Creador Experto asignado no es un agente sintético');
  if (!access.document.poblacion_objetivo_id) {
    throw new ApiError(400, 'El documento no tiene una población objetivo asignada');
  }

  if (!process.env.QSTASH_TOKEN || !process.env.PUBLIC_BACKEND_URL || !process.env.GENERATE_WORKER_SECRET) {
    throw new ApiError(
      500,
      'Falta configurar la cola de generación (QSTASH_TOKEN, PUBLIC_BACKEND_URL y GENERATE_WORKER_SECRET).'
    );
  }

  const { data: job, error: jobError } = await admin
    .from('document_generation_jobs')
    .insert({ document_id: id, estado: 'encolado' })
    .select()
    .single();
  if (jobError) throw new ApiError(500, jobError.message);

  try {
    await qstashClient().publishJSON({
      url: workerUrl(`/api/documents/${id}/generate-worker`),
      body: { job_id: job.id },
    });
  } catch (err) {
    // Si no se pudo encolar, el job no debe quedar colgado en "encolado"
    // para siempre: se marca el error para que el frontend lo muestre.
    await admin
      .from('document_generation_jobs')
      .update({
        estado: 'error',
        error_message: `No se pudo encolar: ${err.message}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    throw new ApiError(502, `No se pudo encolar la generación: ${err.message}`);
  }

  return res.status(202).json({ ok: true, job_id: job.id, estado: 'encolado' });
});
