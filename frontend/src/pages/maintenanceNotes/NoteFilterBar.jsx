import { NOTE_STATUS_LABEL, PLANTS } from './noteStatus';

const selectClass = 'min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm sm:w-44 sm:flex-none';

export default function NoteFilterBar({
  search,
  plant,
  status,
  canReset,
  onSearchChange,
  onPlantChange,
  onStatusChange,
  onReset,
  plantAllLabel = 'All plants',
  statusAllLabel = 'All statuses',
  statuses = NOTE_STATUS_LABEL,
  searchPlaceholder = 'Search note, person, or activity',
  className = '',
}) {
  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center ${className}`}>
      <input
        type="search"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={searchPlaceholder}
        className="min-w-0 w-full flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
      />
      <div className="flex gap-2">
        <select
          value={plant}
          onChange={(e) => onPlantChange(e.target.value)}
          className={selectClass}
        >
          <option value="">{plantAllLabel}</option>
          {PLANTS.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className={selectClass}
        >
          <option value="">{statusAllLabel}</option>
          {Object.entries(statuses).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled={!canReset}
          onClick={onReset}
          className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
