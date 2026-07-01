import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdAccountTree,
  MdArrowForward,
  MdBolt,
  MdChevronRight,
  MdDashboard,
  MdDelete,
  MdEdit,
  MdExpandLess,
  MdExpandMore,
  MdFolder,
  MdSettings,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';
import EngineeringDisciplineCards from './EngineeringDisciplineCards';
import { useHierarchyManage } from './HierarchyManagePanel';
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
  isProtectedSeededNode,
  pathIdsForNodeId,
  pathLabels,
} from '../../utils/hierarchyTreeUtils';
import { isZilEquipNo } from '../../config/powerEquipmentFields';

const VIEW_CARDS = 'cards';
const VIEW_TREE = 'tree';

function EquipmentCard({
  node,
  onOpen,
  opening,
  showManageActions = false,
  onEdit,
  onDelete,
  manageSaving = false,
}) {
  const isGroup = isHierarchyGroup(node);
  const childCount = node.children?.length ?? 0;
  const Icon = isGroup ? MdFolder : MdSettings;
  const isOpening = opening === node.id;

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
            <h3 className="text-sm font-semibold text-gray-900 leading-snug">{node.name}</h3>
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
}) {
  const isGroup = isHierarchyGroup(node);
  const isEquipment = isHierarchyEquipment(node);
  const hierarchyChildren = node.children ?? [];
  const disciplineChildren = isEquipment ? disciplineNodesForEquipment(node) : [];
  const [open, setOpen] = useState(defaultOpen || depth < 1);
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
          {open ? (
            <MdExpandLess className="h-5 w-5 text-gray-500 shrink-0" />
          ) : (
            <MdExpandMore className="h-5 w-5 text-gray-500 shrink-0" />
          )}
          <MdSettings className="h-4 w-4 text-amber-600 shrink-0" />
          <span className={isOpening ? 'text-amber-700 font-medium' : ''}>{node.name}</span>
          {node.equipNo && (
            <span className="text-xs font-mono text-gray-400 ml-1">{node.equipNo}</span>
          )}
        </button>
        {open && (
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
        {open ? (
          <MdExpandLess className="h-5 w-5 text-gray-500 shrink-0" />
        ) : (
          <MdExpandMore className="h-5 w-5 text-gray-500 shrink-0" />
        )}
        <MdFolder className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="font-medium">{node.name}</span>
        <span className="text-xs text-gray-400 ml-1">({hierarchyChildren.length})</span>
      </button>
      {open && hierarchyChildren.length > 0 && (
        <div>
          {hierarchyChildren.map((child) => (
            <TreeBranch
              key={child.id}
              node={child}
              depth={depth + 1}
              onOpenDiscipline={onOpenDiscipline}
              opening={opening}
              activeDisciplineId={activeDisciplineId}
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
  tree = null,
  treeLoading = false,
  onReloadTree = null,
  hierarchySource = 'static',
  appId = null,
  returnTo = '/power-plant-equipment-new',
  apiBase = '/power-new',
  pathIds = [],
  activeEquipmentId = null,
  onNavigationChange = null,
}) {
  const navigate = useNavigate();
  const [view, setView] = useState(VIEW_CARDS);
  const [opening, setOpening] = useState(null);

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
  });

  const updateNavigation = (nextPathIds, nextActiveEquipmentId = null) => {
    onNavigationChange?.({
      pathIds: nextPathIds,
      activeEquipmentId: nextActiveEquipmentId,
    });
  };

  const cards = currentNode?.children ?? [];
  const childCount = cards.length;

  const cardManageActionsEnabled = (node) =>
    isDbTree && tree && !isProtectedSeededNode(tree, node.id);

  const buildNavState = (node, specSection = null) => ({
    appId: appId != null && appId !== '' ? String(appId) : undefined,
    returnTo,
    fromHierarchy: true,
    hierarchyPathIds: tree ? pathIdsForNodeId(tree, node.id) : [],
    restoreEquipmentId: node.id,
    ...(specSection ? { specSection } : {}),
  });

  const equipmentDetailPath = (equipId, specSection = null) => powerNewDetailPath(equipId, specSection);

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
        },
      },
    });
  };

  const openEquipment = async (node, specSection = null) => {
    const lookupName = node.lookupName || node.name;
    const openingKey = specSection ? `${node.id}--${specSection}` : node.id;

    if (node.ppnEquipId) {
      navigate(equipmentDetailPath(node.ppnEquipId, specSection), {
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
            <h2 className="text-base font-semibold text-gray-800">Equipment hierarchy</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {activeEquipment
                ? activeEquipment.name
                : view === VIEW_CARDS
                  ? `${childCount} item${childCount !== 1 ? 's' : ''} at this level`
                  : 'Full plant structure — expand equipment to choose a discipline'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {addButton}
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
                    No sub-equipment under{' '}
                    <span className="font-medium text-gray-700">{currentNode?.name}</span>.
                    {isDbTree && !activeEquipment && ' Use the add button above to create items here.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {cards.map((node) => (
                      <EquipmentCard
                        key={node.id}
                        node={node}
                        onOpen={handleNodeOpen}
                        opening={opening}
                        showManageActions={cardManageActionsEnabled(node)}
                        onEdit={openEdit}
                        onDelete={deleteNode}
                        manageSaving={manageSaving}
                      />
                    ))}
                  </div>
                )}
              </>
            )
          ) : (
            <div className="max-h-[min(70vh,720px)] overflow-y-auto pr-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
                Interactive tree structure
              </p>
              <TreeBranch
                node={tree}
                defaultOpen
                onOpenDiscipline={handleDisciplineOpen}
                opening={opening}
              />
            </div>
          )}
        </div>
      </div>
      {manageModal}
    </>
  );
}
