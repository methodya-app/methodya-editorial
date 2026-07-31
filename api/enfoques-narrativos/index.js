import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Catálogo global de enfoques narrativos (ej. "a través de una historia",
// "a través de un experimento"): el agente sintético elige uno al azar en
// cada generación (ver api/documents/[id]/generate.js) para que documentos
// distintos sobre el mismo tema no salgan con la misma estructura. Por
// defecto TODOS aplican a TODO proyecto; cada proyecto puede excluir
// algunos desde su Parametrización (ver api/_lib/parametrizacion.js), sin
// tocar este catálogo. Cualquier usuario autenticado puede listarlo; solo
// el Administrador puede crear.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('enfoques_narrativos')
      .select('*')
      .eq('activo', true)
      .order('texto');
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ enfoques_narrativos: data });
  }

  if (req.method === 'POST') {
    requireAdmin(auth);
    const { texto } = req.body || {};
    if (!texto || !texto.trim()) throw new ApiError(400, 'texto es obligatorio');

    const { data, error } = await admin
      .from('enfoques_narrativos')
      .insert({ texto: texto.trim() })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json({ enfoque_narrativo: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
