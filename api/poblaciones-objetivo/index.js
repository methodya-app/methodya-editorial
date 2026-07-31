import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

// Encabezados aceptados al importar en lote, además de los nombres internos
// de las columnas: son los que trae el archivo que arma el usuario (una
// tabla exportada a JSON), para no obligarlo a renombrar nada antes de
// subirlo. La comparación se hace en minúsculas y sin tildes (ver norm()).
const ALIAS_CAMPOS = {
  nombre: 'nombre',
  'grado escolar': 'nombre',
  edad_min: 'edad_min',
  'edad minima': 'edad_min',
  edad_max: 'edad_max',
  'edad maxima': 'edad_max',
  nivel_lector: 'nivel_lector',
  'nivel lector': 'nivel_lector',
  desarrollo_cognitivo: 'desarrollo_cognitivo',
  'desarrollo cognitivo': 'desarrollo_cognitivo',
  pensamiento_logico_steam: 'pensamiento_logico_steam',
  'pensamiento logico / steam': 'pensamiento_logico_steam',
  'pensamiento logico/steam': 'pensamiento_logico_steam',
  'pensamiento logico steam': 'pensamiento_logico_steam',
  socioemocional_comunicacion: 'socioemocional_comunicacion',
  'socioemocional y comunicacion': 'socioemocional_comunicacion',
};

function norm(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}

// Las edades pueden venir como número o como texto ("5 años"): se toma el
// primer número que aparezca.
function parseEdad(valor) {
  if (typeof valor === 'number') return Number.isInteger(valor) ? valor : null;
  const match = String(valor ?? '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function normalizarFila(fila) {
  const salida = {};
  for (const [clave, valor] of Object.entries(fila || {})) {
    const campo = ALIAS_CAMPOS[norm(clave)];
    if (campo) salida[campo] = valor;
  }
  return salida;
}

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
    const body = req.body || {};

    // Importación en lote: mismo endpoint que la creación individual, pero
    // con un arreglo bajo "poblaciones". Va aquí y no en una ruta
    // /poblaciones-objetivo/import propia porque el enrutado por archivos
    // haría que esa URL cayera en [id].js (segmento dinámico), no en un
    // archivo import.js.
    if (Array.isArray(body.poblaciones)) {
      return importarPoblaciones(res, admin, auth, body.poblaciones);
    }

    const { nombre, edad_min, edad_max, nivel_lector, desarrollo_cognitivo, pensamiento_logico_steam, socioemocional_comunicacion } =
      body;
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

// Crea varias poblaciones de una sola vez. Nunca falla en bloque: cada fila
// que no se pueda crear se reporta aparte con su motivo, para poder subir
// el archivo, corregir solo lo que quedó fuera y volver a subirlo sin
// duplicar lo que ya entró (los nombres repetidos se omiten, no fallan).
async function importarPoblaciones(res, admin, auth, filas) {
  if (filas.length === 0) throw new ApiError(400, 'El archivo no tiene ninguna población');

  const { data: existentes } = await admin.from('poblaciones_objetivo').select('nombre');
  const nombresExistentes = new Set((existentes || []).map((p) => norm(p.nombre)));

  const creadas = [];
  const omitidas = [];

  for (const [indice, filaCruda] of filas.entries()) {
    const fila = normalizarFila(filaCruda);
    const nombre = String(fila.nombre ?? '').trim();
    const etiqueta = nombre || `(fila ${indice + 1})`;

    if (!nombre) {
      omitidas.push({ nombre: etiqueta, motivo: 'Falta el nombre / grado escolar' });
      continue;
    }
    if (nombresExistentes.has(norm(nombre))) {
      omitidas.push({ nombre: etiqueta, motivo: 'Ya existe en el catálogo' });
      continue;
    }

    const edadMin = parseEdad(fila.edad_min);
    const edadMax = parseEdad(fila.edad_max);
    const nivelLector = String(fila.nivel_lector ?? '').trim();

    if (edadMin === null || edadMax === null) {
      omitidas.push({ nombre: etiqueta, motivo: 'Edad mínima o máxima faltante o no numérica' });
      continue;
    }
    if (edadMin > edadMax) {
      omitidas.push({ nombre: etiqueta, motivo: 'La edad mínima es mayor que la máxima' });
      continue;
    }
    if (!nivelLector) {
      omitidas.push({ nombre: etiqueta, motivo: 'Falta el nivel lector' });
      continue;
    }

    const { data, error } = await admin
      .from('poblaciones_objetivo')
      .insert({
        nombre,
        edad_min: edadMin,
        edad_max: edadMax,
        nivel_lector: nivelLector,
        desarrollo_cognitivo: fila.desarrollo_cognitivo || null,
        pensamiento_logico_steam: fila.pensamiento_logico_steam || null,
        socioemocional_comunicacion: fila.socioemocional_comunicacion || null,
        created_by: auth.profile.id,
      })
      .select()
      .single();

    if (error) {
      omitidas.push({ nombre: etiqueta, motivo: error.message });
      continue;
    }
    nombresExistentes.add(norm(nombre));
    creadas.push(data);
  }

  return res.status(200).json({ creadas, omitidas });
}
