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

const VARIETY_COLORS = ['bg-[#1d2d50]', 'bg-[#2563eb]', 'bg-[#0d8276]', 'bg-[#64748b]', 'bg-[#14b8a6]'];

module.exports = {
  whereAnd,
  slugId,
  pctRatio,
  LOYALTY_COLORS,
  VARIETY_COLORS,
};
