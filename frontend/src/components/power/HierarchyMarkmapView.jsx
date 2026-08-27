import { useEffect, useMemo, useRef, useState } from 'react';
import {
  MdCenterFocusStrong,
  MdDownload,
  MdZoomIn,
  MdZoomOut,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import { Transformer } from 'markmap-lib';
import { Markmap, deriveOptions } from 'markmap-view';
import api from '../../api/axios';
import {
  buildHierarchyMarkdown,
  buildStandaloneMarkmapHtml,
  countHierarchyNodes,
  markmapFileName,
} from '../../utils/hierarchyMarkmap';

const transformer = new Transformer();

const SUGAR_EXPAND_LEVELS = [
  { value: 2, label: 'Open to: Houses' },
  { value: 3, label: 'Open to: Locations' },
  { value: 4, label: 'Open to: Main equipment' },
  { value: 5, label: 'Open to: Sub equipment' },
  { value: 6, label: 'Open to: Departments' },
  { value: 7, label: 'Open everything (slow)' },
];

const POWER_EXPAND_LEVELS = [
  { value: 2, label: 'Open to: Areas / systems' },
  { value: 3, label: 'Open to: Equipment' },
  { value: 4, label: 'Open to: Sub equipment' },
  { value: 5, label: 'Open to: Departments' },
  { value: 6, label: 'Open to: Child equipment' },
  { value: 7, label: 'Open everything (slow)' },
];

const GENERIC_EXPAND_LEVELS = [
  { value: 2, label: 'Open to: level 2' },
  { value: 3, label: 'Open to: level 3' },
  { value: 4, label: 'Open to: level 4' },
  { value: 5, label: 'Open to: level 5' },
  { value: 6, label: 'Open to: level 6' },
  { value: 7, label: 'Open everything (slow)' },
];

function ToolbarButton({ onClick, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-200 bg-white text-gray-600 hover:text-amber-800 hover:border-amber-300 transition-colors"
    >
      {children}
    </button>
  );
}

export default function HierarchyMarkmapView({
  tree,
  apiBase = '/sugar-new',
  title = 'Equipment hierarchy',
}) {
  const svgRef = useRef(null);
  const markmapRef = useRef(null);
  const [expandLevel, setExpandLevel] = useState(2);
  const [includeDisciplines, setIncludeDisciplines] = useState(true);
  const [cardsByNodeId, setCardsByNodeId] = useState(null);

  const stats = useMemo(() => countHierarchyNodes(tree), [tree]);
  const expandLevels =
    apiBase === '/sugar-new'
      ? SUGAR_EXPAND_LEVELS
      : apiBase === '/power-new'
        ? POWER_EXPAND_LEVELS
        : GENERIC_EXPAND_LEVELS;

  // Child equipment cards (e.g. "Control valve" under Instrument) for the whole
  // plant in one call — a request per equipment would be ~1,500 round trips.
  useEffect(() => {
    let cancelled = false;
    api
      .get(`${apiBase}/hierarchy/cards`)
      .then(({ data }) => {
        if (!cancelled) setCardsByNodeId(data?.byNodeId || {});
      })
      .catch(() => {
        if (!cancelled) setCardsByNodeId({});
      });
    return () => {
      cancelled = true;
    };
  }, [apiBase]);

  const cardCount = useMemo(() => {
    if (!cardsByNodeId) return 0;
    return Object.values(cardsByNodeId).reduce(
      (total, sections) =>
        total + Object.values(sections).reduce((sum, cards) => sum + cards.length, 0),
      0,
    );
  }, [cardsByNodeId]);

  const markdown = useMemo(
    () =>
      buildHierarchyMarkdown(tree, {
        apiBase,
        includeDisciplines,
        cardsByNodeId,
        initialExpandLevel: expandLevel,
      }),
    [tree, apiBase, includeDisciplines, cardsByNodeId, expandLevel],
  );

  useEffect(() => {
    if (!svgRef.current || !markdown) return;

    const { root, frontmatter } = transformer.transform(markdown);
    const options = deriveOptions(frontmatter?.markmap);

    if (!markmapRef.current) {
      markmapRef.current = Markmap.create(svgRef.current, options, root);
    } else {
      markmapRef.current.setOptions(options);
      markmapRef.current.setData(root);
    }
    markmapRef.current.fit();
  }, [markdown]);

  useEffect(
    () => () => {
      markmapRef.current?.destroy?.();
      markmapRef.current = null;
    },
    [],
  );

  const handleDownload = () => {
    try {
      const html = buildStandaloneMarkmapHtml(markdown, { title });
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = markmapFileName(title);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Mind map downloaded as HTML.');
    } catch {
      toast.error('Could not download the mind map.');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 px-1">
            Hierarchy mind map
          </p>
          <p className="text-xs text-gray-500 px-1 mt-0.5">
            {stats.groups.toLocaleString()} groups · {stats.equipment.toLocaleString()} equipment
            {includeDisciplines
              ? ` · 4 departments each${cardCount ? ` · ${cardCount.toLocaleString()} child equipment` : ''}`
              : ''}{' '}
            — click a node to expand or collapse
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeDisciplines}
              onChange={(e) => setIncludeDisciplines(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
            />
            Departments
          </label>

          <select
            value={expandLevel}
            onChange={(e) => setExpandLevel(Number(e.target.value))}
            className="py-1.5 px-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-amber-500 focus:outline-none"
            title="How many levels to open by default"
          >
            {expandLevels.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1">
            <ToolbarButton onClick={() => markmapRef.current?.rescale(1.25)} title="Zoom in">
              <MdZoomIn className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => markmapRef.current?.rescale(0.8)} title="Zoom out">
              <MdZoomOut className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => markmapRef.current?.fit()} title="Fit to screen">
              <MdCenterFocusStrong className="h-4 w-4" />
            </ToolbarButton>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <MdDownload className="h-4 w-4" />
            Download HTML
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <svg ref={svgRef} className="w-full h-[min(72vh,720px)] block" />
      </div>
    </div>
  );
}
