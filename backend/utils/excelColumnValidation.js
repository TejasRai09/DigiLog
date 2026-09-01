const xlsx = require('xlsx');

class ColumnValidationError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ColumnValidationError';
    this.details = details;
  }
}

function formatMismatches(mismatches, limit = 15) {
  const preview = mismatches
    .slice(0, limit)
    .map((m) => {
      if (m.index != null) {
        return `Col ${m.index}: expected "${m.expected}", got "${m.actual}"`;
      }
      return `Expected "${m.expected}"${m.actual ? `, got "${m.actual}"` : ' (missing)'}`;
    })
    .join('; ');
  return `${preview}${mismatches.length > limit ? '…' : ''}`;
}

/** Positional header match (DMR template). */
function validateExactHeaders(fileHeaders, expectedHeaders, label = 'file') {
  const errors = [];
  const expected = expectedHeaders.map((h) => String(h ?? '').trim());
  const actual = (fileHeaders || []).map((h) => String(h ?? '').trim());

  if (actual.length < expected.length) {
    errors.push(
      `Column count mismatch: ${label} has ${actual.filter(Boolean).length} headers, expected ${expected.filter(Boolean).length}.`,
    );
  }

  const len = Math.max(expected.length, actual.length);
  const mismatches = [];
  for (let i = 0; i < len; i += 1) {
    const exp = (expected[i] || '').trim();
    const act = (actual[i] || '').trim();
    if (!exp && !act) continue;
    if (exp !== act) {
      mismatches.push({ index: i + 1, expected: exp || '(empty)', actual: act || '(empty)' });
    }
  }

  if (mismatches.length) {
    errors.push(`Column name mismatch (${mismatches.length} columns): ${formatMismatches(mismatches)}`);
  }

  if (errors.length) {
    throw new ColumnValidationError(errors.join(' '), { mismatches, expectedCount: expected.length, actualCount: actual.length });
  }
}

/** Required column names for sheet_to_json imports (order-independent). */
function validateRequiredHeaders(actualHeaders, expectedHeaders, label = 'file') {
  const actualSet = new Set((actualHeaders || []).map((h) => String(h ?? '').trim()).filter(Boolean));
  const mismatches = [];

  for (const expected of expectedHeaders) {
    const exp = String(expected ?? '').trim();
    if (!exp) continue;
    if (!actualSet.has(exp)) {
      mismatches.push({ expected: exp, actual: null });
    }
  }

  if (mismatches.length) {
    const found = [...actualSet].join(', ') || '(none)';
    const required = expectedHeaders.map((h) => String(h ?? '').trim()).filter(Boolean).join(', ');
    const msg =
      `Missing or incorrect column names in ${label} (${mismatches.length}): ${formatMismatches(mismatches)}. ` +
      `Found columns: ${found}. Required columns: ${required}.`;
    throw new ColumnValidationError(msg, { mismatches, expectedCount: expectedHeaders.length, actualCount: actualSet.size });
  }
}

function headersFromSheet(wb, sheetName) {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  const headerRow = matrix[0] || [];
  return headerRow.map((h) => String(h ?? '').trim());
}

module.exports = {
  ColumnValidationError,
  validateExactHeaders,
  validateRequiredHeaders,
  headersFromSheet,
};
