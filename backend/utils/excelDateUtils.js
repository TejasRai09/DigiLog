const xlsx = require('xlsx');

function excelDateToISO(excelDate) {
  if (!excelDate) return null;
  if (excelDate instanceof Date && !Number.isNaN(excelDate.getTime())) {
    const y = excelDate.getUTCFullYear();
    const m = String(excelDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(excelDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof excelDate === 'string') {
    const s = excelDate.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    if (s.includes('-')) {
      const parts = s.split('-');
      if (parts[0].length === 4) return parts.slice(0, 3).join('-');
      if (parts[2] && parts[2].length >= 4) {
        return `${parts[2].slice(0, 4)}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    if (s.includes('/')) {
      const parts = s.split('/');
      if (parts[2] && parts[2].length >= 4) {
        return `${parts[2].slice(0, 4)}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return s.slice(0, 10);
  }
  if (typeof excelDate === 'number') {
    const dateObj = xlsx.SSF.parse_date_code(excelDate);
    if (!dateObj) return null;
    const y = dateObj.y;
    const m = String(dateObj.m).padStart(2, '0');
    const d = String(dateObj.d).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

function minMaxDates(dates) {
  const valid = (dates || []).filter(Boolean).sort();
  if (!valid.length) return { min: null, max: null };
  return { min: valid[0], max: valid[valid.length - 1] };
}

module.exports = { excelDateToISO, minMaxDates };
