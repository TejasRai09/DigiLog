import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdAccountTree,
  MdArrowForward,
  MdBolt,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdChevronRight,
  MdClose,
  MdDashboard,
  MdDelete,
  MdDriveFileMove,
  MdEdit,
  MdExpandLess,
  MdExpandMore,
  MdFolder,
  MdHistory,
  MdHub,
  MdSearch,
  MdSelectAll,
  MdSettings,
  MdStar,
  MdStarBorder,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';
import CardOverflowMenu from '../CardOverflowMenu';
import EngineeringDisciplineCards from './EngineeringDisciplineCards';
import HierarchyMoveModal from './HierarchyMoveModal';
import { useHierarchyManage, hierarchyAddAction } from './HierarchyManagePanel';
import {
  disciplineNodesForEquipment,
  ENGINEERING_DISCIPLINES,
} from '../../config/engineeringDisciplines';
import { powerNewDetailPath } from '../../utils/resolveDisciplineSection';
import {
  findNodeById,
  findNodeByPath,
  isHierarchyEquipment,
  isHierarchyGroup,
  isHierarchyNodeLocked,
  pathIdsForNodeId,
  pathLabels,
  splitSugarLeafLabel,
} from '../../utils/hierarchyTreeUtils';
import { isZilEquipNo } from '../../config/powerEquipmentFields';
import useLockedCardManageAccess from '../../hooks/useLockedCardManageAccess';
import useHierarchyStars from '../../hooks/useHierarchyStars';
import useHierarchyMoveHistory from '../../hooks/useHierarchyMoveHistory';

const VIEW_CARDS = 'cards';
const VIEW_TREE = 'tree';
const VIEW_MAP = 'map';
const VIEW_STARRED = 'starred';
const VIEW_MOVE_HISTORY = 'move-history';

// markmap pulls in its own renderer; only load it when the map view is opened.
const HierarchyMarkmapView = lazy(() => import('./HierarchyMarkmapView'));

function matchesNodeSearch(n, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const name = (n.name || '').toLowerCase();
  const tag = (n.equipNo || '').toLowerCase();
  const lookup = (n.lookupName || '').toLowerCase();
  const loc = (n.histLocation || '').toLowerCase();
  return name.includes(q) || tag.includes(q) || lookup.includes(q) || loc.includes(q);
}

function hasMatchingDescendant(n, query) {
  if (!query) return true;
  if (matchesNodeSearch(n, query)) return true;
  for (const child of n.children || []) {
    if (hasMatchingDescendant(child, query)) return true;
  }
  return false;
}

/** What the user can open next from this navigation depth. */
function hierarchyChoiceLabel(apiBase, pathDepth, isEquipmentLeaf) {
  if (isEquipmentLeaf) return 'discipline';
  const isSugar = apiBase === '/sugar-new';
  if (isSugar) {
    if (pathDepth <= 1) return 'section';
    if (pathDepth === 2) return 'location';
    if (pathDepth === 3) return 'main equipment';
    if (pathDepth === 4) return 'sub equipment';
    return 'item';
  }
  if (pathDepth <= 1) return 'category';
  if (pathDepth === 2) return 'subcategory';
  if (pathDepth === 3) return 'equipment';
  return 'item';
}

function collectNodesByIds(root, idSet) {
  if (!root || !idSet?.size) return [];
  const out = [];
  const walk = (node) => {
    if (idSet.has(String(node.id))) out.push(node);
    for (const child of node.children || []) walk(child);
  };
  walk(root);
  return out;
}

function EquipmentCard({
  node,
  onOpen,
  opening,
  showManageActions = false,
  onEdit,
  onDelete,
  onMove,
  onSelect,
  manageSaving = false,
  showHistLocation = false,
  selectMode = false,
  selected = false,
  selectDisabled = false,
  onToggleSelect,
  starred = false,
  onToggleStar,
  pathCaption = '',
}) {
  const isGroup = isHierarchyGroup(node);
  const childCount = node.children?.length ?? 0;
  const Icon = isGroup ? MdFolder : MdSettings;
  const isOpening = opening === node.id;
  const sugarParts = !isGroup && showHistLocation ? splitSugarLeafLabel(node) : null;
  const title = sugarParts?.equipmentName || node.name;
  const locationLine = sugarParts?.location || '';

  const subtitle = () => {
    if (isOpening) return 'Opening…';
    if (isGroup) {
      return childCount === 0
        ? 'Empty folder'
        : `${childCount} item${childCount !== 1 ? 's' : ''}`;
    }
    return `${ENGINEERING_DISCIPLINES.length} disciplines · Choose section`;
  };

  const handleCardClick = () => {
    if (selectMode) {
      if (!selectDisabled) onToggleSelect?.(node);
      return;
    }
    onOpen(node);
  };

  return (
    <div
      role="button"
      tabIndex={isOpening ? -1 : 0}
      onClick={handleCardClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleCardClick();
        }
      }}
      className={`card p-4 text-left w-full transition-all duration-200 group focus:outline-none hover:shadow-md hover:-translate-y-0.5 focus:ring-2 focus:ring-amber-500 ${
        isOpening ? 'opacity-60 pointer-events-none' : ''
      } ${selected ? 'ring-2 ring-amber-400' : ''} ${
        selectDisabled && selectMode ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          {selectMode ? (
            <span className="mt-2 shrink-0 text-amber-700">
              {selected
                ? <MdCheckBox className="h-5 w-5" />
                : <MdCheckBoxOutlineBlank className="h-5 w-5" />}
            </span>
          ) : null}
          <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{title}</h3>
            {locationLine ? (
              <p className="text-xs text-gray-600 mt-1 leading-snug">
                <span className="font-semibold text-slate-500">Location:</span>{' '}
                {locationLine}
              </p>
            ) : null}
            {showHistLocation && node.equipNo ? (
              <p className="text-xs text-gray-600 mt-1 leading-snug">
                <span className="font-semibold text-slate-500">Tag:</span>{' '}
                {node.equipNo}
              </p>
            ) : null}
            <p className="text-xs text-gray-500 mt-1">{subtitle()}</p>
            {pathCaption ? (
              <p className="text-xs text-slate-400 mt-1 truncate">{pathCaption}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onToggleStar ? (
            <button
              type="button"
              title={starred ? 'Remove from starred' : 'Star this card'}
              onClick={(event) => {
                event.stopPropagation();
                onToggleStar(node);
              }}
              className={`p-1.5 rounded-lg ${
                starred ? 'text-amber-500 hover:bg-amber-50' : 'text-slate-300 hover:text-amber-500 hover:bg-amber-50'
              }`}
            >
              {starred ? <MdStar className="h-5 w-5" /> : <MdStarBorder className="h-5 w-5" />}
            </button>
          ) : null}
          {showManageActions && !selectMode && (
            <CardOverflowMenu
              disabled={manageSaving}
              items={[
                { label: 'Move', icon: MdDriveFileMove, onClick: () => onMove?.(node) },
                { label: 'Select', icon: MdSelectAll, onClick: () => onSelect?.(node) },
                { label: 'Edit', icon: MdEdit, onClick: () => onEdit?.(node) },
                { label: 'Delete', icon: MdDelete, danger: true, onClick: () => onDelete?.(node) },
              ]}
            />
          )}
          {isGroup ? (
            <MdChevronRight className="h-5 w-5 text-gray-400 group-hover:text-amber-600 mt-0.5" />
          ) : (
            <MdArrowForward className="h-5 w-5 text-gray-400 group-hover:text-amber-600 mt-0.5" />
          )}
        </div>
      </div>
    </div>
  );
}

function TreeBranch({
  node,
  depth = 0,
  defaultOpen = false,
  onOpenDiscipline,
  opening,
  activeDisciplineId = null,
  searchTerm = '',
}) {
  const query = searchTerm.trim().toLowerCase();
  if (query && !hasMatchingDescendant(node, query)) {
    return null;
  }

  const isGroup = isHierarchyGroup(node);
  const isEquipment = isHierarchyEquipment(node);
  const hierarchyChildren = node.children ?? [];
  const disciplineChildren = isEquipment ? disciplineNodesForEquipment(node) : [];

  const isSearchExpanding = Boolean(query && isGroup && hasMatchingDescendant(node, query));
  const [open, setOpen] = useState(defaultOpen || depth < 1);
  const effectiveOpen = isSearchExpanding || open;
  const isOpening = opening === node.id;

  if (isEquipment) {
    const equipmentSelected = activeDisciplineId != null;
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex w-full items-center gap-2 py-1.5 text-sm text-left rounded-md pr-2 ${
            equipmentSelected
              ? 'bg-amber-50/90 text-amber-900'
              : 'text-gray-700 hover:bg-amber-50/80'
          }`}
          style={{ paddingLeft: `${depth * 1.25}rem` }}
        >
          {effectiveOpen ? (
            <MdExpandLess className="h-5 w-5 text-gray-500 shrink-0" />
          ) : (
            <MdExpandMore className="h-5 w-5 text-gray-500 shrink-0" />
          )}
          <MdSettings className="h-4 w-4 text-amber-600 shrink-0" />
          <span className={isOpening ? 'text-amber-700 font-medium' : ''}>{node.name}</span>
        </button>
        {effectiveOpen && (
          <div>
            {disciplineChildren.map((disciplineNode) => {
              const isActive = activeDisciplineId === disciplineNode.disciplineId;
              const disciplineOpening = opening === `${node.id}--${disciplineNode.disciplineId}`;
              return (
                <button
                  key={disciplineNode.id}
                  type="button"
                  onClick={() => onOpenDiscipline(disciplineNode)}
                  disabled={disciplineOpening}
                  className={`flex w-full items-center gap-2 py-1.5 text-sm text-left rounded-md pr-2 disabled:opacity-60 ${
                    isActive
                      ? 'bg-amber-100/90 text-amber-900 font-medium'
                      : 'text-gray-600 hover:bg-amber-50/80'
                  }`}
                  style={{ paddingLeft: `${(depth + 1) * 1.25}rem` }}
                >
                  <span className="w-5 shrink-0" />
                  <MdBolt className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>{disciplineNode.name}</span>
                  {disciplineOpening && <span className="text-xs text-gray-400 ml-1">Opening…</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (!isGroup) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 py-1.5 text-sm text-left text-gray-800 hover:bg-amber-50/80 rounded-md pr-2"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        {effectiveOpen ? (
          <MdExpandLess className="h-5 w-5 text-gray-500 shrink-0" />
        ) : (
          <MdExpandMore className="h-5 w-5 text-gray-500 shrink-0" />
        )}
        <MdFolder className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="font-medium">{node.name}</span>
        <span className="text-xs text-gray-400 ml-1">({hierarchyChildren.length})</span>
      </button>
      {effectiveOpen && hierarchyChildren.length > 0 && (
        <div>
          {hierarchyChildren.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              onOpenDiscipline={onOpenDiscipline}
              opening={opening}
              activeDisciplineId={activeDisciplineId}
              searchTerm={searchTerm}
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
      <button
        type="button"
        onClick={() => onChange(VIEW_MAP)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          view === VIEW_MAP
            ? 'bg-white text-amber-800 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-pressed={view === VIEW_MAP}
      >
        <MdHub className="h-4 w-4" />
        Mind map
      </button>
      <button
        type="button"
        onClick={() => onChange(VIEW_STARRED)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          view === VIEW_STARRED
            ? 'bg-white text-amber-800 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-pressed={view === VIEW_STARRED}
      >
        <MdStar className="h-4 w-4" />
        Starred
      </button>
      <button
        type="button"
        onClick={() => onChange(VIEW_MOVE_HISTORY)}
        className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
          view === VIEW_MOVE_HISTORY
            ? 'bg-white text-amber-800 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        }`}
        aria-pressed={view === VIEW_MOVE_HISTORY}
      >
        <MdHistory className="h-4 w-4" />
        Move history
      </button>
    </div>
  );
}

function formatMoveWhen(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function moveFolderPath(fullPath, nodeName) {
  const full = String(fullPath || '').trim();
  const name = String(nodeName || '').trim();
  if (!full) return '—';
  if (name) {
    const suffix = ` › ${name}`;
    if (full.endsWith(suffix)) {
      const parent = full.slice(0, -suffix.length).trim();
      return parent || '—';
    }
  }
  return full;
}

export default function PowerPlantHierarchyExplorer({
  tree = null,
  treeLoading = false,
  onReloadTree = null,
  hierarchySource = 'static',
  appId = null,
  returnTo = '/power-plant-equipment-new',
  apiBase = '/power-new',
  equipIdField = 'ppnEquipId',
  detailPathFn = powerNewDetailPath,
  getAddAction = hierarchyAddAction,
  pathIds = [],
  activeEquipmentId = null,
  onNavigationChange = null,
}) {
  const navigate = useNavigate();
  const [view, setView] = useState(VIEW_CARDS);
  const [opening, setOpening] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [moveNodes, setMoveNodes] = useState(null);
  const [moveSaving, setMoveSaving] = useState(false);
  const { canManageApiBase } = useLockedCardManageAccess();
  const canManageLockedCards = canManageApiBase(apiBase);
  const { starredIds, isStarred, toggleStar } = useHierarchyStars(apiBase);
  const {
    entries: moveHistory,
    loading: moveHistoryLoading,
    reload: reloadMoveHistory,
  } = useHierarchyMoveHistory(apiBase, { enabled: view === VIEW_MOVE_HISTORY });

  const isDbTree = hierarchySource === 'database';

  const activeEquipment = useMemo(
    () => (activeEquipmentId && tree ? findNodeById(tree, activeEquipmentId) : null),
    [activeEquipmentId, tree],
  );

  const currentNode = useMemo(
    () => (tree ? findNodeByPath(tree, pathIds) : null),
    [tree, pathIds],
  );

  const {
    addButton,
    manageModal,
    openEdit,
    deleteNode,
    saving: manageSaving,
  } = useHierarchyManage({
    tree,
    pathIds,
    activeEquipment,
    onReload: onReloadTree,
    isDbTree,
    apiBase,
    getAddAction,
    canManageLockedCards,
  });

  const updateNavigation = (nextPathIds, nextActiveEquipmentId = null) => {
    if (!moveNodes?.length) exitSelectMode();
    onNavigationChange?.({
      pathIds: nextPathIds,
      activeEquipmentId: nextActiveEquipmentId,
    });
  };

  const displayCards = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const directChildren = currentNode?.children ?? [];
    if (!query) return directChildren;

    const collectDescendants = (node) => {
      let list = [];
      for (const child of node.children || []) {
        list.push(child);
        if (isHierarchyGroup(child)) {
          list = list.concat(collectDescendants(child));
        }
      }
      return list;
    };

    const searchTargetNodes = currentNode
      ? collectDescendants(currentNode)
      : (tree ? collectDescendants(tree) : []);

    return searchTargetNodes.filter((n) => matchesNodeSearch(n, query));
  }, [currentNode, tree, searchTerm]);

  const starredCards = useMemo(() => {
    const nodes = collectNodesByIds(tree, starredIds).filter(
      (node) => String(node.id) !== String(tree?.id),
    );
    const query = searchTerm.trim().toLowerCase();
    if (!query) return nodes;
    return nodes.filter((node) => matchesNodeSearch(node, query));
  }, [tree, starredIds, searchTerm]);

  const filteredMoveHistory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return moveHistory;
    return moveHistory.filter((entry) => {
      const haystack = [
        entry.userName,
        entry.nodeName,
        entry.fromPath,
        entry.toPath,
        entry.fromParentName,
        entry.toParentName,
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [moveHistory, searchTerm]);

  const childCount = displayCards.length;

  const currentPosition = useMemo(() => {
    const focusNode = activeEquipment || currentNode || tree;
    if (!focusNode) return null;

    const isLeaf = Boolean(activeEquipment);
    const choice = hierarchyChoiceLabel(apiBase, pathIds?.length ?? 0, isLeaf);
    const sugarParts =
      apiBase === '/sugar-new' && isLeaf ? splitSugarLeafLabel(focusNode) : null;
    const name = sugarParts?.equipmentName || focusNode.name || 'Unknown';

    return { name, choice };
  }, [activeEquipment, currentNode, tree, apiBase, pathIds]);

  const cardManageActionsEnabled = (node) =>
    Boolean(openEdit) && isDbTree && tree && !isHierarchyNodeLocked(tree, node, apiBase, canManageLockedCards);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const startSelectMode = (node) => {
    if (searchTerm.trim()) {
      toast.error('Clear search to select items.');
      return;
    }
    setSelectMode(true);
    setSelectedIds(node ? new Set([String(node.id)]) : new Set());
  };

  const toggleSelect = (node) => {
    if (!cardManageActionsEnabled(node)) return;
    const id = String(node.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCards = displayCards.filter((node) => selectedIds.has(String(node.id)));
  const movePickMode = Boolean(moveNodes?.length);

  const startMovePick = (nodes) => {
    const list = (nodes || []).filter((node) => cardManageActionsEnabled(node));
    if (!list.length) {
      toast.error('Select at least one item you can move.');
      return;
    }
    setMoveNodes(list);
  };

  const cancelMovePick = () => {
    if (moveSaving) return;
    setMoveNodes(null);
  };

  const confirmMove = async (targetParentId) => {
    if (!moveNodes?.length) return;
    setMoveSaving(true);
    try {
      const { data } = await api.post(`${apiBase}/hierarchy/move`, {
        nodeIds: moveNodes.map((node) => Number(node.dbId || node.id)),
        targetParentId,
      });
      toast.success(data?.message || 'Moved.');
      setMoveNodes(null);
      exitSelectMode();
      await onReloadTree?.({ silent: true });
      reloadMoveHistory();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Move failed.');
    } finally {
      setMoveSaving(false);
    }
  };

  const buildNavState = (node, specSection = null) => ({
    appId: appId != null && appId !== '' ? String(appId) : undefined,
    returnTo,
    fromHierarchy: true,
    hierarchyPathIds: tree ? pathIdsForNodeId(tree, node.id) : [],
    restoreEquipmentId: node.id,
    ...(specSection ? { specSection } : {}),
  });

  const equipmentDetailPath = (equipId, specSection = null) => detailPathFn(equipId, specSection);

  const openDraftEquipment = (node, specSection = null) => {
    if (!tree) return;
    const lookupName = node.lookupName || node.name;
    const nodePathIds = pathIdsForNodeId(tree, node.id);
    const labels = pathLabels(tree, nodePathIds);
    const category = labels[1] || '';
    const subcategory = labels[2] || '';
    const equipNo = node.equipNo || '';
    navigate(equipmentDetailPath('new', specSection), {
      state: {
        ...buildNavState(node, specSection),
        draftEquipment: {
          name: lookupName,
          equip_no: isZilEquipNo(equipNo) ? equipNo : '',
          tag_name: equipNo && !isZilEquipNo(equipNo) ? equipNo : '',
          category,
          subcategory,
          location: node.histLocation || '',
        },
      },
    });
  };

  const openEquipment = async (node, specSection = null) => {
    const lookupName = node.lookupName || node.name;
    const openingKey = specSection ? `${node.id}--${specSection}` : node.id;

    const linkedEquipId = node[equipIdField];
    if (linkedEquipId) {
      navigate(equipmentDetailPath(linkedEquipId, specSection), {
        state: buildNavState(node, specSection),
      });
      return;
    }

    if (!node.equipNo && !lookupName) {
      openDraftEquipment(node, specSection);
      return;
    }

    setOpening(openingKey);
    try {
      const params = {};
      if (node.equipNo) params.equip_no = node.equipNo;
      if (lookupName) params.name = lookupName;
      if (node.histLocation) params.location = node.histLocation;

      // Pass full path context (category = boiler branch, subcategory = section)
      // so lookup is scoped to this exact hierarchy position, preventing cross-boiler collisions.
      const nodePathIds = pathIdsForNodeId(tree, node.id);
      const nodeLabels = pathLabels(tree, nodePathIds);
      // nodeLabels[0] = root ("Power Plant"), [1] = category (e.g. "150TPH BLR"), [2] = subcategory
      const categoryLabel = nodeLabels[1] || '';
      const subcategoryLabel = nodeLabels[2] || '';
      if (categoryLabel) params.category = categoryLabel;
      if (subcategoryLabel) params.subcategory = subcategoryLabel;

      const { data } = await api.get(`${apiBase}/lookup`, { params });
      const { id } = data.equipment;
      navigate(equipmentDetailPath(id, specSection), { state: buildNavState(node, specSection) });
    } catch (err) {
      if (err.response?.status === 404) {
        openDraftEquipment(node, specSection);
      } else {
        toast.error(err.response?.data?.message || 'Could not open equipment.');
      }
    } finally {
      setOpening(null);
    }
  };

  const handleNodeOpen = (node) => {
    if (!tree) return;
    if (isHierarchyGroup(node)) {
      updateNavigation(pathIdsForNodeId(tree, node.id), null);
      return;
    }
    updateNavigation(pathIdsForNodeId(tree, node.id).slice(0, -1), node.id);
  };

  const openStarredNode = (node) => {
    handleNodeOpen(node);
    setView(VIEW_CARDS);
  };

  const openHistoryNode = (entry) => {
    const node = tree ? findNodeById(tree, entry.nodeId) : null;
    if (!node) {
      toast.error('That card is no longer in the hierarchy.');
      return;
    }
    handleNodeOpen(node);
    setView(VIEW_CARDS);
  };

  const handleDisciplineOpen = (disciplineNode) => {
    const equipment = disciplineNode.equipmentNode;
    if (!equipment) return;
    openEquipment(equipment, disciplineNode.disciplineId);
  };

  if (treeLoading && !tree) {
    return (
      <div className="card p-12 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="card p-8 text-center text-sm text-gray-500">
        Could not load equipment hierarchy.
      </div>
    );
  }

  return (
    <>
      <div className="card overflow-visible">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {view === VIEW_STARRED ? (
              <>
                <h2 className="text-base font-semibold text-gray-900">Starred</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Open a folder or equipment card to go there
                </p>
              </>
            ) : view === VIEW_MOVE_HISTORY ? (
              <>
                <h2 className="text-base font-semibold text-gray-900">Move history</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Card moves by every user, with their name
                </p>
              </>
            ) : currentPosition ? (
              <>
                <h2 className="text-base font-semibold text-gray-900">
                  You are currently in {currentPosition.name}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  You can choose any one {currentPosition.choice}
                </p>
              </>
            ) : (
              <h2 className="text-base font-semibold text-gray-900">Equipment hierarchy</h2>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectMode ? (
              <>
                <span className="text-xs font-semibold text-slate-600">
                  {selectedCards.length} selected
                </span>
                <button
                  type="button"
                  disabled={moveSaving || !selectedCards.length}
                  onClick={() => startMovePick(selectedCards)}
                  className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg border border-amber-200 disabled:opacity-50"
                >
                  <MdDriveFileMove className="w-3.5 h-3.5" />
                  Move
                </button>
                <button
                  type="button"
                  onClick={exitSelectMode}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
                >
                  Cancel
                </button>
              </>
            ) : view === VIEW_STARRED || view === VIEW_MOVE_HISTORY ? null : (
              addButton
            )}
            <div className="relative">
              <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  if (selectMode) exitSelectMode();
                }}
                placeholder={view === VIEW_MOVE_HISTORY ? 'Search user or card...' : 'Search tag or name...'}
                className="w-44 sm:w-56 pl-8 pr-7 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:border-amber-500 focus:outline-none transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                  title="Clear search"
                >
                  <MdClose className="h-4 w-4" />
                </button>
              )}
            </div>
            <ViewToggle view={view} onChange={setView} />
          </div>
        </div>

        <div className="p-5">
          {view === VIEW_STARRED ? (
            starredCards.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                {searchTerm
                  ? <>No starred items matching &ldquo;<span className="font-medium text-gray-700">{searchTerm}</span>&rdquo;.</>
                  : 'No starred folders or equipment yet. Tap the star on a card to add it here.'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {starredCards.map((node) => (
                  <EquipmentCard
                    key={node.id}
                    node={node}
                    onOpen={openStarredNode}
                    opening={opening}
                    showManageActions={false}
                    showHistLocation={apiBase === '/sugar-new'}
                    starred={isStarred(node)}
                    onToggleStar={toggleStar}
                    pathCaption={pathLabels(tree, pathIdsForNodeId(tree, node.id)).slice(0, -1).join(' › ')}
                  />
                ))}
              </div>
            )
          ) : view === VIEW_MOVE_HISTORY ? (
            moveHistoryLoading && moveHistory.length === 0 ? (
              <div className="py-16 flex justify-center">
                <Spinner />
              </div>
            ) : filteredMoveHistory.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">
                {searchTerm
                  ? <>No moves matching &ldquo;<span className="font-medium text-gray-700">{searchTerm}</span>&rdquo;.</>
                  : 'No card moves yet. When someone moves a folder or equipment card, it will show up here with their name.'}
              </p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 shadow-sm">
                <table className="w-full table-fixed">
                  <colgroup>
                    <col className="w-[14%]" />
                    <col className="w-[22%]" />
                    <col className="w-[25%]" />
                    <col className="w-[25%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="th">User</th>
                      <th className="th">Card</th>
                      <th className="th">From</th>
                      <th className="th">To</th>
                      <th className="th">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredMoveHistory.map((entry) => {
                      const stillExists = Boolean(tree && findNodeById(tree, entry.nodeId));
                      const fromFolder = moveFolderPath(entry.fromPath, entry.nodeName);
                      const toFolder = moveFolderPath(entry.toPath, entry.nodeName);
                      return (
                        <tr key={entry.id} className="hover:bg-amber-50/40">
                          <td className="px-3 py-2.5 text-sm font-medium text-gray-900 whitespace-normal break-words sm:px-4">
                            {entry.userName}
                          </td>
                          <td className="px-3 py-2.5 text-sm whitespace-normal break-words sm:px-4">
                            {stillExists ? (
                              <button
                                type="button"
                                onClick={() => openHistoryNode(entry)}
                                className="text-left font-medium text-amber-800 hover:underline"
                              >
                                {entry.nodeName}
                              </button>
                            ) : (
                              <span className="font-medium text-gray-900">{entry.nodeName}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-normal break-words sm:px-4">
                            {fromFolder !== '—' ? fromFolder : (entry.fromParentName || '—')}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-600 whitespace-normal break-words sm:px-4">
                            {toFolder !== '—' ? toFolder : (entry.toParentName || '—')}
                          </td>
                          <td className="px-3 py-2.5 text-sm text-gray-500 whitespace-normal break-words sm:px-4">
                            {formatMoveWhen(entry.createdAt)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : view === VIEW_CARDS ? (
            activeEquipment ? (
              <EngineeringDisciplineCards
                equipmentNode={activeEquipment}
                onSelectDiscipline={(discipline) => openEquipment(activeEquipment, discipline.id)}
                onBack={() => updateNavigation(pathIds, null)}
                opening={opening?.includes('--') ? opening.split('--')[1] : null}
              />
            ) : (
              <>
                {childCount === 0 ? (
                  <p className="text-sm text-gray-500 py-8 text-center">
                    {searchTerm ? (
                      <>
                        No items matching &ldquo;<span className="font-medium text-gray-700">{searchTerm}</span>&rdquo; under{' '}
                        <span className="font-medium text-gray-700">{currentNode?.name}</span>.
                      </>
                    ) : (
                      <>
                        No sub-equipment under{' '}
                        <span className="font-medium text-gray-700">{currentNode?.name}</span>.
                        {isDbTree && !activeEquipment && ' Use the add button above to create items here.'}
                      </>
                    )}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {displayCards.map((node) => (
                      <EquipmentCard
                        key={node.id}
                        node={node}
                        onOpen={handleNodeOpen}
                        opening={opening}
                        showManageActions={cardManageActionsEnabled(node)}
                        onEdit={openEdit}
                        onDelete={deleteNode}
                        onMove={(item) => startMovePick([item])}
                        onSelect={startSelectMode}
                        manageSaving={manageSaving || moveSaving}
                        showHistLocation={apiBase === '/sugar-new'}
                        selectMode={selectMode}
                        selected={selectedIds.has(String(node.id))}
                        selectDisabled={!cardManageActionsEnabled(node)}
                        onToggleSelect={toggleSelect}
                        starred={isStarred(node)}
                        onToggleStar={isDbTree ? toggleStar : undefined}
                      />
                    ))}
                  </div>
                )}
              </>
            )
          ) : view === VIEW_TREE ? (
            <div className="max-h-[min(70vh,720px)] overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
                Interactive tree structure
              </p>
              <TreeBranch
                node={tree}
                defaultOpen
                onOpenDiscipline={handleDisciplineOpen}
                opening={opening}
                searchTerm={searchTerm}
              />
            </div>
          ) : (
            <Suspense
              fallback={
                <div className="py-16 flex justify-center">
                  <Spinner />
                </div>
              }
            >
              <HierarchyMarkmapView
                tree={tree}
                apiBase={apiBase}
                title={tree?.name || 'Equipment hierarchy'}
              />
            </Suspense>
          )}
        </div>
      </div>
      {movePickMode ? (
        <HierarchyMoveModal
          tree={tree}
          sourceNodes={moveNodes}
          saving={moveSaving}
          onClose={cancelMovePick}
          onConfirm={confirmMove}
        />
      ) : manageModal}
    </>
  );
}
