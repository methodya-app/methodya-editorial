import { ApiError } from './cors.js';
import { qstashClient, workerUrl } from './qstash.js';

// Encola la generación por IA de un documento en QStash. La usan tanto el
// disparo manual ("✨ Generar con IA") como el disparo automático al crear
// un documento con un Creador Experto sintético ya asignado. El llamador es
// responsable de validar antes que el documento tiene un agente sintético
// como creador y una población objetivo asignada; acá solo se valida que la
// cola esté configurada y que no haya ya una generación en curso.
export async function enqueueGeneration({ admin, documentId }) {
  const { data: existing } = await admin
    .from('document_generation_jobs')
    .select('*')
    .eq('document_id', documentId)
    .in('estado', ['encolado', 'procesando'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) return { job: existing, alreadyRunning: true };

  if (!process.env.QSTASH_TOKEN || !process.env.PUBLIC_BACKEND_URL || !process.env.GENERATE_WORKER_SECRET) {
    throw new ApiError(
      500,
      'Falta configurar la cola de generación (QSTASH_TOKEN, PUBLIC_BACKEND_URL y GENERATE_WORKER_SECRET).'
    );
  }

  const { data: job, error: jobError } = await admin
    .from('document_generation_jobs')
    .insert({ document_id: documentId, estado: 'encolado' })
    .select()
    .single();
  if (jobError) throw new ApiError(500, jobError.message);

  try {
    await qstashClient().publishJSON({
      url: workerUrl(`/api/documents/${documentId}/generate-worker`),
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

  return { job, alreadyRunning: false };
}
