import * as XLSX from 'xlsx';
import {
  compareMaintenanceHistoryByDate,
  formatEntryId,
  maintenanceTypeLabel,
} from './equipmentHistoryModel';

function buildHeaders(includeEquipmentColumn) {
  const headers = ['Entry ID'];
  if (includeEquipmentColumn) {
    headers.push('Equipment');
  }
  headers.push(
    'Season / Off Season',
    'Year',
    'Date of Start',
    'Date of Finish',
    'Outage / Observation',
    'Action Taken',
    'Repair Cost',
    'Service',
    'Maintenance Type',
    'Provider',
    'Responsibility',
    'Remarks',
    'Photos Before',
    'Photos After',
  );
  return headers;
}

function recordToRow(record, { includeEquipmentColumn, getEquipmentLabel }) {
  const row = [formatEntryId(record.id)];

  if (includeEquipmentColumn) {
    row.push(getEquipmentLabel ? getEquipmentLabel(record) : '');
  }

  row.push(
    record.season || '',
    record.year || '',
    record.start || '',
    record.finish || '',
    record.observation || '',
    record.action || '',
    record.repairCost ?? '',
    record.service || '',
    maintenanceTypeLabel(record.maintenanceType),
    record.provider || '',
    record.responsible || '',
    record.remarks || '',
    record.photosBefore?.length || 0,
    record.photosAfter?.length || 0,
  );

  return row;
}

/**
 * Download maintenance history records as Excel (.xlsx).
 * @param {object[]} records UI history records (historyRecordFromApi shape)
 * @param {object} [options]
 * @param {string} [options.filename]
 * @param {boolean} [options.includeEquipmentColumns]
 * @param {(rec: object) => string} [options.getEquipmentLabel]
 * @param {'asc'|'desc'} [options.sortOrder='desc']
 */
export function downloadMaintenanceHistoryExcel(records = [], options = {}) {
  const {
    filename = 'Equipment_Maintenance_History.xlsx',
    includeEquipmentColumns = false,
    getEquipmentLabel,
    sortOrder = 'desc',
  } = options;

  const sorted = [...records].sort((a, b) => compareMaintenanceHistoryByDate(a, b, sortOrder));
  const headers = buildHeaders(includeEquipmentColumns);
  const rows = sorted.map((rec) => recordToRow(rec, {
    includeEquipmentColumn: includeEquipmentColumns,
    getEquipmentLabel,
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([headers, ...rows]),
    'Maintenance History',
  );
  XLSX.writeFile(wb, filename);
}
