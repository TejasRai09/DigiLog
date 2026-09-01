function whereAnd(ctx, extra) {
  if (ctx.whereSql) return `${ctx.whereSql} AND ${extra}`;
  return `WHERE ${extra}`;
}

function slugId(value) {
  return String(value || 'unknown')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown';
}

function pctRatio(numerator, denominator) {
  const num = Number(numerator) || 0;
  const den = Number(denominator) || 0;
  return den ? num / den : 0;
}

const LOYALTY_COLORS = {
  '5. Supplied 5 years': { color: '#059669', tailwind: 'bg-emerald-600' },
  '4. Supplied 4 years': { color: '#2563eb', tailwind: 'bg-blue-500' },
  '3. Supplied 3 years': { color: '#0d9488', tailwind: 'bg-teal-500' },
  '0. Never supplied': { color: '#334155', tailwind: 'bg-slate-700' },
  '2. Supplied 2 years': { color: '#38bdf8', tailwind: 'bg-sky-400' },
  '1. Supplied 1 year': { color: '#818cf8', tailwind: 'bg-indigo-400' },
};

const VARIETY_COLORS = [
  'bg-[#1d2d50]',
  'bg-[#2563eb]',
  'bg-[#0d8276]',
  'bg-[#64748b]',
  'bg-[#14b8a6]',
  'bg-[#1e40af]',
  'bg-[#0f766e]',
  'bg-[#475569]',
  'bg-[#0369a1]',
];

/** Cycling palette for the full variety treemap (matches PBI: one tile per variety). */
const VARIETY_HEX = [
  '#1d2d50', '#2563eb', '#0d8276', '#64748b', '#14b8a6',
  '#1e40af', '#0f766e', '#38bdf8', '#7c3aed', '#db2777',
  '#f59e0b', '#84cc16', '#06b6d4', '#f97316', '#6366f1',
  '#10b981', '#a855f7', '#e11d48', '#0ea5e9', '#65a30d',
  '#94a3b8', '#c026d3', '#ea580c', '#0284c7', '#4f46e5',
];

module.exports = {
  whereAnd,
  slugId,
  pctRatio,
  LOYALTY_COLORS,
  VARIETY_COLORS,
  VARIETY_HEX,
};
