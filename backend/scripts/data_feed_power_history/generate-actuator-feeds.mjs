/**
 * Generate motorized-actuator feed JSON files from power_data.json (instrument section).
 * Only tags with an existing hierarchy card are written; others are reported as unmapped.
 *
 * Run (from backend/): npm run db:generate-actuator-feeds
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEED_DIR = path.join(__dirname, 'feed-data');
const POWER_DATA = path.resolve(__dirname, '../../../../power_data.json');

const ROOT = 'Power Plant';

/** Sheet titles that use -2024 suffix (remainder default to -2025). */
const SHEET_YEAR_2024 = new Set([
  'MS-100', 'LPS-05', 'SB-02', 'LPS-22', 'MPS-07', 'MPS-13', 'MPS-14',
  'AD-12', 'LPS-32', 'MOV-411', 'PCW-14', 'PCW-15', 'PCW-42', 'PCW-43',
  'PCW-44', 'MS-67A',
]);

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function sheetName(tag) {
  const year = SHEET_YEAR_2024.has(tag) ? '2024' : '2025';
  return `${tag}-${year}`;
}

function pathFor(category, subcategory, card) {
  return `${ROOT} > ${category} > ${subcategory} > ${card}`;
}

/** tag → { hierarchy_card, category, subcategory } — existing hierarchy nodes only */
const HIERARCHY_BY_TAG = {
  // 150TPH BLR > Auxiliary Equipment
  'PFW-62': { hierarchy_card: 'BFP -01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-62A': { hierarchy_card: 'BFP -01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-63': { hierarchy_card: 'BFP -02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-63A': { hierarchy_card: 'BFP -02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-64': { hierarchy_card: 'BFP -03', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-64A': { hierarchy_card: 'BFP -03', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-264': { hierarchy_card: 'BFP -04', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-264A': { hierarchy_card: 'BFP -04', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-79': { hierarchy_card: 'HP-01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-79A': { hierarchy_card: 'HP-01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-84': { hierarchy_card: 'HP-01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-84A': { hierarchy_card: 'HP-01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-89': { hierarchy_card: 'HP-01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-89A': { hierarchy_card: 'HP-01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-90': { hierarchy_card: 'HP-02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-90A': { hierarchy_card: 'HP-02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-95': { hierarchy_card: 'HP-02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-95A': { hierarchy_card: 'HP-02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-100': { hierarchy_card: 'HP-02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PFW-100A': { hierarchy_card: 'HP-02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'PDW-38': { hierarchy_card: 'Deaerator', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'LPS-22': { hierarchy_card: 'Deaerator', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'MS-87': { hierarchy_card: 'Deaerator', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'AD-12': { hierarchy_card: 'FD Fan -01', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },
  'AD-13': { hierarchy_card: 'FD Fan -02', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' },

  // 150TPH BLR > Pressure Parts
  'PFW-133': { hierarchy_card: 'Economizer', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'PFW-133A': { hierarchy_card: 'Economizer', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-14': { hierarchy_card: 'Headers', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-16': { hierarchy_card: 'Superheater Tubes (LTSH)', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-18': { hierarchy_card: 'Superheater Tubes (LTSH)', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-103': { hierarchy_card: 'Superheater Tubes (LTSH)', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-21': { hierarchy_card: 'Superheater Tubes (RSH)', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-105': { hierarchy_card: 'Superheater Tubes (RSH)', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-107': { hierarchy_card: 'Superheater Tubes (FSH)', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-109': { hierarchy_card: 'Superheater Tubes (FSH)', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-20': { hierarchy_card: 'Attemperator-01', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-24': { hierarchy_card: 'Attemperator-02', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-27': { hierarchy_card: 'EMRV', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-27A': { hierarchy_card: 'EMRV', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-28': { hierarchy_card: 'EMRV', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-28A': { hierarchy_card: 'EMRV', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-30': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-43': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-44': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-81': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-81A': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MS-85': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'PFW-111': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'PFW-111A': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'PFW-112': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'PFW-112A': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'PFW-113': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'PFW-113A': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },
  'MOV-103': { hierarchy_card: 'Steam Piping', category: '150TPH BLR', subcategory: 'Pressure Parts' },

  // 30.85MW STG > Turbine
  'MOV-100': { hierarchy_card: 'Bleed-1', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-101': { hierarchy_card: 'Bleed-2', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-102': { hierarchy_card: 'Bleed-2', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-401': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-402': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-403': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-404': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-405': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-406': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-407': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-408': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-411': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-204': { hierarchy_card: 'Ejector', category: '30.85MW STG', subcategory: 'Turbine' },
  'MS-66': { hierarchy_card: 'GVC', category: '30.85MW STG', subcategory: 'Turbine' },
  'MS-67': { hierarchy_card: 'GVC', category: '30.85MW STG', subcategory: 'Turbine' },
  'MS-67A': { hierarchy_card: 'GVC', category: '30.85MW STG', subcategory: 'Turbine' },
  'MS-79': { hierarchy_card: 'GVC', category: '30.85MW STG', subcategory: 'Turbine' },
  'LPS-32': { hierarchy_card: 'GVC', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-201': { hierarchy_card: 'Pumps', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-202': { hierarchy_card: 'Pumps', category: '30.85MW STG', subcategory: 'Turbine' },
  'MOV-203': { hierarchy_card: 'Pumps', category: '30.85MW STG', subcategory: 'Turbine' },

  // 30.85MW STG > Condenser
  'PCW-13': { hierarchy_card: 'Pumps', category: '30.85MW STG', subcategory: 'Condenser' },
  'PCW-14': { hierarchy_card: 'Pumps', category: '30.85MW STG', subcategory: 'Condenser' },
  'PCW-15': { hierarchy_card: 'Pumps', category: '30.85MW STG', subcategory: 'Condenser' },
};

function loadActuators() {
  if (!fs.existsSync(POWER_DATA)) {
    throw new Error(`power_data.json not found: ${POWER_DATA}`);
  }
  const data = JSON.parse(fs.readFileSync(POWER_DATA, 'utf8'));
  const list = data.instrument || [];
  const byTag = new Map();
  for (const row of list) {
    if (row.name !== 'Motorized Actuator') continue;
    const tag = String(row.tag_name || '').trim();
    if (!tag || byTag.has(tag)) continue;
    byTag.set(tag, row);
  }
  return byTag;
}

function toFeedRecord(tag, src, meta) {
  const title = sheetName(tag);
  const specs = (src.specs || []).map((s) => ({
    lbl: s.lbl,
    val: s.val,
    section: 'instrument',
  }));

  return {
    hierarchy_name: title,
    hierarchy_card: meta.hierarchy_card,
    hierarchy_path: pathFor(meta.category, meta.subcategory, meta.hierarchy_card),
    image_name: 'Motorized Actuator',
    name: title,
    equip_no: '',
    tag_name: tag,
    category: meta.category,
    subcategory: meta.subcategory,
    location: src.location || 'POWER PLANT',
    commissioned: src.commissioned || '',
    drive: src.drive || '',
    specs,
    schedule: src.schedule || [],
    history: src.history || [],
  };
}

function main() {
  const actuators = loadActuators();
  if (!fs.existsSync(FEED_DIR)) fs.mkdirSync(FEED_DIR, { recursive: true });

  const written = [];
  const mapped = [];
  const unmapped = [];

  for (const [tag, src] of actuators) {
    const meta = HIERARCHY_BY_TAG[tag];
    if (!meta) {
      unmapped.push(tag);
      continue;
    }
    const eq = toFeedRecord(tag, src, meta);
    const file = `actuator-${slugify(tag)}.json`;
    const outPath = path.join(FEED_DIR, file);
    fs.writeFileSync(outPath, `${JSON.stringify({ equipment: [eq] }, null, 2)}\n`, 'utf8');
    written.push(file);
    mapped.push({ tag, file, path: eq.hierarchy_path });
  }

  console.log(`\nMotorized actuator feeds (${actuators.size} tags in power_data.json)`);
  console.log(`  Mapped:   ${mapped.length}`);
  console.log(`  Unmapped: ${unmapped.length}`);
  console.log(`  Wrote:    ${written.length} files\n`);

  if (mapped.length) {
    console.log('Mapped (tag → hierarchy):');
    for (const m of mapped.sort((a, b) => a.tag.localeCompare(b.tag))) {
      console.log(`  ${m.tag.padEnd(10)} → ${m.path}`);
    }
  }

  if (unmapped.length) {
    console.log('\nUnmapped (no existing hierarchy card — skipped):');
    for (const tag of unmapped.sort()) {
      console.log(`  ${tag}`);
    }
  }
}

main();
