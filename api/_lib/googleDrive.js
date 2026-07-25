import { getGoogleAccessToken } from './googleAuth.js';
import { ApiError } from './cors.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

// Acepta una URL típica de Google Drive (carpeta o archivo) o directamente
// un ID ya extraído, y devuelve el ID. Soporta los formatos más comunes:
//   https://drive.google.com/drive/folders/<ID>
//   https://drive.google.com/file/d/<ID>/view
//   https://docs.google.com/document/d/<ID>/edit
//   https://docs.google.com/presentation/d/<ID>/edit
//   ...?id=<ID>
export function extractDriveId(urlOrId) {
  if (!urlOrId) return null;
  const value = urlOrId.trim();
  const patterns = [/\/folders\/([a-zA-Z0-9_-]+)/, /\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];
  for (const re of patterns) {
    const m = value.match(re);
    if (m) return m[1];
  }
  // Si no coincide con ninguna URL conocida, asumimos que ya es el ID.
  return /^[a-zA-Z0-9_-]+$/.test(value) ? value : null;
}

async function driveFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await getGoogleAccessToken();
  const resp = await fetch(`${DRIVE_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...headers },
    body,
  });
  if (!resp.ok) {
    let message = `Google Drive respondió con error ${resp.status}`;
    try {
      const errBody = await resp.json();
      message = errBody?.error?.message || message;
    } catch {
      // ignore, cuerpo no era JSON
    }
    throw new ApiError(502, `Google Drive: ${message}`);
  }
  return resp;
}

// Verifica que la carpeta exista y que la cuenta de servicio tenga permiso
// de escribir dentro de ella (crear subcarpetas/archivos).
export async function checkFolderWriteAccess(folderId) {
  try {
    const resp = await driveFetch(
      `/files/${folderId}?fields=id,name,mimeType,capabilities(canAddChildren,canEdit)&supportsAllDrives=true`
    );
    const data = await resp.json();
    const canWrite = !!(data.capabilities?.canAddChildren || data.capabilities?.canEdit);
    return { ok: canWrite, name: data.name, folderId: data.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Busca una subcarpeta por nombre dentro de parentId; si no existe, la crea.
export async function findOrCreateSubfolder(parentId, name) {
  const escapedName = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `name='${escapedName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const listResp = await driveFetch(`/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
  const listData = await listResp.json();
  if (listData.files?.length > 0) return listData.files[0].id;

  const createResp = await driveFetch('/files?supportsAllDrives=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
  });
  const created = await createResp.json();
  return created.id;
}

// Crea una copia de fileId dentro de parentId (la plantilla original nunca
// se modifica, solo se lee/copia).
export async function copyFile(fileId, name, parentId) {
  const resp = await driveFetch(`/files/${fileId}/copy?supportsAllDrives=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, parents: [parentId] }),
  });
  return resp.json();
}

export async function getFile(fileId) {
  const resp = await driveFetch(`/files/${fileId}?fields=id,name,mimeType,webViewLink&supportsAllDrives=true`);
  return resp.json();
}

// Envía un archivo a la papelera de Drive (no lo borra permanentemente).
export async function trashFile(fileId) {
  await driveFetch(`/files/${fileId}?supportsAllDrives=true`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: true }),
  });
}

// Crea un archivo Drive vacío del tipo indicado (ej. un Google Doc en
// blanco: mimeType 'application/vnd.google-apps.document'), listo para
// rellenarlo por la API de Docs/Slides.
export async function createFile(name, mimeType, parentId) {
  const resp = await driveFetch('/files?supportsAllDrives=true&fields=id,name,mimeType,webViewLink', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType, parents: [parentId] }),
  });
  return resp.json();
}

export async function renameFile(fileId, name) {
  const resp = await driveFetch(`/files/${fileId}?supportsAllDrives=true&fields=id,name`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return resp.json();
}

// Inicia una sesión de subida resumible: el navegador sube el archivo
// DIRECTO a la URL devuelta (sin pasar por nuestro backend), evitando los
// límites de tamaño de payload del hosting serverless para archivos
// grandes (videos). El backend nunca ve los bytes del archivo.
export async function startResumableUpload({ name, mimeType, parentId, sizeBytes }) {
  const token = await getGoogleAccessToken();
  const resp = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,mimeType`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': mimeType || 'application/octet-stream',
        ...(sizeBytes ? { 'X-Upload-Content-Length': String(sizeBytes) } : {}),
      },
      body: JSON.stringify({ name, parents: [parentId] }),
    }
  );
  if (!resp.ok) {
    let message = `Google Drive respondió con error ${resp.status} al iniciar la subida`;
    try {
      const errBody = await resp.json();
      message = errBody?.error?.message || message;
    } catch {
      // ignore, cuerpo no era JSON
    }
    throw new ApiError(502, `Google Drive: ${message}`);
  }
  const uploadUrl = resp.headers.get('location');
  if (!uploadUrl) throw new ApiError(502, 'Google Drive no devolvió la URL de subida');
  return uploadUrl;
}

// Exporta un Google Doc/Slides ya existente a PDF usando la conversión
// nativa de Drive (no requiere ninguna librería de generación de PDF).
export async function exportAsPdf(fileId) {
  const resp = await driveFetch(`/files/${fileId}/export?mimeType=application/pdf`);
  return Buffer.from(await resp.arrayBuffer());
}

// Sube un PDF (ya generado con exportAsPdf) como archivo nuevo dentro de
// parentId. Usa upload multipart/related "a mano" (metadata JSON + bytes),
// que es el formato mínimo que acepta la API de Drive sin depender de una
// librería de multipart.
export async function uploadPdf(name, pdfBuffer, parentId) {
  const token = await getGoogleAccessToken();
  const boundary = `methodya-${Date.now()}`;
  const metadata = JSON.stringify({ name, parents: [parentId], mimeType: 'application/pdf' });
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
        `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`,
      'utf-8'
    ),
    pdfBuffer,
    Buffer.from(`\r\n--${boundary}--`, 'utf-8'),
  ]);

  const resp = await fetch(
    `${DRIVE_UPLOAD_API}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,webViewLink`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }
  );
  if (!resp.ok) {
    let message = `Google Drive respondió con error ${resp.status} al subir el PDF`;
    try {
      const errBody = await resp.json();
      message = errBody?.error?.message || message;
    } catch {
      // ignore, cuerpo no era JSON
    }
    throw new ApiError(502, `Google Drive: ${message}`);
  }
  return resp.json();
}

