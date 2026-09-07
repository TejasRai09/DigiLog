import ChangeRequestCard from './ChangeRequestCard';

export default function PendingChangeList({
  items,
  selectedIds,
  onToggle,
  busy,
  onApprove,
  onModify,
  onResolve,
}) {
  const previous = items.filter((item) => item.group === 'previous');
  const today = items.filter((item) => item.group !== 'previous');

  const renderGroup = (title, rows) => (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-slate-800 sm:text-lg">{title} ({rows.length})</h2>
      {rows.length ? rows.map((item) => (
        <ChangeRequestCard
          key={item.id}
          item={item}
          selected={selectedIds.includes(item.id)}
          onToggle={onToggle}
          busy={busy}
          onApprove={onApprove}
          onModify={onModify}
          onResolve={onResolve}
        />
      )) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-6 text-base text-slate-400">None</p>
      )}
    </section>
  );

  return (
    <div className="space-y-8">
      {renderGroup('Previous pending', previous)}
      {renderGroup('New today', today)}
    </div>
  );
}
