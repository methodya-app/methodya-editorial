import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Listado plano de TODAS las referencias activas (de tipos activos), con
// el nombre de su tipo, para el selector de dotación en la Parametrización
// de un proyecto. Cualquier usuario autenticado puede leerlo.
export default withCors(async (req, res) => {
  if (req.method !== 'GET') throw new ApiError(405, 'Método no permitido');
  await requireAuth(req);

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('dotacion_referencias')
    .select('*, dotacion_tipos!inner(id, nombre, activo)')
    .eq('activo', true)
    .eq('dotacion_tipos.activo', true)
    .order('nombre');
  if (error) throw new ApiError(500, error.message);
  return res.status(200).json({ dotacion_referencias: data });
});
