import { Client } from '@upstash/qstash';

let _client = null;

// Cliente de Upstash QStash (cola de mensajes durable) para la generación
// asíncrona del agente sintético: api/documents/[id]/generate.js publica un
// mensaje y responde de inmediato; QStash llama después a
// generate-worker.js, que es quien hace el trabajo real contra Gemini sin
// que nadie esté esperando con el navegador abierto.
//
// El SDK lee QSTASH_URL del entorno por su cuenta (hace falta si la cuenta
// de Upstash está en una región distinta a la de por defecto), así que aquí
// solo se pasa el token.
export function qstashClient() {
  if (!_client) {
    _client = new Client({ token: process.env.QSTASH_TOKEN });
  }
  return _client;
}

// La URL pública de ESTE backend, a la que QStash debe llamar de vuelta.
// Distinta por ambiente (local: URL del túnel; staging/producción: el
// dominio de cada proyecto de Vercel), por eso es variable de entorno y no
// algo derivable del request.
export function workerUrl(path) {
  const base = (process.env.PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
  const secret = process.env.GENERATE_WORKER_SECRET || '';
  return `${base}${path}?secret=${encodeURIComponent(secret)}`;
}

// El worker es un endpoint interno (nunca se expone en la UI): se protege
// con un secreto propio en la URL, no con la verificación de firma de
// QStash, para no depender de preservar el body crudo de la petición
// -algo que el runtime de Vercel puede alterar-.
export function assertWorkerSecret(req) {
  const expected = process.env.GENERATE_WORKER_SECRET;
  return !!expected && req.query?.secret === expected;
}
