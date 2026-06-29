export const SPEC_SECTIONS = [
  { id: 'mechanical', title: '1. Mechanical', hint: 'Physical build & bearing parameters' },
  { id: 'civil', title: '2. Civil', hint: 'Foundations & structural mounts' },
  { id: 'instrument', title: '3. Instrument', hint: 'Controls, serial tracking & sensors' },
  { id: 'electrical', title: '4. Electrical', hint: 'Power ratings, supply lines & protections' },
];

/** Empty by default — sub-groups come from DB/import or user adds them in the UI. */
export const DEFAULT_SUB_SECTIONS = {
  mechanical: [],
  civil: [],
  instrument: [],
  electrical: [],
};

export const META_SUBSECTIONS_LBL = '__subsections__';
export const META_SUBGROUP_META_LBL = '__subgroup_meta__';
export const SUBGROUP_GALLERY_SIZE = 6;

export function emptySubGroupMetaEntry(defaults = {}) {
  return {
    tagNo: defaults.tagNo ?? '',
    equipNo: defaults.equipNo ?? '',
    location: defaults.location ?? '',
    commissioned: defaults.commissioned ?? '',
    images: Array.from({ length: SUBGROUP_GALLERY_SIZE }, () => ({ src: null, caption: '' })),
  };
}

export function normalizeSubGroupImages(images) {
  return Array.from({ length: SUBGROUP_GALLERY_SIZE }, (_, i) => ({
    src: images?.[i]?.src || null,
    caption: images?.[i]?.caption || '',
  }));
}

export function normalizeSubGroupMetaEntry(raw, defaults = {}) {
  if (!raw || typeof raw !== 'object') return emptySubGroupMetaEntry(defaults);
  return {
    tagNo: raw.tagNo ?? raw.tag_no ?? defaults.tagNo ?? '',
    equipNo: raw.equipNo ?? raw.equip_no ?? defaults.equipNo ?? '',
    location: raw.location ?? defaults.location ?? '',
    commissioned: raw.commissioned ?? defaults.commissioned ?? '',
    images: normalizeSubGroupImages(raw.images),
  };
}

export function getSubGroupMetaEntry(subGroupMeta, section, subName, defaults = {}) {
  const entry = subGroupMeta?.[section]?.[subName];
  return normalizeSubGroupMetaEntry(entry, defaults);
}

export function countSubGroupGalleryImages(images = []) {
  return normalizeSubGroupImages(images).filter((img) => img.src).length;
}

export function emptySubSections() {
  return JSON.parse(JSON.stringify(DEFAULT_SUB_SECTIONS));
}

export function newSpecId() {
  return `spec-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

/** API rows → { specs, subSections, subGroupMeta } */
export function parseSpecsFromApi(rows = [], equipmentDefaults = {}) {
  const subSections = emptySubSections();
  const subGroupMeta = {};
  const specs = [];

  for (const row of rows) {
    if (row.lbl === META_SUBSECTIONS_LBL) {
      try {
        const parsed = JSON.parse(row.val || '{}');
        for (const sec of Object.keys(DEFAULT_SUB_SECTIONS)) {
          if (Array.isArray(parsed[sec]) && parsed[sec].length) {
            subSections[sec] = parsed[sec].slice(0, 6);
          }
        }
      } catch {
        /* keep defaults */
      }
      continue;
    }

    if (row.lbl === META_SUBGROUP_META_LBL) {
      try {
        const parsed = JSON.parse(row.val || '{}');
        for (const [section, groups] of Object.entries(parsed)) {
          if (!groups || typeof groups !== 'object') continue;
          subGroupMeta[section] = {};
          for (const [subName, meta] of Object.entries(groups)) {
            subGroupMeta[section][subName] = normalizeSubGroupMetaEntry(meta, equipmentDefaults);
          }
        }
      } catch {
        /* keep empty meta */
      }
      continue;
    }

    const section = row.section || 'mechanical';
    const subSection = row.sub_section || subSections[section]?.[0] || 'General';
    specs.push({
      id: String(row.id ?? newSpecId()),
      section,
      subSection,
      label: row.lbl,
      value: row.val ?? '',
    });

    if (!subSections[section]?.includes(subSection)) {
      if ((subSections[section]?.length ?? 0) < 6) {
        subSections[section] = [...(subSections[section] || []), subSection];
      }
    }
  }

  for (const section of Object.keys(subSections)) {
    if (!subGroupMeta[section]) subGroupMeta[section] = {};
    for (const subName of subSections[section]) {
      if (!subGroupMeta[section][subName]) {
        subGroupMeta[section][subName] = emptySubGroupMetaEntry(equipmentDefaults);
      }
    }
  }

  return { specs, subSections, subGroupMeta };
}

/** Build selectable equipment cards from saved specs (for maintenance history). */
export function buildEquipmentOptionsFromSpecs(rows = [], equipmentDefaults = {}, sectionFilter = null) {
  const { subSections } = parseSpecsFromApi(rows, equipmentDefaults);
  const options = [];

  for (const sec of SPEC_SECTIONS) {
    if (sectionFilter && sec.id !== sectionFilter) continue;
    for (const subName of subSections[sec.id] || []) {
      options.push({
        key: `${sec.id}::${subName}`,
        section: sec.id,
        subSection: subName,
        label: subName,
        disciplineLabel: sec.title.replace(/^\d+\.\s*/, ''),
      });
    }
  }

  return options;
}

export function parseEquipmentOptionKey(key) {
  if (!key || !String(key).includes('::')) return null;
  const [section, ...rest] = String(key).split('::');
  const subSection = rest.join('::');
  if (!section || !subSection) return null;
  return { section, subSection };
}

/** { specs, subSections, subGroupMeta } → API payload */
export function serializeSpecsForApi(specs, subSections, subGroupMeta = {}) {
  const out = specs
    .filter((s) => s.label?.trim() || s.value?.trim())
    .map((s, i) => ({
      lbl: s.label.trim(),
      val: s.value ?? '',
      section: s.section,
      sub_section: s.subSection,
      sort_order: i,
    }));

  out.push({
    lbl: META_SUBSECTIONS_LBL,
    val: JSON.stringify(subSections),
    section: null,
    sub_section: null,
    sort_order: 99999,
  });

  if (subGroupMeta && Object.keys(subGroupMeta).length) {
    out.push({
      lbl: META_SUBGROUP_META_LBL,
      val: JSON.stringify(subGroupMeta),
      section: null,
      sub_section: null,
      sort_order: 99998,
    });
  }

  return out;
}
