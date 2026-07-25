const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getToken() {
  return localStorage.getItem('methodya_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('methodya_token', token);
  else localStorage.removeItem('methodya_token');
}

// Para descargas binarias (ej. un PDF) que no pueden pasar por request(),
// que siempre intenta parsear JSON.
export function apiUrl(path) {
  return `${BASE_URL}/api${path}`;
}

export function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const resp = await fetch(`${BASE_URL}/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await resp.json();
  } catch {
    // respuesta vacía
  }

  if (!resp.ok) {
    const err = new Error(json?.error || `Error ${resp.status}`);
    err.status = resp.status;
    err.errors = json?.errors;
    throw err;
  }
  return json;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path, body) => request(path, { method: 'DELETE', body }),
};
