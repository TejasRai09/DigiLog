export const NOTE_STATUS_LABEL = {
  pending: 'Pending',
  approval_pending: 'Approval Pending',
  completed: 'Completed',
  rework_required: 'Rework Required',
};

export const NOTE_STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800 border-amber-200',
  approval_pending: 'bg-sky-50 text-sky-800 border-sky-200',
  completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  rework_required: 'bg-orange-50 text-orange-800 border-orange-200',
};

export const NOTE_KPI_TONES = {
  pending: {
    idle: 'border-amber-200 bg-amber-50',
    active: 'border-amber-400 bg-amber-100 ring-2 ring-amber-300',
    label: 'text-amber-700',
    value: 'text-amber-950',
  },
  approval_pending: {
    idle: 'border-sky-200 bg-sky-50',
    active: 'border-sky-400 bg-sky-100 ring-2 ring-sky-300',
    label: 'text-sky-700',
    value: 'text-sky-950',
  },
  rework_required: {
    idle: 'border-orange-200 bg-orange-50',
    active: 'border-orange-400 bg-orange-100 ring-2 ring-orange-300',
    label: 'text-orange-800',
    value: 'text-orange-950',
  },
  completed: {
    idle: 'border-emerald-200 bg-emerald-50',
    active: 'border-emerald-400 bg-emerald-100 ring-2 ring-emerald-300',
    label: 'text-emerald-700',
    value: 'text-emerald-950',
  },
};

export const PLANTS = [
  { key: 'sugar', label: 'Sugar House' },
  { key: 'power', label: 'Power Plant' },
  { key: 'production', label: 'Production House' },
];

export const ACTIVITY_TYPES = [
  'Inspection',
  'Repair',
  'Replacement',
  'Lubrication',
  'Cleaning / Descaling',
  'Overhaul',
  'Calibration',
  'Painting / Civil',
  'Other',
];

export const ACTIVITY_MAX_LENGTH = 80;

export function formatNoteWhen(value) {
  if (!value) return '—';
  const s = String(value).trim();
  const mysqlUtc = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(s);
  const d = mysqlUtc
    ? new Date(`${mysqlUtc[1]}T${mysqlUtc[2]}Z`)
    : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
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
