import { NOTE_KPI_TONES } from './noteStatus';

export default function NoteKpiCard({ status, label, value, active, onClick, className = '' }) {
  const tone = NOTE_KPI_TONES[status] || NOTE_KPI_TONES.pending;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-3 text-left ${active ? tone.active : tone.idle} ${className}`}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${tone.label}`}>{label}</p>
      <p className={`mt-1 text-xl font-bold ${tone.value}`}>{value}</p>
    </button>
  );
}
