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

export function formatSubmittedAt(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
