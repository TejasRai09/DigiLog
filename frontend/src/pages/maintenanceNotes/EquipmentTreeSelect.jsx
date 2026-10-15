import { useMemo, useState } from 'react';
import { MdChevronRight, MdExpandMore, MdSearch } from 'react-icons/md';

function filterNodes(nodes, query) {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  const walk = (node) => {
    const children = (node.children || []).map(walk).filter(Boolean);
    const hay = `${node.name || ''} ${node.equipNo || ''}`.toLowerCase();
    if (hay.includes(q) || children.length) return { ...node, children };
    return null;
  };
  return (nodes || []).map(walk).filter(Boolean);
}

function findPath(nodes, selectedId, trail = []) {
  for (const node of nodes || []) {
    const next = [...trail, node];
    if (node.nodeType === 'equipment' && String(node.id) === String(selectedId)) return next;
    const found = findPath(node.children, selectedId, next);
    if (found) return found;
  }
  return null;
}

export function equipmentPathLabel(nodes, selectedId) {
  const path = findPath(nodes, selectedId);
  return path ? path.map((node) => node.name).join(' › ') : '';
}

function TreeRows({ nodes, depth, selectedId, onSelect, forceOpen }) {
  return nodes.map((node) => (
    <TreeRow
      key={node.id}
      node={node}
      depth={depth}
      selectedId={selectedId}
      onSelect={onSelect}
      forceOpen={forceOpen}
    />
  ));
}

function TreeRow({ node, depth, selectedId, onSelect, forceOpen }) {
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;
  const isEquipment = node.nodeType === 'equipment';
  const selected = isEquipment && String(node.id) === String(selectedId);
  const hasChildren = Boolean(node.children?.length);

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: 6 + depth * 14 }}>
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <MdExpandMore className="h-4 w-4" /> : <MdChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-6 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => {
            if (isEquipment) onSelect(node);
            else setOpen((value) => !value);
          }}
          className={`min-w-0 flex-1 truncate rounded px-1.5 py-1.5 text-left text-sm ${
            selected
              ? 'bg-blue-50 font-semibold text-blue-700'
              : isEquipment
                ? 'text-slate-800 hover:bg-slate-50'
                : 'font-semibold text-slate-600 hover:bg-slate-50'
          }`}
        >
          {node.name}
          {node.equipNo ? <span className="ml-1 text-xs font-normal text-slate-400">{node.equipNo}</span> : null}
        </button>
      </div>
      {expanded && hasChildren ? (
        <TreeRows
          nodes={node.children}
          depth={depth + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          forceOpen={forceOpen}
        />
      ) : null}
    </div>
  );
}

export default function EquipmentTreeSelect({
  nodes = [],
  selectedId,
  fallbackLabel = '',
  disabled = false,
  loading = false,
  onSelect,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filterNodes(nodes, query), [nodes, query]);
  const label = equipmentPathLabel(nodes, selectedId) || fallbackLabel;

  return (
    <div>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm disabled:bg-slate-50"
      >
        <span className={`truncate ${label ? 'text-slate-800' : 'text-slate-400'}`}>
          {loading ? 'Loading equipment…' : (label || 'Select equipment')}
        </span>
        <MdExpandMore className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled ? (
        <div className="mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="relative border-b border-slate-100">
            <MdSearch className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search equipment"
              className="w-full py-2 pl-8 pr-3 text-sm outline-none"
            />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-sm text-slate-400">No equipment in this plant.</p>
            ) : (
              <TreeRows
                nodes={filtered}
                depth={0}
                selectedId={selectedId}
                forceOpen={Boolean(query.trim())}
                onSelect={(node) => {
                  onSelect(node);
                  setOpen(false);
                  setQuery('');
                }}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
