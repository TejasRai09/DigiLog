import { MdClose } from 'react-icons/md';

function fmtPct(v) {
  return `${(Number(v) * 100).toFixed(2)}%`;
}

function TreeNode({ node, selected, onSelect, maxPct, isDarkMode, compact = false }) {
  const widthPct = Math.max(12, (node.pct / maxPct) * 100);
  const active = selected === node.id;
  const bar = active
    ? 'bg-blue-700 text-white'
    : isDarkMode
      ? 'bg-slate-600 text-slate-100 hover:bg-slate-500'
      : 'bg-slate-300 text-slate-800 hover:bg-slate-400';

  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className={`mb-1 flex w-full items-center gap-1 text-left transition-colors ${active ? 'ring-1 ring-blue-500' : ''}`}
    >
      <div
        className={`flex min-w-0 items-center justify-between rounded px-1.5 py-1 font-semibold ${bar} ${compact ? 'text-[10px]' : 'text-xs'}`}
        style={{ width: `${widthPct}%`, minWidth: compact ? '90px' : '100px' }}
      >
        <span className="truncate">{node.label}</span>
        <span className="ml-2 shrink-0 tabular-nums">{fmtPct(node.pct)}</span>
      </div>
    </button>
  );
}

function TreeColumn({ title, nodes, selectedId, onSelect, onClear, isDarkMode, compact = false }) {
  if (!nodes?.length) return null;
  const maxPct = Math.max(...nodes.map((n) => n.pct), 0.01);
  const card = isDarkMode ? 'border-slate-600 bg-slate-800/50' : 'border-slate-200 bg-slate-50';

  return (
    <div className={`min-w-[140px] flex-1 rounded-lg border ${compact ? 'p-1.5' : 'p-2'} ${card}`}>
      <div className="mb-2 flex items-center justify-between gap-1">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
          {title}
        </span>
        {selectedId && (
          <button type="button" onClick={onClear} className="text-slate-400 hover:text-rose-500" aria-label="Clear level">
            <MdClose className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {nodes.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          selected={selectedId}
          onSelect={onSelect}
          maxPct={maxPct}
          isDarkMode={isDarkMode}
          compact={compact}
        />
      ))}
    </div>
  );
}

export default function PurchyDecompositionTree({
  rootLabel,
  rootPct,
  columns,
  isDarkMode,
  compact = false,
  className = '',
}) {
  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white';
  const rootBar = isDarkMode ? 'bg-blue-900 text-blue-100' : 'bg-blue-800 text-white';

  return (
    <div className={`flex min-h-0 flex-col overflow-hidden rounded-xl border shadow-sm ${card} ${className}`}>
      <div className={`flex min-h-0 flex-1 gap-2 overflow-x-auto overflow-y-hidden ${compact ? 'p-2' : 'p-3'}`}>
        <div className={`shrink-0 rounded-lg ${rootBar} ${compact ? 'px-3 py-2' : 'px-4 py-3'}`}>
          <div className={`font-bold uppercase opacity-80 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>{rootLabel}</div>
          <div className={`font-black tabular-nums ${compact ? 'text-lg' : 'text-2xl'}`}>{fmtPct(rootPct)}</div>
        </div>
        <div className="flex min-w-0 flex-1 gap-2">
          {columns.map((col) => (
            <TreeColumn key={col.title} {...col} isDarkMode={isDarkMode} compact={compact} />
          ))}
        </div>
      </div>
    </div>
  );
}

export { fmtPct };
