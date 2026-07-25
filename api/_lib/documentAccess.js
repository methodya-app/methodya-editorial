import { ApiError } from './cors.js';
import { supabaseAdmin } from './supabaseAdmin.js';
import { roleInProject } from './auth.js';

export const READ_ONLY_STATES = ['Detenido', 'Finalizado', 'Eliminado'];
export const READ_ONLY_PROJECT_STATES = ['Detenido', 'Finalizado', 'Eliminado'];

// Carga el documento (Postgres) junto con su proyecto y calcula el rol del
// usuario en ese documento específico. Lanza ApiError si no tiene acceso.
export async function loadDocumentWithAccess(auth, documentId) {
  const admin = supabaseAdmin();
  const { data: document, error } = await admin
    .from('documents')
    .select(
      '*, projects(id, estado, plantilla_texto_simulado, plantilla_tipo, plantilla_url, drive_folder_url, ' +
        'asignacion_creador, asignacion_revisor_pedagogico, asignacion_revisor_estilo, criterio_carga, ' +
        'vaciado_formato)'
    )
    .eq('id', documentId)
    .single();
  if (error || !document) throw new ApiError(404, 'Documento no encontrado');

  const projectRole = roleInProject(auth, document.project_id);
  if (!projectRole) throw new ApiError(403, 'Sin acceso al proyecto de este documento');

  const isCreador = document.creador_id === auth.profile.id;
  const isRevisorPedagogico = document.revisor_pedagogico_id === auth.profile.id;
  const isRevisorEstilo = document.revisor_estilo_id === auth.profile.id;

  const hasAccess =
    auth.isAdmin || isCreador || isRevisorPedagogico || isRevisorEstilo;
  if (!hasAccess) throw new ApiError(403, 'No tienes asignación sobre este documento');

  const isReadOnly =
    READ_ONLY_STATES.includes(document.estado) ||
    READ_ONLY_PROJECT_STATES.includes(document.projects?.estado);

  return {
    document,
    projectRole,
    isCreador,
    isRevisorPedagogico,
    isRevisorEstilo,
    isReadOnly,
  };
}
