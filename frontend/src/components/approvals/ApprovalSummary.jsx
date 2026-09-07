export default function ApprovalSummary({ summary }) {
  const previous = summary?.previousPending || 0;
  const today = summary?.newToday || 0;
  const total = summary?.total || 0;
  const conflict = summary?.conflict || 0;

  const cards = [
    { label: 'Previous Pending', value: previous, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
    { label: 'New Today', value: today, tone: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
    { label: 'Total Pending', value: total, tone: 'text-blue-700 bg-blue-50 border-blue-100' },
  ];
  if (conflict) {
    cards.push({ label: 'Conflicts', value: conflict, tone: 'text-rose-700 bg-rose-50 border-rose-100' });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-2xl border px-4 py-4 ${card.tone}`}>
          <p className="text-xs font-bold uppercase tracking-wide opacity-80 sm:text-sm">{card.label}</p>
          <p className="mt-1 text-3xl font-bold">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
