import { withCors, ApiError } from '../_lib/cors.js';
import { requireAuth, requireAdmin } from '../_lib/auth.js';
import { getDb } from '../_lib/mongo.js';
import { ensureTituloField, normalizePrefijo } from '../_lib/subformDefaults.js';

// Biblioteca global de subformularios reutilizables entre proyectos.
export default withCors(async (req, res) => {
  const auth = await requireAuth(req);
  const db = await getDb();

  if (req.method === 'GET') {
    const subforms = await db.collection('subforms').find({}).sort({ created_at: -1 }).toArray();
    return res.status(200).json({ subforms });
  }

  if (req.method === 'POST') {
    requireAdmin(auth);
    const { nombre, descripcion, prefijo, fields } = req.body || {};
    if (!nombre) throw new ApiError(400, 'nombre es obligatorio');
    const normalizedPrefijo = normalizePrefijo(prefijo);
    if (!normalizedPrefijo) {
      throw new ApiError(400, 'prefijo es obligatorio: máximo 5 caracteres, solo letras, números, "-" o "_"');
    }
    const doc = {
      nombre,
      descripcion: descripcion || '',
      prefijo: normalizedPrefijo,
      fields: ensureTituloField(fields),
      created_by: auth.profile.id,
      created_at: new Date(),
    };
    const result = await db.collection('subforms').insertOne(doc);
    return res.status(201).json({ subform: { ...doc, _id: result.insertedId } });
  }

  throw new ApiError(405, 'Método no permitido');
});
