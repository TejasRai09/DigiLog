function displayCell(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function ChangeComparison({ item }) {
  const operation = item?.operation;
  const rows = item?.changedFields || [];

  if (operation === 'create') {
    return (
      <div>
        <p className="mb-2 text-sm font-bold uppercase tracking-wide text-emerald-700">+ New maintenance history entry</p>
        <FieldTable rows={rows.length ? rows : Object.entries(item.requestedData || {}).map(([field, newValue]) => ({
          label: field,
          oldValue: '—',
          newValue: displayCell(newValue),
        }))}
        />
      </div>
    );
  }

  if (operation === 'delete') {
    return (
      <div>
        <p className="mb-2 text-sm font-bold uppercase tracking-wide text-rose-700">Delete request</p>
        <p className="mb-2 text-sm text-slate-500">This approved record will be removed after HOD approval.</p>
        <FieldTable rows={rows} />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Changed fields only</p>
      <FieldTable rows={rows} />
    </div>
  );
}

function FieldTable({ rows }) {
  if (!rows?.length) {
    return <p className="text-base text-slate-400">No field details available.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm sm:text-base">
        <thead>
          <tr>
            <th className="border border-blue-800 bg-blue-700 px-3 py-2 font-semibold text-white">Field</th>
            <th className="border border-blue-800 bg-blue-700 px-3 py-2 font-semibold text-white">Previous</th>
            <th className="border border-blue-800 bg-blue-700 px-3 py-2 font-semibold text-white">Requested</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label || row.field}>
              <td className="border border-slate-200 px-3 py-2 font-semibold text-slate-700">{row.label || row.field}</td>
              <td className="border border-slate-200 px-3 py-2 text-slate-500 whitespace-pre-wrap">{row.oldValue ?? displayCell(row.oldValue)}</td>
              <td className="border border-slate-200 px-3 py-2 text-slate-800 whitespace-pre-wrap">{row.newValue ?? displayCell(row.newValue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
