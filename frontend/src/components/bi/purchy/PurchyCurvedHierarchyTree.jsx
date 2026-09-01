import { useEffect, useMemo, useRef, useState } from 'react';
import { MdClose } from 'react-icons/md';

/**
 * Curved connector decomposition tree (Staff / Dishonour drilldown).
 *
 * @param {object} props
 * @param {boolean} props.isDarkMode
 * @param {string} [props.className]
 * @param {string} props.rootLabel
 * @param {number} props.rootValue - displayed with % suffix (e.g. 52.93)
 * @param {string} [props.rootSubtext]
 * @param {Array<{ key: string, title: string, nodes: Array<{ id: string, name: string, value: number }>, selectedId: string|null, onSelect: Function, onClear?: Function }>} props.columns
 */
export default function PurchyCurvedHierarchyTree({
  isDarkMode,
  className = '',
  rootLabel,
  rootValue,
  rootSubtext,
  columns,
  coordDeps = [],
}) {
  const containerRef = useRef(null);
  const nodeRefs = useRef({});
  const [coordTrigger, setCoordTrigger] = useState(0);

  const selections = useMemo(
    () => Object.fromEntries(columns.map((c) => [c.key, c.selectedId])),
    [columns],
  );

  useEffect(() => {
    const handleResize = () => setCoordTrigger((p) => p + 1);
    window.addEventListener('resize', handleResize);
    const timer = setTimeout(handleResize, 350);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, [columns, coordDeps]);

  const bumpCoords = () => {
    [10, 50, 100, 150, 200, 250].forEach((t) => {
      setTimeout(() => setCoordTrigger((p) => p + 1), t);
    });
  };

  const connectorPaths = useMemo(() => {
    const paths = [];
    if (!containerRef.current || !columns.length) return paths;

    const containerRect = containerRef.current.getBoundingClientRect();
    const rootEl = nodeRefs.current['root-card'];

    if (rootEl && columns[0]?.nodes?.length) {
      const rootRect = rootEl.getBoundingClientRect();
      const startX = rootRect.right - containerRect.left;
      const startY = (rootRect.top + rootRect.height / 2) - containerRect.top;

      columns[0].nodes.forEach((node) => {
        const nodeEl = nodeRefs.current[node.id];
        if (!nodeEl) return;
        const nodeRect = nodeEl.getBoundingClientRect();
        const endX = nodeRect.left - containerRect.left;
        const endY = (nodeRect.top + nodeRect.height / 2) - containerRect.top;
        const controlOffset = Math.abs(endX - startX) * 0.5;
        paths.push({
          id: `root-${node.id}`,
          path: `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
          isHighlighted: selections[columns[0].key] === node.id,
        });
      });
    }

    for (let colIdx = 0; colIdx < columns.length - 1; colIdx += 1) {
      const curCol = columns[colIdx];
      const nextCol = columns[colIdx + 1];

      curCol.nodes.forEach((parentNode) => {
        const isParentActive = selections[curCol.key] === parentNode.id;
        if (!isParentActive) return;

        nextCol.nodes.forEach((childNode) => {
          const pEl = nodeRefs.current[parentNode.id];
          const cEl = nodeRefs.current[childNode.id];
          if (!pEl || !cEl) return;

          const pRect = pEl.getBoundingClientRect();
          const cRect = cEl.getBoundingClientRect();
          const startX = pRect.right - containerRect.left;
          const startY = (pRect.top + pRect.height / 2) - containerRect.top;
          const endX = cRect.left - containerRect.left;
          const endY = (cRect.top + cRect.height / 2) - containerRect.top;
          const controlOffset = Math.abs(endX - startX) * 0.45;

          let pathHighlighted = selections[nextCol.key] === childNode.id;
          if (!pathHighlighted && !selections[nextCol.key] && colIdx === columns.length - 2) {
            pathHighlighted = true;
          }

          paths.push({
            id: `${parentNode.id}-${childNode.id}`,
            path: `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`,
            isHighlighted: pathHighlighted,
          });
        });
      });
    }

    return paths;
  }, [columns, selections, coordTrigger]);

  const card = isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200/80 bg-white';
  const titleText = isDarkMode ? 'text-slate-100' : 'text-slate-800';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const gridCols = columns.length + 1;
  const minWidth = Math.max(680, gridCols * 175);
  const SUBNODE_SCROLL_THRESHOLD = 3;

  return (
    <section className={`flex min-h-0 flex-col rounded-xl border shadow-sm ${card} ${className}`}>
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto p-3">
        <div
          className="relative grid gap-x-8 py-2"
          style={{
            minWidth: `${minWidth}px`,
            gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
          }}
        >
          <svg className="pointer-events-none absolute inset-0 z-0" style={{ width: '100%', height: '100%' }}>
            {connectorPaths.map((c) => (
              <path
                key={c.id}
                d={c.path}
                fill="none"
                stroke={c.isHighlighted ? '#1d4ed8' : (isDarkMode ? '#334155' : '#cbd5e1')}
                strokeWidth={c.isHighlighted ? '2.5' : '1.2'}
                strokeDasharray={c.isHighlighted ? 'none' : '3 3'}
                className="transition-all duration-300"
              />
            ))}
          </svg>

          <div className="z-10 flex flex-col justify-center">
            <div className="mb-2 text-[9px] font-black uppercase tracking-wider text-slate-400">Root Value</div>
            <div
              ref={(el) => { nodeRefs.current['root-card'] = el; }}
              className="max-w-[165px] cursor-default rounded-lg border border-blue-800 bg-blue-700 p-2.5 text-white shadow-md"
            >
              <div className="text-[8px] font-black uppercase tracking-widest text-blue-100">
                {rootLabel.toUpperCase()}
              </div>
              <div className="mt-1 text-xl font-black tabular-nums">
                {Number(rootValue).toFixed(2)}
                %
              </div>
              {rootSubtext && (
                <div className="mt-0.5 text-[9px] text-blue-200">{rootSubtext}</div>
              )}
            </div>
          </div>

          {columns.map((column) => {
            const scrollable = column.nodes.length > SUBNODE_SCROLL_THRESHOLD;
            const maxVal = Math.max(...column.nodes.map(n => Number(n.value) || 0), 0.01);
            return (
            <div key={column.key} className="z-10 flex flex-col justify-start">
              <div className={`mb-2 flex max-w-[175px] shrink-0 items-center justify-between border-b pb-1 ${isDarkMode ? 'border-slate-700' : 'border-slate-100'}`}>
                <span className={`text-[9px] font-black uppercase tracking-wider ${muted}`}>{column.title}</span>
                {column.onClear && column.selectedId && (
                  <button
                    type="button"
                    onClick={() => { column.onClear(); bumpCoords(); }}
                    className="text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={`Clear ${column.title}`}
                  >
                    <MdClose className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
              <div
                className={`flex max-w-[175px] flex-col gap-1.5 pr-0.5 ${
                  scrollable
                    ? 'max-h-[240px] overflow-y-auto overflow-x-hidden overscroll-contain'
                    : ''
                }`}
                onScroll={scrollable ? bumpCoords : undefined}
              >
                {column.nodes.length === 0 ? (
                  <div className={`rounded-lg border border-dashed py-8 text-center text-xs italic ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-200 text-slate-400'}`}>
                    No active child branch selected
                  </div>
                ) : (
                  column.nodes.map((node) => {
                    const isActive = column.selectedId === node.id;
                    const widthPct = Math.max(2, (Number(node.value) / maxVal) * 100);
                    return (
                      <button
                        key={node.id}
                        type="button"
                        ref={(el) => { nodeRefs.current[node.id] = el; }}
                        onClick={() => { column.onSelect(node.id); bumpCoords(); }}
                        className={`relative flex min-h-[48px] shrink-0 flex-col justify-between overflow-hidden rounded-lg border p-2 text-left transition-all duration-200 ${
                          isActive
                            ? 'scale-[1.01] border-blue-800 bg-blue-700 text-white shadow-md'
                            : isDarkMode
                              ? 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600'
                              : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300'
                        }`}
                      >
                        {!isActive && (
                          <div
                            className={`pointer-events-none absolute inset-y-0 left-0 ${isDarkMode ? 'bg-slate-800' : 'bg-slate-100'}`}
                            style={{ width: `${Math.min(widthPct, 100)}%` }}
                          />
                        )}
                        <div className="relative z-10 flex w-full items-start justify-between gap-1">
                          <span className="max-w-[125px] truncate text-[10px] font-bold tracking-tight">{node.name}</span>
                          <span className={`shrink-0 text-[11px] font-black tabular-nums ${isActive ? 'text-blue-100' : titleText}`}>
                            {Number(node.value).toFixed(2)}
                            %
                          </span>
                        </div>
                        {isActive && (
                          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-blue-800">
                            <div className="h-full bg-blue-300" style={{ width: `${Math.min(widthPct, 100)}%` }} />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
