import { MongoClient, ObjectId } from 'mongodb';

let _client = null;
let _db = null;

// Reutiliza la conexión entre invocaciones "warm" de la función serverless.
export async function getDb() {
  if (_db) return _db;
  _client = new MongoClient(process.env.MONGODB_URI);
  await _client.connect();
  _db = _client.db(process.env.MONGODB_DB || 'methodya');
  await ensureIndexes(_db);
  return _db;
}

// Índices que la app da por hechos para evitar condiciones de carrera (no
// solo de rendimiento) — sin ellos, "liberar" un documento/instancia dos
// veces casi al mismo tiempo solo lo evita un chequeo a nivel de aplicación
// (findOne antes del insertOne), que no es atómico. createIndex es
// idempotente (si ya existe igual, no hace nada), así que es seguro
// correrlo cada vez que la conexión se establece de cero — solo pasa una
// vez por arranque en frío de la función, no en cada invocación (por el
// caché de _db de arriba). Se autoaplica en cualquier entorno sin migración
// manual (local, staging, producción) apenas ese backend vuelva a arrancar.
async function ensureIndexes(db) {
  await Promise.all([
    // Un documento solo puede liberarse a implementación una vez (no hay
    // papelera/re-liberación para este caso, a diferencia de multimedia).
    db.collection('document_implementations').createIndex({ document_id: 1 }, { unique: true }),
    // Parcial (no simple): el flujo permite volver a liberar una instancia
    // de subformulario después de que su liberación anterior se envió a la
    // papelera (estado 'Eliminado') — mismo criterio que ya usa
    // api/documents/[id]/subforms/release.js para su chequeo de duplicados.
    // Los índices parciales de Mongo no soportan $ne (solo $eq/$exists/$gt.../
    // $and de nivel superior), así que se listan explícitamente los estados
    // "activos" con $in en vez de negar 'Eliminado'.
    db.collection('subform_assignments').createIndex(
      { document_id: 1, field_variable: 1, instance_id: 1 },
      {
        unique: true,
        partialFilterExpression: { estado: { $in: ['Asignado', 'En proceso', 'Finalizado'] } },
      }
    ),
  ]);
}

export { ObjectId };

export function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}
