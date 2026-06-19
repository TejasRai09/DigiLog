export const SPEC_SECTIONS = [
  { id: 'mechanical', title: '1. Mechanical', hint: 'Physical build & bearing parameters' },
  { id: 'civil', title: '2. Civil', hint: 'Foundations & structural mounts' },
  { id: 'instrument', title: '3. Instrument', hint: 'Controls, serial tracking & sensors' },
  { id: 'electrical', title: '4. Electrical', hint: 'Power ratings, supply lines & protections' },
];

export const DEFAULT_SUB_SECTIONS = {
  mechanical: ['Rotor & Frame', 'Bearings'],
  civil: ['Foundation Base', 'Isolators & Anchors'],
  instrument: ['Cables & Signals', 'Drive Controller'],
  electrical: ['Motor Ratings', 'VFD System', 'Protection Feeders'],
};

export const META_SUBSECTIONS_LBL = '__subsections__';

export function emptySubSections() {
  return JSON.parse(JSON.stringify(DEFAULT_SUB_SECTIONS));
}

export function newSpecId() {
  return `spec-${Date.now()}-${Math.round(Math.random() * 10000)}`;
}

/** API rows → { specs, subSections } */
export function parseSpecsFromApi(rows = []) {
  const subSections = emptySubSections();
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

  return { specs, subSections };
}

/** { specs, subSections } → API payload */
export function serializeSpecsForApi(specs, subSections) {
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

  return out;
}
