/**
 * Power plant equipment identifier normalization and hierarchy classification.
 */
const fs = require('fs');
const path = require('path');

const LOOKUP_PATH = path.join(__dirname, '..', '..', '..', 'power_equipment_lookup.json');

let _lookup = null;

function loadLookup() {
  if (_lookup) return _lookup;
  try {
    _lookup = JSON.parse(fs.readFileSync(LOOKUP_PATH, 'utf8'));
  } catch {
    _lookup = {};
  }
  return _lookup;
}

const ZIL_PREFIX = /^ZIL\/GSM\/PP\//i;
const TAG_PATTERN = /^[A-Z]{1,5}[-/][\w-]+$/i;

function isZilEquipNo(value) {
  return ZIL_PREFIX.test(String(value || '').trim());
}

function looksLikeTag(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (isZilEquipNo(s)) return false;
  return TAG_PATTERN.test(s) || /^[A-Z]{2,5}\d/i.test(s);
}

/** Split legacy single identifier into equip_no vs tag_name. */
function normalizeIdentifiers(equipNo, tagName) {
  let equip = String(equipNo || '').trim();
  let tag = String(tagName || '').trim();

  if (equip && !tag) {
    if (looksLikeTag(equip)) {
      tag = equip;
      equip = '';
    }
  } else if (!equip && tag && isZilEquipNo(tag)) {
    equip = tag;
    tag = '';
  }

  return {
    equip_no: equip || null,
    tag_name: tag || null,
  };
}

function categoryFromLocation(location) {
  const loc = String(location || '').toUpperCase();
  if (loc.includes('70 TPH') || loc.includes('70TPH')) return { category: '70TPH BLR', subcategory: null };
  if (loc.includes('150 TPH') || loc.includes('150TPH')) return { category: '150TPH BLR', subcategory: null };
  if (loc.includes('STG') || loc.includes('TURBINE') || loc.includes('GENERATOR')) {
    return { category: '30.85MW STG', subcategory: null };
  }
  if (loc.includes('WTP') || loc.includes('DM PLANT') || loc.includes('RO PLANT')) {
    return { category: 'WTP', subcategory: null };
  }
  return { category: null, subcategory: null };
}

function lookupClassification(key) {
  const lookup = loadLookup();
  const k = String(key || '').trim();
  if (!k) return null;
  return lookup[k] || null;
}

function tagFromName(name) {
  const s = String(name || '').trim();
  const m = s.match(/^([A-Z]{1,5}[-/][\w-]+)/i);
  return m ? m[1] : null;
}

/**
 * Resolve category + subcategory for equipment record.
 * @param {{ equip_no?, tag_name?, name?, location?, dept? }} equipment
 */
function classifyEquipment(equipment) {
  const keys = [
    equipment.tag_name,
    equipment.equip_no,
    tagFromName(equipment.name),
    equipment.name,
  ];

  for (const key of keys) {
    const hit = lookupClassification(key);
    if (hit) {
      return {
        category: hit.category || null,
        subcategory: hit.subcategory || null,
      };
    }
  }

  const fromLoc = categoryFromLocation(equipment.location);
  if (fromLoc.category) return fromLoc;

  const dept = String(equipment.dept || '').trim();
  if (dept === 'electrical') {
    return { category: '30.85MW STG', subcategory: null };
  }

  return { category: null, subcategory: null };
}

/** Apply identifier split + classification to a plain equipment object. */
function enrichEquipment(equipment) {
  const ids = normalizeIdentifiers(equipment.equip_no, equipment.tag_name);
  const classified = classifyEquipment({ ...equipment, ...ids });
  return {
    ...equipment,
    equip_no: ids.equip_no,
    tag_name: ids.tag_name,
    category: equipment.category || classified.category || null,
    subcategory: equipment.subcategory || classified.subcategory || null,
  };
}

module.exports = {
  loadLookup,
  normalizeIdentifiers,
  classifyEquipment,
  enrichEquipment,
  isZilEquipNo,
  looksLikeTag,
};
