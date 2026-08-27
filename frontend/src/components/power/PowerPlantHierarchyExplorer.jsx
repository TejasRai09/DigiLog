import { lazy, Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdAccountTree,
  MdArrowForward,
  MdBolt,
  MdChevronRight,
  MdClose,
  MdDashboard,
  MdDelete,
  MdEdit,
  MdExpandLess,
  MdExpandMore,
  MdFolder,
  MdHub,
  MdSearch,
  MdSettings,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';
import EngineeringDisciplineCards from './EngineeringDisciplineCards';
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

const VIEW_CARDS = 'cards';
const VIEW_TREE = 'tree';
const VIEW_MAP = 'map';

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

function EquipmentCard({
  node,
  onOpen,
  opening,
  showManageActions = false,
  onEdit,
  onDelete,
  manageSaving = false,
  showHistLocation = false,
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
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {showManageActions && (
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled={manageSaving}
                onClick={() => onEdit?.(node)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50"
                title="Edit"
              >
                <MdEdit className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={manageSaving}
                onClick={() => onDelete?.(node)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                title="Delete"
              >
                <MdDelete className="h-4 w-4" />
              </button>
            </div>
          )}
          {isGroup ? (
            <MdChevronRight className="h-5 w-5 text-gray-400 group-hover:text-amber-600 mt-0.5" />
          ) : (
            <MdArrowForward className="h-5 w-5 text-gray-400 group-hover:text-amber-600 mt-0.5" />
          )}
        </div>
      </div>
    </button>
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
    </div>
  );
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
  });

  const updateNavigation = (nextPathIds, nextActiveEquipmentId = null) => {
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
    isDbTree && tree && !isHierarchyNodeLocked(tree, node, apiBase);

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
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {currentPosition ? (
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
            {addButton}
            <div className="relative">
              <MdSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search tag or name..."
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
          {view === VIEW_CARDS ? (
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
                        manageSaving={manageSaving}
                        showHistLocation={apiBase === '/sugar-new'}
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
      {manageModal}
    </>
  );
}
