import { NOTE_STATUS_LABEL, NOTE_STATUS_STYLES } from './noteStatus';

export function NoteStatusBadge({ status }) {
  const label = NOTE_STATUS_LABEL[status] || status || 'Unknown';
  const cls = NOTE_STATUS_STYLES[status] || 'bg-slate-50 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}
