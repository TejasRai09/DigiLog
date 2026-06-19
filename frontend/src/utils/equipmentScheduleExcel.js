import * as XLSX from 'xlsx';
import { SCHEDULE_INTERVALS } from './equipmentScheduleModel';

function parseActionsCell(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  if (text.includes('||')) {
    return text.split('||').map((s) => s.trim()).filter(Boolean);
  }
  return text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

export function downloadScheduleTemplate(filename = 'OEM_Maintenance_Schedule_Template.xlsx') {
  const wb = XLSX.utils.book_new();

  const intro = [
    ['OEM Maintenance Schedule Template Guide'],
    [],
    ['Column A: Component', 'Machine component name'],
    ['Column B: Maintenance Actions', 'Separate steps with newline or ||'],
    ['Columns C–I: Frequencies', 'Set Y for active interval, N otherwise'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(intro), 'Instructions');

  const headers = ['Component', 'Maintenance Actions', ...SCHEDULE_INTERVALS.map((c) => c.key)];
  const sample = [
    ['Turbine rotor', 'Clean blades.\nInspect root attachments.', 'N', 'N', 'N', 'N', 'Y', 'N', 'N'],
    ['Control Valves', 'Dismantle throat valves. || Replace packings.', 'Y', 'N', 'N', 'N', 'N', 'N', 'N'],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers, ...sample]), 'Maintenance Schedule');

  XLSX.writeFile(wb, filename);
}

/** @returns {{ previewRows: Array, error?: string }} */
export function parseScheduleWorkbook(arrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheetName = workbook.SheetNames.find((n) => {
    const lower = n.toLowerCase();
    return lower.includes('schedule') || lower.includes('maintenance');
  }) || workbook.SheetNames[0];

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
  if (rows.length <= 1) return { error: 'No schedule items found in the spreadsheet.' };

  const previewRows = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row?.length || row.every((v) => !String(v ?? '').trim())) {
      previewRows.push({
        index: i,
        component: '[Empty Row]',
        actions: [],
        intervals: [],
        status: 'skipped',
        reason: 'Completely blank row',
      });
      continue;
    }

    const component = String(row[0] || '').trim();
    if (!component) {
      previewRows.push({
        index: i,
        component: '[BLANK]',
        actions: [],
        intervals: [],
        status: 'skipped',
        reason: 'Missing component name',
      });
      continue;
    }

    let actions = parseActionsCell(row[1]);
    let wasActionEmpty = false;
    if (!actions.length) {
      actions = ['General inspection & check.'];
      wasActionEmpty = true;
    }

    const intervals = [];
    SCHEDULE_INTERVALS.forEach((cfg, idx) => {
      const val = String(row[2 + idx] || '').trim().toUpperCase();
      if (val === 'Y') intervals.push(cfg.key);
    });

    let status = 'success';
    let reason = 'Ready to import';
    if (!intervals.length) {
      status = 'warning';
      reason = "Warning: No frequency set to 'Y'";
    } else if (intervals.length > 1) {
      status = 'warning';
      reason = `Warning: Multiple frequencies (${intervals.join(', ')})`;
    } else if (wasActionEmpty) {
      status = 'warning';
      reason = 'Warning: Action empty; default step assigned';
    }

    previewRows.push({ index: i, component, actions, intervals, status, reason });
  }

  if (!previewRows.some((r) => r.status === 'success' || r.status === 'warning')) {
    return { error: 'No valid schedule rows were found in the uploaded file.' };
  }

  return { previewRows };
}

export function previewRowsToSchedule(previewRows) {
  return previewRows
    .filter((r) => r.status === 'success' || r.status === 'warning')
    .map((row, idx) => ({
      id: `imported-${Date.now()}-${idx}`,
      no: idx + 1,
      component: row.component,
      actions: row.actions,
      intervals: row.intervals,
    }));
}
