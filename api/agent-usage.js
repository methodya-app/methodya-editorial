import { withCors, ApiError } from './_lib/cors.js';
import { requireAuth, requireAdmin } from './_lib/auth.js';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';

// Consumo de tokens del agente sintético: agrega document_generations (donde
// api/documents/[id]/generate.js graba prompt_tokens/completion_tokens/
// total_tokens de cada intento, tomados de usageMetadata en
// api/_lib/gemini.js) por proyecto y por agente sintético. Solo
// Administrador. Las consultas son deliberadamente simples (sin joins
// anidados de supabase-js) y la agregación se hace en JS, igual que
// api/projects/[id]/analytics.js.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');

  const auth = await requireAuth(req);
  requireAdmin(auth);
  const admin = supabaseAdmin();

  const { data: generations, error } = await admin
    .from('document_generations')
    .select('document_id, agent_id, valido, prompt_tokens, completion_tokens, total_tokens');
  if (error) throw new ApiError(500, error.message);

  const documentIds = [...new Set(generations.map((g) => g.document_id))];
  const { data: documents } = documentIds.length
    ? await admin.from('documents').select('id, project_id').in('id', documentIds)
    : { data: [] };
  const projectIdByDocId = new Map((documents || []).map((d) => [d.id, d.project_id]));

  const projectIds = [...new Set((documents || []).map((d) => d.project_id).filter(Boolean))];
  const { data: projects } = projectIds.length
    ? await admin.from('projects').select('id, nombre').in('id', projectIds)
    : { data: [] };
  const projectNameById = new Map((projects || []).map((p) => [p.id, p.nombre]));

  const agentIds = [...new Set(generations.map((g) => g.agent_id).filter(Boolean))];
  const { data: agents } = agentIds.length
    ? await admin.from('profiles').select('id, nombre, apellido').in('id', agentIds)
    : { data: [] };
  const agentNameById = new Map((agents || []).map((a) => [a.id, `${a.nombre} ${a.apellido}`]));

  const byProjectMap = new Map();
  const byAgentMap = new Map();
  const total = { intentos: 0, validos: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const addTo = (map, key, nombre, g) => {
    if (!map.has(key)) {
      map.set(key, { id: key, nombre, intentos: 0, validos: 0, prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
    }
    const entry = map.get(key);
    entry.intentos += 1;
    if (g.valido) entry.validos += 1;
    entry.prompt_tokens += g.prompt_tokens || 0;
    entry.completion_tokens += g.completion_tokens || 0;
    entry.total_tokens += g.total_tokens || 0;
  };

  for (const g of generations) {
    const projectId = projectIdByDocId.get(g.document_id);
    addTo(
      byProjectMap,
      projectId || 'sin-proyecto',
      projectId ? projectNameById.get(projectId) || 'Proyecto eliminado' : 'Documento sin proyecto',
      g
    );
    if (g.agent_id) addTo(byAgentMap, g.agent_id, agentNameById.get(g.agent_id) || 'Agente eliminado', g);

    total.intentos += 1;
    if (g.valido) total.validos += 1;
    total.prompt_tokens += g.prompt_tokens || 0;
    total.completion_tokens += g.completion_tokens || 0;
    total.total_tokens += g.total_tokens || 0;
  }

  const byTokensDesc = (a, b) => b.total_tokens - a.total_tokens;

  return res.status(200).json({
    by_project: [...byProjectMap.values()].sort(byTokensDesc),
    by_agent: [...byAgentMap.values()].sort(byTokensDesc),
    total,
  });
});
