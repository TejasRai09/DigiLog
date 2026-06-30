import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdAccountTree,
  MdArrowForward,
  MdBolt,
  MdChevronRight,
  MdDashboard,
  MdExpandLess,
  MdExpandMore,
  MdFolder,
  MdSettings,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import EngineeringDisciplineCards from './EngineeringDisciplineCards';
import {
  disciplineNodesForEquipment,
  ENGINEERING_DISCIPLINES,
  findDiscipline,
  isEquipmentLeaf,
} from '../../config/engineeringDisciplines';
import {
  POWER_PLANT_EQUIPMENT_TREE,
  findNodeById,
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
          <span key={`${targetPath.join('/')}-${label}`} className="inline-flex items-center gap-1">
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
                  : `${ENGINEERING_DISCIPLINES.length} disciplines · Choose section`}
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

function TreeBranch({
  node,
  depth = 0,
  defaultOpen = false,
  onOpenDiscipline,
  opening,
  activeDisciplineId = null,
}) {
  const isEquipment = isEquipmentLeaf(node);
  const hierarchyChildren = node.children ?? [];
  const disciplineChildren = isEquipment ? disciplineNodesForEquipment(node) : [];
  const hasChildren = hierarchyChildren.length > 0 || disciplineChildren.length > 0;
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

  if (!hasChildren) {
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
      {open && (
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
  appId = null,
  returnTo = '/power-plant-equipment-new',
  apiBase = '/power-new',
  detailPrefix = '/power-plant-equipment-new',
  initialPathIds = null,
  restoreEquipmentId = null,
}) {
  const navigate = useNavigate();
  const [view, setView] = useState(VIEW_CARDS);
  const [pathIds, setPathIds] = useState(
    initialPathIds?.length ? initialPathIds : [POWER_PLANT_EQUIPMENT_TREE.id],
  );
  const [activeEquipment, setActiveEquipment] = useState(null);
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    if (initialPathIds?.length) setPathIds(initialPathIds);
  }, [initialPathIds]);

  useEffect(() => {
    if (!restoreEquipmentId) return;
    const node = findNodeById(POWER_PLANT_EQUIPMENT_TREE, restoreEquipmentId);
    if (node && isEquipmentLeaf(node)) {
      setActiveEquipment(node);
      setPathIds(pathIdsForNodeId(node.id).slice(0, -1));
    }
  }, [restoreEquipmentId]);

  const currentNode = useMemo(
    () => findNodeByPath(POWER_PLANT_EQUIPMENT_TREE, pathIds),
    [pathIds],
  );

  const cards = currentNode.children ?? [];
  const childCount = cards.length;

  const buildNavState = (node, specSection = null) => ({
    appId: appId != null && appId !== '' ? String(appId) : undefined,
    returnTo,
    fromHierarchy: true,
    hierarchyPathIds: pathIdsForNodeId(node.id),
    restoreEquipmentId: node.id,
    ...(specSection ? { specSection } : {}),
  });

  const equipmentDetailPath = (equipId, specSection = null) => {
    if (specSection && findDiscipline(specSection)) {
      return `${detailPrefix}/${equipId}/${specSection}`;
    }
    return `${detailPrefix}/${equipId}`;
  };

  const openDraftEquipment = (node, specSection = null) => {
    const lookupName = node.lookupName || node.name;
    const nodePathIds = pathIdsForNodeId(node.id);
    const labels = pathLabels(POWER_PLANT_EQUIPMENT_TREE, nodePathIds);
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
    if (node.children?.length) {
      setActiveEquipment(null);
      setPathIds(pathIdsForNodeId(node.id));
      return;
    }
    setActiveEquipment(node);
  };

  const handleDisciplineOpen = (disciplineNode) => {
    const equipment = disciplineNode.equipmentNode;
    if (!equipment) return;
    openEquipment(equipment, disciplineNode.disciplineId);
  };

  const handleBreadcrumbNavigate = (targetPath) => {
    setActiveEquipment(null);
    setPathIds(targetPath);
  };

  const disciplinePathIds = activeEquipment ? pathIdsForNodeId(activeEquipment.id) : pathIds;

  return (
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
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="p-5">
        {view === VIEW_CARDS ? (
          activeEquipment ? (
            <>
              <HierarchyBreadcrumb
                pathIds={disciplinePathIds}
                onNavigate={handleBreadcrumbNavigate}
              />
              <EngineeringDisciplineCards
                equipmentNode={activeEquipment}
                onSelectDiscipline={(discipline) => openEquipment(activeEquipment, discipline.id)}
                onBack={() => setActiveEquipment(null)}
                opening={opening?.includes('--') ? opening.split('--')[1] : null}
              />
            </>
          ) : (
            <>
              <HierarchyBreadcrumb pathIds={pathIds} onNavigate={handleBreadcrumbNavigate} />
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
          )
        ) : (
          <div className="max-h-[min(70vh,720px)] overflow-y-auto pr-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 px-1">
              Interactive tree structure
            </p>
            <TreeBranch
              node={POWER_PLANT_EQUIPMENT_TREE}
              defaultOpen
              onOpenDiscipline={handleDisciplineOpen}
              opening={opening}
            />
          </div>
        )}
      </div>
    </div>
  );
}
