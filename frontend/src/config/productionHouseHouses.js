export const PRODUCTION_HOUSE_SECTIONS = [
  {
    id: 'pan_crystallizer',
    label: 'Pan & Crystallizer',
    description: 'Pans, crystallizers and molasses conditioners',
  },
  {
    id: 'evaporation',
    label: 'Evaporation',
    description: 'Juice heaters, kestner, vapour cell, FFE and condensers',
  },
  {
    id: 'clarification',
    label: 'Clarification',
    description: 'Sulphiters, clarifier, filters, tanks and decanter',
  },
  {
    id: 'centrifugal_drier',
    label: 'Centrifugal & Drier House',
    description: 'Centrifugals, pugmills, hoppers, grader and conveyors',
  },
];

export const PRODUCTION_HOUSE_SECTION_IDS = PRODUCTION_HOUSE_SECTIONS.map((s) => s.id);

export function productionHouseSection(id) {
  return PRODUCTION_HOUSE_SECTIONS.find((s) => s.id === id) || null;
}

export function productionHouseSectionLabel(id) {
  return productionHouseSection(id)?.label || id || 'House';
}

export function isProductionHouseSection(id) {
  return PRODUCTION_HOUSE_SECTION_IDS.includes(id);
}
