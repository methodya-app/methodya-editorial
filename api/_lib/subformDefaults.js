// Reglas comunes a la biblioteca de subformularios: todo subformulario tiene
// un campo "Título" fijo y obligatorio, y un "prefijo" (máx. 5 caracteres)
// usado para generar el código de cada instancia dentro de un documento
// (ej: G1-001-VID-1).

export const PREFIJO_REGEX = /^[A-Za-z0-9_-]{1,5}$/;

export const TITULO_FIELD = {
  id: 'field_titulo',
  label: 'Título',
  variable: 'titulo',
  type: 'text',
  required: true,
  placeholder: '',
  instrucciones: 'Escribe un título breve que identifique esta instancia (ej: nombre del recurso).',
  options: [],
  validation: {
    enabled: false,
    description: '',
    pattern: '',
    mode: 'must_match',
    min_length: '',
    max_length: '',
    custom_message: '',
  },
};

// Garantiza que el campo "Título" esté presente, primero en la lista, y con
// sus reglas fijas (no se puede quitar ni cambiar de tipo).
export function ensureTituloField(fields) {
  const rest = (fields || []).filter((f) => f.variable !== 'titulo');
  return [TITULO_FIELD, ...rest];
}

export function normalizePrefijo(prefijo) {
  if (!prefijo || typeof prefijo !== 'string' || !PREFIJO_REGEX.test(prefijo)) return null;
  return prefijo.toUpperCase();
}
