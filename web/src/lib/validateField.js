// Réplica en el cliente de api/_lib/validation.js (regla propia del campo +
// validaciones globales del proyecto) para dar feedback inmediato al perder
// el foco. El backend sigue siendo la fuente de verdad.
export function validateFieldClient(field, value, globalValidations = []) {
  const errors = [];
  const strValue = Array.isArray(value) ? value.join(', ') : String(value ?? '');

  if (field.required) {
    const empty =
      value === undefined ||
      value === null ||
      strValue.trim() === '' ||
      (Array.isArray(value) && value.length === 0);
    if (empty) errors.push('Este campo es obligatorio.');
  }

  if (field.type === 'tabla_dinamica' && Array.isArray(value)) {
    if (field.max_filas && value.length > Number(field.max_filas)) {
      errors.push(`Máximo ${field.max_filas} filas.`);
    }
    errors.push(...validateTableRows(field.columnas || [], value));
  }

  const v = field.validation;
  if (v?.enabled) {
    if (v.min_length && strValue.length < Number(v.min_length)) {
      errors.push(`La longitud mínima es de ${v.min_length} caracteres.`);
    }
    if (v.max_length && strValue.length > Number(v.max_length)) {
      errors.push(`La longitud máxima permitida es de ${v.max_length} caracteres.`);
    }
    if (v.pattern) {
      const ok = testPattern(v.pattern, strValue, v.mode || 'must_match');
      if (!ok) {
        errors.push(v.custom_message?.trim() || `No cumple la regla de validación: ${v.description || 'formato inválido'}`);
      }
    }
  }

  for (const gv of globalValidations) {
    if (!gv.activo) continue;
    const ok = testPattern(gv.pattern, strValue, gv.mode || 'must_not_match');
    if (!ok) {
      errors.push(`Validación global incumplida: ${gv.descripcion}`);
    }
  }

  return errors;
}

function validateTableRows(columnas, rows) {
  const errors = [];
  rows.forEach((row, rowIdx) => {
    columnas.forEach((col) => {
      const v = col.validation;
      if (!v?.enabled) return;
      const cellValue = String(row?.[col.variable] ?? '');
      if (v.min_length && cellValue.length < Number(v.min_length)) {
        errors.push(`Fila ${rowIdx + 1}, ${col.etiqueta}: la longitud mínima es de ${v.min_length} caracteres.`);
      }
      if (v.max_length && cellValue.length > Number(v.max_length)) {
        errors.push(`Fila ${rowIdx + 1}, ${col.etiqueta}: la longitud máxima permitida es de ${v.max_length} caracteres.`);
      }
      if (v.pattern) {
        const ok = testPattern(v.pattern, cellValue, v.mode || 'must_match');
        if (!ok) {
          errors.push(
            `Fila ${rowIdx + 1}, ${col.etiqueta}: ${
              v.custom_message?.trim() || `no cumple la regla de validación: ${v.description || 'formato inválido'}`
            }`
          );
        }
      }
    });
  });
  return errors;
}

function testPattern(pattern, value, mode) {
  try {
    const rx = new RegExp(pattern, 'i');
    const matches = rx.test(value);
    return mode === 'must_not_match' ? !matches : matches;
  } catch {
    // patrón inválido: no bloquear al usuario por un error de configuración
    return true;
  }
}
