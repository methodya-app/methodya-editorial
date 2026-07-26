import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Catálogo global de poblaciones objetivo (edad, nivel lector, desarrollo
// esperado), reutilizable entre proyectos desde su Parametrización.
// Cualquier usuario autenticado puede listarlo (se usa para seleccionarlas
// en el proyecto); solo el Administrador puede crearlas.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const admin = supabaseAdmin();

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('poblaciones_objetivo')
      .select('*')
      .eq('activo', true)
      .order('nombre');
    if (error) throw new ApiError(500, error.message);
    return res.status(200).json({ poblaciones_objetivo: data });
  }

  if (req.method === 'POST') {
    requireAdmin(auth);
    const { nombre, edad_min, edad_max, nivel_lector, desarrollo_cognitivo, pensamiento_logico_steam, socioemocional_comunicacion } =
      req.body || {};
    if (!nombre || !nombre.trim()) throw new ApiError(400, 'nombre es obligatorio');
    if (edad_min === undefined || edad_min === null || isNaN(Number(edad_min))) {
      throw new ApiError(400, 'edad_min es obligatoria y debe ser numérica');
    }
    if (edad_max === undefined || edad_max === null || isNaN(Number(edad_max))) {
      throw new ApiError(400, 'edad_max es obligatoria y debe ser numérica');
    }
    if (Number(edad_min) > Number(edad_max)) {
      throw new ApiError(400, 'edad_min no puede ser mayor que edad_max');
    }
    if (!nivel_lector || !nivel_lector.trim()) throw new ApiError(400, 'nivel_lector es obligatorio');

    const { data, error } = await admin
      .from('poblaciones_objetivo')
      .insert({
        nombre: nombre.trim(),
        edad_min: Number(edad_min),
        edad_max: Number(edad_max),
        nivel_lector,
        desarrollo_cognitivo: desarrollo_cognitivo || null,
        pensamiento_logico_steam: pensamiento_logico_steam || null,
        socioemocional_comunicacion: socioemocional_comunicacion || null,
        created_by: auth.profile.id,
      })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.status(201).json({ poblacion_objetivo: data });
  }

  throw new ApiError(405, 'Método no permitido');
});
