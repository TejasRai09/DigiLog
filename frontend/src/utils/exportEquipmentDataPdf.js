import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  SPEC_SECTIONS,
  parseSpecsFromApi,
  getSubGroupMetaEntry,
  formatCommissionedDisplay,
} from './equipmentSpecModel';
import { parseScheduleFromApi, SCHEDULE_INTERVALS } from './equipmentScheduleModel';
import {
  historyRecordFromApi,
  formatDateDisplay,
  maintenanceTypeLabel,
  serviceLabel,
  compareMaintenanceHistoryByDate,
  equipmentKeysFromRecord,
} from './equipmentHistoryModel';

const MARGIN = 34;
const INK = [30, 41, 59];
const MUTED = [123, 133, 150];
const ACCENT = [37, 99, 235];
const HEAD_BG = [30, 41, 59];
const STRIPE = [246, 248, 251];
const BORDER = [226, 232, 240];

function equipmentLabelMap(options = []) {
  const map = new Map();
  options.forEach((opt) => map.set(opt.key, opt.label));
  return map;
}

function labelForKeys(keys = [], labelMap, fallback = '—') {
  if (!keys?.length) return fallback;
  const labels = keys.map((k) => labelMap.get(k)).filter(Boolean);
  return labels.length ? labels.join(', ') : fallback;
}

function pageWidthOf(doc) {
  return doc.internal.pageSize.getWidth();
}

function contentWidthOf(doc) {
  return pageWidthOf(doc) - MARGIN * 2;
}

/** Breadcrumb + equipment title, drawn once at the very top of page 1. */
function drawHeader(doc, { breadcrumbText, docTitle }) {
  const cw = contentWidthOf(doc);
  let y = MARGIN;

  if (breadcrumbText) {
    doc.setFont(undefined, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...MUTED);
    const lines = doc.splitTextToSize(breadcrumbText, cw);
    doc.text(lines, MARGIN, y);
    y += lines.length * 10 + 6;
  }

  if (docTitle) {
    doc.setFont(undefined, 'bold');
    doc.setFontSize(17);
    doc.setTextColor(...INK);
    doc.text(docTitle, MARGIN, y + 4);
    y += 20;
  }

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.75);
  doc.line(MARGIN, y + 6, MARGIN + cw, y + 6);

  return y + 22;
}

/** Section heading with a short accent underline + record count badge. */
function drawSectionTitle(doc, title, count, y) {
  doc.setFont(undefined, 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(title, MARGIN, y);

  if (count != null) {
    const titleWidth = doc.getTextWidth(title);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...ACCENT);
    doc.text(`(${count})`, MARGIN + titleWidth + 6, y);
  }

  doc.setDrawColor(...ACCENT);
  doc.setLineWidth(1.6);
  doc.line(MARGIN, y + 5, MARGIN + 34, y + 5);

  return y + 20;
}

function ensureRoom(doc, y, minHeight) {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (y + minHeight > pageHeight - MARGIN) {
    doc.addPage();
    return MARGIN;
  }
  return y;
}

const TABLE_BASE = {
  theme: 'grid',
  margin: { left: MARGIN, right: MARGIN },
  styles: {
    fontSize: 8.5,
    cellPadding: 5,
    textColor: INK,
    lineColor: BORDER,
    lineWidth: 0.6,
    valign: 'top',
  },
  headStyles: {
    fillColor: HEAD_BG,
    textColor: [255, 255, 255],
    fontStyle: 'bold',
    fontSize: 8.5,
    halign: 'left',
  },
  alternateRowStyles: { fillColor: STRIPE },
};

/** Equipment Specification: one mini table per equipment/sub-group card. */
function renderSpecsSection(doc, { rows, equipmentDefaults, specSection }, startY) {
  const { specs, subSections, subGroupMeta } = parseSpecsFromApi(rows, equipmentDefaults);
  const sectionsToRender = specSection
    ? SPEC_SECTIONS.filter((s) => s.id === specSection)
    : SPEC_SECTIONS;

  const cards = [];
  for (const sec of sectionsToRender) {
    for (const subName of subSections[sec.id] || []) {
      const cardSpecs = specs.filter((s) => s.section === sec.id && s.subSection === subName);
      if (!cardSpecs.length) continue;
      cards.push({ discipline: sec.title.replace(/^\d+\.\s*/, ''), subName, sectionId: sec.id, cardSpecs });
    }
  }

  let y = drawSectionTitle(doc, 'Equipment Specification', cards.length, startY);

  if (!cards.length) {
    doc.setFont(undefined, 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text('No specification data recorded.', MARGIN, y + 6);
    return y + 20;
  }

  for (const card of cards) {
    y = ensureRoom(doc, y, 70);
    const meta = getSubGroupMetaEntry(subGroupMeta, card.sectionId, card.subName, equipmentDefaults);

    doc.setFont(undefined, 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    doc.text(card.subName, MARGIN, y + 10);

    const metaParts = [
      meta.tagNo && `Tag: ${meta.tagNo}`,
      meta.equipNo && `No: ${meta.equipNo}`,
      meta.location && `Location: ${meta.location}`,
      meta.commissioned && `Commissioned: ${formatCommissionedDisplay(meta.commissioned)}`,
    ].filter(Boolean);

    let metaY = y + 22;
    if (metaParts.length) {
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...MUTED);
      doc.text(metaParts.join('   ·   '), MARGIN, metaY);
      metaY += 8;
    }

    autoTable(doc, {
      ...TABLE_BASE,
      startY: metaY + 4,
      head: [['Specification Parameter', 'Value']],
      body: card.cardSpecs.map((s) => [s.label, String(s.value ?? '').trim() || '—']),
      columnStyles: {
        0: { cellWidth: contentWidthOf(doc) * 0.38, fontStyle: 'bold' },
        1: { cellWidth: contentWidthOf(doc) * 0.62 },
      },
    });

    y = doc.lastAutoTable.finalY + 16;
  }

  return y;
}

/** OEM Maintenance Schedule: one table, every component + full action steps + intervals. */
function renderScheduleSection(doc, { rows, equipmentOptions }, startY) {
  const parsed = parseScheduleFromApi(rows);
  const labelMap = equipmentLabelMap(equipmentOptions);
  const showEquipment = equipmentOptions.length > 0;

  let y = drawSectionTitle(doc, 'OEM Maintenance Schedule', parsed.length, startY);

  if (!parsed.length) {
    doc.setFont(undefined, 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text('No OEM schedule recorded.', MARGIN, y + 6);
    return y + 20;
  }

  const head = [['#', ...(showEquipment ? ['Equipment'] : []), 'Component', 'Maintenance Action', 'Active Intervals']];
  const body = parsed.map((row, idx) => {
    const intervalLabels = SCHEDULE_INTERVALS
      .filter((cfg) => row.intervals.includes(cfg.key))
      .map((cfg) => cfg.fullLabel);
    return [
      String(idx + 1),
      ...(showEquipment ? [labelForKeys(row.equipmentKeys, labelMap)] : []),
      row.component || '—',
      row.actions.filter(Boolean).join('\n') || '—',
      intervalLabels.join(', ') || '—',
    ];
  });

  const cw = contentWidthOf(doc);
  const columnStyles = showEquipment
    ? {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: cw * 0.16, fontStyle: 'bold' },
        2: { cellWidth: cw * 0.2, fontStyle: 'bold' },
        3: { cellWidth: cw * 0.42 },
        4: { cellWidth: cw * 0.2 },
      }
    : {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: cw * 0.24, fontStyle: 'bold' },
        2: { cellWidth: cw * 0.52 },
        3: { cellWidth: cw * 0.24 },
      };

  autoTable(doc, {
    ...TABLE_BASE,
    startY: y,
    head,
    body,
    columnStyles,
  });

  return doc.lastAutoTable.finalY + 16;
}

/** Equipment Maintenance History: every field from the record, not just the on-screen summary. */
function renderHistorySection(doc, { rows, equipmentOptions }, startY) {
  const records = rows
    .map(historyRecordFromApi)
    .sort((a, b) => compareMaintenanceHistoryByDate(a, b, 'desc'));
  const labelMap = equipmentLabelMap(equipmentOptions);
  const showEquipment = equipmentOptions.length > 0;

  let y = drawSectionTitle(doc, 'Equipment Maintenance History', records.length, startY);

  if (!records.length) {
    doc.setFont(undefined, 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text('No maintenance history recorded.', MARGIN, y + 6);
    return y + 20;
  }

  const head = [[
    'Season', 'Year', 'Start', 'Finish',
    ...(showEquipment ? ['Equipment'] : []),
    'Type', 'Service', 'Observation', 'Action Taken', 'Cost', 'Provider', 'Responsibility', 'Remarks',
  ]];

  const body = records.map((rec) => [
    rec.season || '—',
    rec.year || '—',
    formatDateDisplay(rec.start) || '—',
    formatDateDisplay(rec.finish) || '—',
    ...(showEquipment
      ? [labelForKeys(rec.equipmentKeys?.length ? rec.equipmentKeys : equipmentKeysFromRecord(rec), labelMap)]
      : []),
    maintenanceTypeLabel(rec.maintenanceType) || '—',
    serviceLabel(rec.service) || '—',
    rec.observation || '—',
    rec.action || '—',
    rec.repairCost || '—',
    rec.provider || '—',
    rec.responsible || '—',
    rec.remarks || '—',
  ]);

  autoTable(doc, {
    ...TABLE_BASE,
    startY: y,
    head,
    body,
    styles: { ...TABLE_BASE.styles, fontSize: 7.5 },
    headStyles: { ...TABLE_BASE.headStyles, fontSize: 7.5 },
  });

  return doc.lastAutoTable.finalY + 16;
}

/**
 * Builds a clean, data-driven PDF (native tables, not a screenshot of the app)
 * for the requested equipment sections. Every record is included regardless
 * of whatever is expanded/collapsed/filtered on screen.
 *
 * @param {{
 *   selectedKeys: ('specs'|'schedule'|'history')[],
 *   breadcrumbText?: string,
 *   docTitle?: string,
 *   fileName?: string,
 *   specs: { rows: any[], equipmentDefaults: object, specSection: string|null },
 *   schedule: { rows: any[], equipmentOptions: {key,label}[] },
 *   history: { rows: any[], equipmentOptions: {key,label}[] },
 * }} options
 */
export async function exportEquipmentDataToPdf(options) {
  const { selectedKeys, breadcrumbText, docTitle, fileName, specs, schedule, history } = options;
  if (!selectedKeys?.length) throw new Error('Nothing selected to export.');

  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  let y = drawHeader(doc, { breadcrumbText, docTitle });

  const renderers = {
    specs: () => renderSpecsSection(doc, specs, y),
    schedule: () => renderScheduleSection(doc, schedule, y),
    history: () => renderHistorySection(doc, history, y),
  };

  let firstSection = true;
  for (const key of selectedKeys) {
    const render = renderers[key];
    if (!render) continue;
    if (!firstSection) {
      doc.addPage();
      y = MARGIN;
    }
    y = render();
    firstSection = false;
  }

  doc.save(fileName || 'equipment-details.pdf');
}
