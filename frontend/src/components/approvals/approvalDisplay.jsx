const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  resubmitted: 'bg-sky-50 text-sky-800 border-sky-200',
  needs_modification: 'bg-orange-50 text-orange-800 border-orange-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  conflict: 'bg-rose-50 text-rose-800 border-rose-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  rejected: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function statusLabel(status) {
  if (status === 'needs_modification') return 'Needs modification';
  if (status === 'resubmitted') return 'Resubmitted';
  if (!status) return 'Unknown';
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({ status }) {
  const cls = STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide sm:text-sm ${cls}`}>
      {statusLabel(status)}
    </span>
  );
}

/**
 * Parse API datetimes from mysql2 (`dateStrings: true`, session UTC).
 * Bare "YYYY-MM-DD HH:mm:ss" must be treated as UTC — otherwise browsers
 * interpret them as local and IST clocks show ~5h30m early.
 */
export function parseApiDateTime(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(value).trim();
  if (!s) return null;
  const mysqlUtc = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(s);
  if (mysqlUtc) {
    const d = new Date(`${mysqlUtc[1]}T${mysqlUtc[2]}${mysqlUtc[3] || ''}Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatSubmittedAt(value) {
  const d = parseApiDateTime(value);
  if (!d) return value ? String(value) : '—';
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
