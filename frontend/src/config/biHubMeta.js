import {
  MdScience,
  MdPrecisionManufacturing,
  MdShoppingCart,
  MdElectricBolt,
  MdAgriculture,
  MdInsights,
  MdNaturePeople,
} from 'react-icons/md';

/** Clockwise from 12 o'clock — matches the Zuari BI hub reading order. */
export const BI_HUB_ORDER = [
  'bi_management_dashboard',
  'bi_cane_performance',
  'bi_brix_sampling',
  'bi_centre_maturity',
  'bi_milling_operations',
  'bi_power_house',
  'bi_distillery_operations',
  'bi_purchy_analysis',
];

export const BI_HUB_META = {
  bi_management_dashboard: {
    title: 'Management Overview',
    subtitle: 'Executive KPIs',
    description: 'Plant-wide scorecard for cane, mill, power, and distillery — daily production, recovery, and exception highlights.',
    Icon: MdInsights,
  },
  bi_cane_performance: {
    title: 'Cane Operations',
    subtitle: 'Procurement & gate',
    description: 'Gate purchase, parchy size, transport mix, overrun, and cut-to-crush flow from field to mill.',
    Icon: MdAgriculture,
  },
  bi_brix_sampling: {
    title: 'Cane Quality',
    subtitle: 'Field & yard',
    description: 'Field and yard Brix sampling, crop condition, variety, and delivery-point quality trends.',
    Icon: MdScience,
  },
  bi_centre_maturity: {
    title: 'Centre Maturity',
    subtitle: 'Season vs season',
    description: 'Centre-wise cane maturity compared with last season to plan harvest and crushing.',
    Icon: MdNaturePeople,
  },
  bi_milling_operations: {
    title: 'Milling Operations',
    subtitle: 'Mill cockpit',
    description: 'Mill stoppages, shredder, equipment temperature, and lube-roller health in one mill view.',
    Icon: MdPrecisionManufacturing,
  },
  bi_power_house: {
    title: 'Power Plant Operations',
    subtitle: 'Generation & steam',
    description: 'Generation, steam, and power-house process status for turbines, boilers, and utilities.',
    Icon: MdElectricBolt,
  },
  bi_distillery_operations: {
    title: 'Distillery Operations',
    subtitle: 'Production analytics',
    description: 'Distillery production, fermentation, and spirit recovery analytics for the selected period.',
    Icon: MdScience,
  },
  bi_purchy_analysis: {
    title: 'Purchy Analysis',
    subtitle: 'Grower & dishonour',
    description: 'Grower performance, indent vs supply, dishonour %, staff drilldown, and failure by date.',
    Icon: MdShoppingCart,
  },
};

export function getBiHubMeta(formKey, fallbackName = '') {
  const meta = BI_HUB_META[formKey];
  if (meta) return meta;
  return { title: fallbackName || 'Dashboard', subtitle: '', description: '', Icon: MdInsights };
}

export function sortBiHubForms(forms) {
  const list = Array.isArray(forms) ? [...forms] : [];
  const rank = new Map(BI_HUB_ORDER.map((k, i) => [k, i]));
  return list.sort((a, b) => {
    const ai = rank.has(a.formKey) ? rank.get(a.formKey) : 100;
    const bi = rank.has(b.formKey) ? rank.get(b.formKey) : 100;
    if (ai !== bi) return ai - bi;
    return (a.sort_order ?? 99) - (b.sort_order ?? 99);
  });
}
