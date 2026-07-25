// Contexto/guía editorial y pedagógica de un proyecto (parametrización): NO
// son reglas duras (eso es global_validations, regex que bloquean), es
// texto de apoyo para humanos y, a futuro, contexto para prompts de IA.

const isString = (v) => v === undefined || v === null || typeof v === 'string';
const isStringArray = (v) => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
const isNumberOrNull = (v) => v === undefined || v === null || typeof v === 'number';
const isPlainObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// Validación laxa: nada es obligatorio, solo se exige que lo que venga tenga
// el tipo correcto. Devuelve un arreglo de errores (vacío si todo calza).
export function validateParametrizacionShape(body) {
  if (body === undefined || body === null) return [];
  if (!isPlainObject(body)) return ['El cuerpo debe ser un objeto'];

  const errors = [];
  const { estilo, pedagogia, temas_focos, poblacion_objetivo, ...rest } = body;
  if (Object.keys(rest).length > 0) {
    errors.push(`Claves no reconocidas: ${Object.keys(rest).join(', ')}`);
  }

  if (estilo !== undefined) {
    if (!isPlainObject(estilo)) errors.push('estilo debe ser un objeto');
    else {
      if (!isString(estilo.tono)) errors.push('estilo.tono debe ser texto');
      if (!isString(estilo.nivel_formalidad)) errors.push('estilo.nivel_formalidad debe ser texto');
      if (!isString(estilo.terminologia_preferida)) errors.push('estilo.terminologia_preferida debe ser texto');
      if (!isString(estilo.terminologia_evitar)) errors.push('estilo.terminologia_evitar debe ser texto');
    }
  }

  if (pedagogia !== undefined) {
    if (!isPlainObject(pedagogia)) errors.push('pedagogia debe ser un objeto');
    else {
      if (!isString(pedagogia.enfoque)) errors.push('pedagogia.enfoque debe ser texto');
      if (!isString(pedagogia.lineamientos)) errors.push('pedagogia.lineamientos debe ser texto');
    }
  }

  if (temas_focos !== undefined) {
    if (!isPlainObject(temas_focos)) errors.push('temas_focos debe ser un objeto');
    else {
      if (!isStringArray(temas_focos.temas)) errors.push('temas_focos.temas debe ser una lista de textos');
      if (!isString(temas_focos.descripcion)) errors.push('temas_focos.descripcion debe ser texto');
    }
  }

  if (poblacion_objetivo !== undefined) {
    if (!isPlainObject(poblacion_objetivo)) errors.push('poblacion_objetivo debe ser un objeto');
    else {
      if (!isNumberOrNull(poblacion_objetivo.edad_min)) errors.push('poblacion_objetivo.edad_min debe ser numérico');
      if (!isNumberOrNull(poblacion_objetivo.edad_max)) errors.push('poblacion_objetivo.edad_max debe ser numérico');
      if (!isString(poblacion_objetivo.region_contexto)) errors.push('poblacion_objetivo.region_contexto debe ser texto');
      if (!isStringArray(poblacion_objetivo.idiomas)) errors.push('poblacion_objetivo.idiomas debe ser una lista de textos');
      if (!isString(poblacion_objetivo.nivel_lector)) errors.push('poblacion_objetivo.nivel_lector debe ser texto');
    }
  }

  return errors;
}

function line(label, value) {
  if (value === undefined || value === null || value === '') return null;
  return `${label}: ${value}`;
}

// Arma un bloque de texto legible en español a partir del JSON de
// parametrización. Pensado para usarse a futuro como contexto en prompts de
// IA (no se conecta a nada todavía).
export function buildContextText(parametrizacion) {
  const p = parametrizacion || {};
  const blocks = [];

  const estiloLines = [
    line('Tono', p.estilo?.tono),
    line('Nivel de formalidad', p.estilo?.nivel_formalidad),
    line('Terminología preferida', p.estilo?.terminologia_preferida),
    line('Terminología a evitar', p.estilo?.terminologia_evitar),
  ].filter(Boolean);
  if (estiloLines.length) blocks.push(['Estilo', estiloLines]);

  const pedagogiaLines = [
    line('Enfoque pedagógico', p.pedagogia?.enfoque),
    line('Lineamientos', p.pedagogia?.lineamientos),
  ].filter(Boolean);
  if (pedagogiaLines.length) blocks.push(['Pedagogía', pedagogiaLines]);

  const temasLines = [
    p.temas_focos?.temas?.length ? line('Temas', p.temas_focos.temas.join(', ')) : null,
    line('Descripción', p.temas_focos?.descripcion),
  ].filter(Boolean);
  if (temasLines.length) blocks.push(['Temas y focos', temasLines]);

  const edadMin = p.poblacion_objetivo?.edad_min;
  const edadMax = p.poblacion_objetivo?.edad_max;
  const edad = edadMin != null || edadMax != null ? `${edadMin ?? '?'} a ${edadMax ?? '?'} años` : null;
  const poblacionLines = [
    line('Rango de edad', edad),
    line('Región/contexto', p.poblacion_objetivo?.region_contexto),
    p.poblacion_objetivo?.idiomas?.length ? line('Idiomas', p.poblacion_objetivo.idiomas.join(', ')) : null,
    line('Nivel lector', p.poblacion_objetivo?.nivel_lector),
  ].filter(Boolean);
  if (poblacionLines.length) blocks.push(['Población objetivo', poblacionLines]);

  if (blocks.length === 0) return '';
  return blocks.map(([title, lines]) => `${title}:\n${lines.map((l) => `- ${l}`).join('\n')}`).join('\n\n');
}
