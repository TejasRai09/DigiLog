import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdAccountTree,
  MdArrowForward,
  MdChevronRight,
  MdDashboard,
  MdExpandLess,
  MdExpandMore,
  MdFolder,
  MdSettings,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import {
  POWER_PLANT_EQUIPMENT_TREE,
  findNodeByPath,
  pathIdsForNodeId,
  pathLabels,
} from '../../config/powerPlantEquipmentHierarchy';
import { isZilEquipNo } from '../../config/powerEquipmentFields';

const VIEW_CARDS = 'cards';
const VIEW_TREE = 'tree';

function HierarchyBreadcrumb({ pathIds, onNavigate }) {
  const labels = pathLabels(POWER_PLANT_EQUIPMENT_TREE, pathIds);
  if (labels.length <= 1) return null;

  return (
    <nav className="flex flex-wrap items-center gap-1 text-sm text-gray-500 mb-4" aria-label="Equipment path">
      {labels.map((label, i) => {
        const isLast = i === labels.length - 1;
        const targetPath = pathIds.slice(0, i + 1);
        return (
          <span key={targetPath.join('/')} className="inline-flex items-center gap-1">
            {i > 0 && <MdChevronRight className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />}
            {isLast ? (
              <span className="font-medium text-gray-800">{label}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(targetPath)}
                className="hover:text-amber-700 hover:underline"
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}

function EquipmentCard({ node, onOpen, opening }) {
  const hasChildren = node.children?.length > 0;
  const Icon = hasChildren ? MdFolder : MdSettings;
  const isOpening = opening === node.id;

  return (
    <button
      type="button"
      onClick={() => onOpen(node)}
      disabled={isOpening}
      className="card p-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:pointer-events-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{node.name}</h3>
            <p className="text-xs text-gray-500 mt-1">
              {isOpening
                ? 'Opening…'
                : hasChildren
                  ? `${node.children.length} item${node.children.length !== 1 ? 's' : ''}`
                  : node.equipNo
                    ? `${node.equipNo} · Open history`
                    : 'Open equipment history'}
            </p>
          </div>
        </div>
        {hasChildren ? (
          <MdChevronRight className="h-5 w-5 text-gray-400 group-hover:text-amber-600 shrink-0 mt-0.5" />
        ) : (
          <MdArrowForward className="h-5 w-5 text-gray-400 group-hover:text-amber-600 shrink-0 mt-0.5" />
        )}
      </div>
    </button>
  );
}

function TreeBranch({ node, depth = 0, defaultOpen = false, onOpenLeaf, opening }) {
  const hasChildren = node.children?.length > 0;
  const [open, setOpen] = useState(defaultOpen || depth < 1);
  const isOpening = opening === node.id;

  if (!hasChildren) {
    return (
      <button
        type="button"
        onClick={() => onOpenLeaf(node)}
        disabled={isOpening}
        className="flex w-full items-center gap-2 py-1.5 text-sm text-left text-gray-700 hover:bg-amber-50/80 rounded-md pr-2 disabled:opacity-60"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        <span className="w-5 shrink-0" />
        <MdSettings className="h-4 w-4 text-amber-600 shrink-0" />
        <span className={isOpening ? 'text-amber-700' : ''}>{node.name}</span>
        {node.equipNo && (
          <span className="text-xs font-mono text-gray-400 ml-1">{node.equipNo}</span>
        )}
        {isOpening && <span className="text-xs text-gray-400 ml-1">Opening…</span>}
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-1.5 text-sm text-left text-gray-800 hover:bg-amber-50/80 rounded-md pr-2"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        {open ? (
          <MdExpandLess className="h-5 w-5 text-gray-500 shrink-0" />
        ) : (
          <MdExpandMore className="h-5 w-5 text-gray-500 shrink-0" />
        )}
        <MdFolder className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="font-medium">{node.name}</span>
        <span className="text-xs text-gray-400 ml-1">({node.children.length})</span>
      </button>
      {open && (
        <div>
          {node.children.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              onOpenLeaf={onOpenLeaf}
              opening={opening}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewToggle({ view, onChange }) {
  return (
    <div
      className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5"
      role="group"
      aria-label="Hierarchy view mode"
    >
      <button
        type="button"
        onClick={() => onChange(VIEW_CARDS)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          view === VIEW_CARDS
            ? 'bg-white text-amber-800 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-pressed={view === VIEW_CARDS}
      >
        <MdDashboard className="h-4 w-4" />
        Cards
      </button>
      <button
        type="button"
        onClick={() => onChange(VIEW_TREE)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          view === VIEW_TREE
            ? 'bg-white text-amber-800 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-pressed={view === VIEW_TREE}
      >
        <MdAccountTree className="h-4 w-4" />
        Tree
      </button>
    </div>
  );
}

export default function PowerPlantHierarchyExplorer({
  appId = null,
  returnTo = '/power-plant-equipment-new',
  apiBase = '/power-new',
  detailPrefix = '/power-plant-equipment-new',
}) {
  const navigate = useNavigate();
  const [view, setView] = useState(VIEW_CARDS);
  const [pathIds, setPathIds] = useState([POWER_PLANT_EQUIPMENT_TREE.id]);
  const [opening, setOpening] = useState(null);

  const currentNode = useMemo(
    () => findNodeByPath(POWER_PLANT_EQUIPMENT_TREE, pathIds),
    [pathIds],
  );

  const cards = currentNode.children ?? [];
  const childCount = cards.length;

  const openDraftEquipment = (node) => {
    const lookupName = node.lookupName || node.name;
    const pathIds = pathIdsForNodeId(node.id);
    const labels = pathLabels(POWER_PLANT_EQUIPMENT_TREE, pathIds);
    const category = labels[1] || '';
    const subcategory = labels[2] || '';
    const equipNo = node.equipNo || '';
    navigate(`${detailPrefix}/new`, {
      state: {
        appId: appId != null && appId !== '' ? String(appId) : undefined,
        returnTo,
        fromHierarchy: true,
        draftEquipment: {
          name: lookupName,
          equip_no: isZilEquipNo(equipNo) ? equipNo : '',
          tag_name: equipNo && !isZilEquipNo(equipNo) ? equipNo : '',
          category,
          subcategory,
        },
      },
    });
  };

  const openEquipment = async (node) => {
    const lookupName = node.lookupName || node.name;
    if (!node.equipNo && !lookupName) {
      openDraftEquipment(node);
      return;
    }
    setOpening(node.id);
    try {
      const params = {};
      if (node.equipNo) params.equip_no = node.equipNo;
      if (lookupName) params.name = lookupName;

      const { data } = await api.get(`${apiBase}/lookup`, { params });
      const { id } = data.equipment;
      const navState = {
        appId: appId != null && appId !== '' ? String(appId) : undefined,
        returnTo,
        fromHierarchy: true,
      };
      navigate(`${detailPrefix}/${id}`, { state: navState });
    } catch (err) {
      if (err.response?.status === 404) {
        openDraftEquipment(node);
      } else {
        toast.error(err.response?.data?.message || 'Could not open equipment.');
      }
    } finally {
      setOpening(null);
    }
  };

  const handleNodeOpen = (node) => {
    if (node.children?.length) {
      setPathIds(pathIdsForNodeId(node.id));
      return;
    }
    openEquipment(node);
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Equipment hierarchy</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {view === VIEW_CARDS
              ? `${childCount} item${childCount !== 1 ? 's' : ''} at this level`
              : 'Full plant structure — click equipment to open history'}
          </p>
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="p-5">
        {view === VIEW_CARDS ? (
          <>
            <HierarchyBreadcrumb pathIds={pathIds} onNavigate={setPathIds} />
            {childCount === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                No sub-equipment under <span className="font-medium text-gray-700">{currentNode.name}</span>.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cards.map((node) => (
                  <EquipmentCard
                    key={node.id}
                    node={node}
                    onOpen={handleNodeOpen}
                    opening={opening}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="max-h-[min(70vh,720px)] overflow-y-auto pr-1">
            <TreeBranch
              node={POWER_PLANT_EQUIPMENT_TREE}
              defaultOpen
              onOpenLeaf={openEquipment}
              opening={opening}
            />
          </div>
        )}
      </div>
    </div>
  );
}
