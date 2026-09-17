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

/**
 * Map expected headers to file column indexes by name (order-independent).
 * Duplicate names match in left-to-right occurrence order (1st BAGASSE → 1st BAGASSE).
 * Extra file columns are ignored. Missing expected names throw.
 * @returns {number[]} file column index for each expected header
 */
function mapHeadersByName(fileHeaders, expectedHeaders, label = 'file') {
  const actual = (fileHeaders || []).map((h) => String(h ?? '').trim());
  const expected = (expectedHeaders || []).map((h) => String(h ?? '').trim());

  const queues = new Map();
  actual.forEach((name, i) => {
    if (!name) return;
    if (!queues.has(name)) queues.set(name, []);
    queues.get(name).push(i);
  });

  const indexes = [];
  const missing = [];
  for (const exp of expected) {
    if (!exp) {
      indexes.push(null);
      continue;
    }
    const q = queues.get(exp);
    if (!q || !q.length) {
      missing.push(exp);
      indexes.push(null);
      continue;
    }
    indexes.push(q.shift());
  }

  if (missing.length) {
    const uniqueMissing = [...new Set(missing)];
    throw new ColumnValidationError(
      `Missing column names in ${label} (${uniqueMissing.length}): ${formatMismatches(
        uniqueMissing.map((expected) => ({ expected, actual: null })),
      )}. Extra or reordered columns are allowed; required names must match the template.`,
      {
        missing: uniqueMissing,
        expectedCount: expected.filter(Boolean).length,
        actualCount: actual.filter(Boolean).length,
      },
    );
  }

  return indexes;
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
  mapHeadersByName,
  headersFromSheet,
};
