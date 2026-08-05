import { useMemo, useRef, useState } from 'react';
import { MdAdd, MdClose, MdDragIndicator, MdSortByAlpha } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import {
  findNodeByPath,
  isHierarchyEquipment,
  isHierarchyGroup,
  isProtectedRootCategoryName,
  isHierarchyNodeLocked,
  findGlobalSubEquipmentNameInTree,
  composeSugarLeafDisplayName,
  splitSugarLeafLabel,
} from '../../utils/hierarchyTreeUtils';

const MAX_SLOTS = 200;
const INITIAL_VISIBLE_SLOTS = 6;

function kindLabel(kind) {
  if (kind === 'category') return 'category';
  if (kind === 'subcategory') return 'subcategory';
  return 'equipment';
}

function duplicateMessage(kind, name) {
  if (kind === 'equipment') {
    return `Sub equipment name "${name}" already exists in another section.`;
  }
  return `Duplicate ${kindLabel(kind)} name: "${name}".`;
}

function nodeDbId(node) {
  if (!node) return null;
  if (node.dbId != null) return Number(node.dbId);
  const id = Number(node.id);
  return Number.isNaN(id) ? null : id;
}

function isSugarSubEquipmentSlots(modalOrAction) {
  return Boolean(modalOrAction?.sugarLeafFields);
}

function childToSlot(child, { kind, tree, apiBase, sugarLeafFields, sortOrder = 0 }) {
  const locked =
    (kind === 'category' && isProtectedRootCategoryName(child.name))
    || isHierarchyNodeLocked(tree, child, apiBase);

  if (sugarLeafFields && kind === 'equipment') {
    const parts = splitSugarLeafLabel(child);
    return {
      dbId: nodeDbId(child),
      name: parts.equipmentName,
      location: parts.location,
      equipNo: child.equipNo || '',
      locked,
      originalName: parts.equipmentName,
      originalLocation: parts.location,
      originalEquipNo: child.equipNo || '',
      originalSortOrder: sortOrder,
    };
  }

  return {
    dbId: nodeDbId(child),
    name: child.name || '',
    location: '',
    equipNo: '',
    locked,
    originalName: child.name || '',
    originalLocation: '',
    originalEquipNo: '',
    originalSortOrder: sortOrder,
  };
}

function emptySlot() {
  return { name: '', location: '', equipNo: '' };
}

function existingChildrenForKind(currentNode, kind) {
  const children = currentNode?.children ?? [];
  if (kind === 'equipment') {
    return children.filter(isHierarchyEquipment);
  }
  return children.filter(isHierarchyGroup);
}

/** Root → category → subcategory → equipment (by navigation depth). */
export function hierarchyAddAction(tree, pathIds, activeEquipmentId) {
  if (activeEquipmentId || !tree || !pathIds?.length) return null;

  const depth = pathIds.length;
  const currentNode = findNodeByPath(tree, pathIds);
  const parentLabel = currentNode?.name || tree.name || 'Power Plant';

  if (depth === 1) {
    return {
      kind: 'category',
      nodeType: 'group',
      buttonLabel: 'Add Category',
      modalTitle: 'Manage Categories',
      slotLabel: 'Category name',
      parentLabel,
      parentDbId: nodeDbId(currentNode),
    };
  }
  if (depth === 2) {
    return {
      kind: 'subcategory',
      nodeType: 'group',
      buttonLabel: 'Add Subcategory',
      modalTitle: 'Manage Subcategories',
      slotLabel: 'Subcategory name',
      parentLabel,
      parentDbId: nodeDbId(currentNode),
    };
  }
  if (depth === 3) {
    return {
      kind: 'equipment',
      nodeType: 'equipment',
      buttonLabel: 'Add Equipment',
      modalTitle: 'Manage Equipment',
      slotLabel: 'Equipment name',
      parentLabel,
      parentDbId: nodeDbId(currentNode),
    };
  }
  return null;
}

/** Root → section → location → main equipment → sub equipment (by navigation depth). */
export function sugarHouseHierarchyAddAction(tree, pathIds, activeEquipmentId) {
  if (activeEquipmentId || !tree || !pathIds?.length) return null;

  const depth = pathIds.length;
  const currentNode = findNodeByPath(tree, pathIds);
  const parentLabel = currentNode?.name || tree.name || 'Sugar Plant';

  if (depth === 1) {
    return {
      kind: 'section',
      nodeType: 'group',
      buttonLabel: 'Add Section',
      modalTitle: 'Manage Sections',
      slotLabel: 'Section name',
      parentLabel,
      parentDbId: nodeDbId(currentNode),
    };
  }
  if (depth === 2) {
    return {
      kind: 'location',
      nodeType: 'group',
      buttonLabel: 'Add Location',
      modalTitle: 'Manage Locations',
      slotLabel: 'Location name',
      parentLabel,
      parentDbId: nodeDbId(currentNode),
    };
  }
  if (depth === 3) {
    return {
      kind: 'main_equipment',
      nodeType: 'group',
      buttonLabel: 'Add Main Equipment',
      modalTitle: 'Manage Main Equipment',
      slotLabel: 'Main equipment name',
      parentLabel,
      parentDbId: nodeDbId(currentNode),
    };
  }
  if (depth === 4) {
    return {
      kind: 'equipment',
      nodeType: 'equipment',
      buttonLabel: 'Add Sub Equipment',
      modalTitle: 'Manage Sub Equipment',
      slotLabel: 'Sub equipment name',
      sugarLeafFields: true,
      parentLabel,
      parentDbId: nodeDbId(currentNode),
    };
  }
  return null;
}

export function useHierarchyManage({
  tree,
  pathIds,
  activeEquipment,
  onReload,
  isDbTree = false,
  apiBase = '/power-new',
  getAddAction = hierarchyAddAction,
}) {
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', location: '', equipNo: '' });
  const [slots, setSlots] = useState([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_SLOTS);
  const [modalError, setModalError] = useState('');
  const draggedSlot = useRef(null);

  const addAction = useMemo(
    () => getAddAction(tree, pathIds, activeEquipment),
    [getAddAction, tree, pathIds, activeEquipment],
  );

  const openAddModal = () => {
    if (!addAction || !tree) return;
    const currentNode = findNodeByPath(tree, pathIds);
    const sugarLeafFields = Boolean(addAction.sugarLeafFields);
    const existing = existingChildrenForKind(currentNode, addAction.kind).map((child, index) =>
      childToSlot(child, {
        kind: addAction.kind,
        tree,
        apiBase,
        sugarLeafFields,
        sortOrder: index,
      }),
    );
    const existingIds = existing.map((s) => s.dbId).filter(Boolean);
    const initialVisible = Math.min(
      MAX_SLOTS,
      Math.max(INITIAL_VISIBLE_SLOTS, existing.length),
    );
    const nextSlots = [...existing];
    while (nextSlots.length < initialVisible) {
      nextSlots.push(emptySlot());
    }

    setModalError('');
    setModal({
      mode: 'manage',
      existingIds,
      ...addAction,
    });
    setVisibleCount(initialVisible);
    setSlots(nextSlots.slice(0, MAX_SLOTS));
  };

  const openEdit = (node) => {
    if (isHierarchyNodeLocked(tree, node, apiBase)) return;
    setModalError('');
    if (apiBase === '/sugar-new' && node.nodeType === 'equipment') {
      const parts = splitSugarLeafLabel(node);
      setEditForm({
        name: parts.equipmentName,
        location: parts.location,
        equipNo: node.equipNo || '',
      });
      setModal({ mode: 'edit', node, sugarLeafFields: true });
      return;
    }
    setEditForm({ name: node.name || '', location: '', equipNo: '' });
    setModal({ mode: 'edit', node });
  };

  const closeModal = () => {
    setModal(null);
    setModalError('');
  };

  const addSlot = () => {
    setVisibleCount((count) => {
      if (count >= MAX_SLOTS) return count;
      const next = count + 1;
      setSlots((prev) => {
        if (prev.length >= next) return prev;
        return [...prev, emptySlot()];
      });
      return next;
    });
  };

  const sortSlots = () => {
    setSlots((prev) => {
      const slice = prev.slice(0, visibleCount);
      const filled = slice.filter((s) => s.name.trim());
      const empty = slice.filter((s) => !s.name.trim());
      filled.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      const next = [...filled, ...empty];
      while (next.length < visibleCount) {
        next.push(emptySlot());
      }
      return [...next, ...prev.slice(visibleCount)];
    });
  };

  const onSlotDragStart = (index) => {
    draggedSlot.current = index;
  };

  const onSlotDrop = (index) => {
    const from = draggedSlot.current;
    draggedSlot.current = null;
    if (from == null || from === index) return;
    setSlots((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(index, 0, moved);
      return next;
    });
  };

  const saveManageModal = async () => {
    if (!modal?.parentDbId) {
      setModalError('Could not resolve parent folder.');
      return;
    }

    const sugarLeafFields = isSugarSubEquipmentSlots(modal);
    const filledSlots = [];

    for (const slot of slots.slice(0, visibleCount)) {
      const equipmentName = slot.name.trim();
      const location = (slot.location || '').trim();
      const equipNo = (slot.equipNo || '').trim();
      const anyFilled = Boolean(equipmentName || location || equipNo);

      if (!anyFilled) continue;

      if (sugarLeafFields) {
        if (!equipmentName) {
          setModalError('Sub equipment name is required for each filled row.');
          toast.error('Enter Sub equipment name for every filled row.');
          return;
        }
        if (!equipNo) {
          setModalError('Equipment no. (tag) is required for each sub equipment.');
          toast.error('Enter Equipment no. (tag) for every filled row.');
          return;
        }
        if (!location) {
          setModalError('Location is required for each sub equipment.');
          toast.error('Enter Location for every filled row.');
          return;
        }
      } else if (!equipmentName) {
        continue;
      }

      const displayName = sugarLeafFields
        ? composeSugarLeafDisplayName(equipmentName, location)
        : equipmentName;

      if (slot.locked) {
        if (slot.dbId) {
          filledSlots.push({
            dbId: slot.dbId,
            name: displayName,
            equipmentName,
            location,
            equipNo,
            lookupName: equipmentName,
            histLocation: location,
            locked: true,
            originalName: slot.originalName,
            originalLocation: slot.originalLocation,
            originalEquipNo: slot.originalEquipNo,
            originalSortOrder: slot.originalSortOrder,
          });
        }
        continue;
      }
      if (filledSlots.some((e) => e.equipmentName.toLowerCase() === equipmentName.toLowerCase())) {
        const message = duplicateMessage(modal.kind, equipmentName);
        setModalError(message);
        toast.error(message);
        return;
      }
      if (
        sugarLeafFields
        && filledSlots.some((e) => (e.equipNo || '').toLowerCase() === equipNo.toLowerCase())
      ) {
        const message = `Duplicate equipment no. (tag): "${equipNo}".`;
        setModalError(message);
        toast.error(message);
        return;
      }
      if (apiBase === '/sugar-new' && modal.nodeType === 'equipment') {
        const globalDup = findGlobalSubEquipmentNameInTree(tree, equipmentName, slot.dbId ?? null);
        if (globalDup) {
          const message = duplicateMessage('equipment', equipmentName);
          setModalError(message);
          toast.error(message);
          return;
        }
      }
      filledSlots.push({
        dbId: slot.dbId ?? null,
        name: displayName,
        equipmentName,
        location,
        equipNo: sugarLeafFields ? equipNo : undefined,
        lookupName: sugarLeafFields ? equipmentName : undefined,
        histLocation: sugarLeafFields ? location : undefined,
        originalName: slot.originalName,
        originalLocation: slot.originalLocation,
        originalEquipNo: slot.originalEquipNo,
        originalSortOrder: slot.originalSortOrder,
      });
    }

    if (!filledSlots.length && !(modal.existingIds?.length)) {
      setModalError(sugarLeafFields
        ? 'Enter at least one sub equipment name, equipment no. (tag), and location.'
        : 'Enter at least one name.');
      return;
    }

    setSaving(true);
    try {
      const keptIds = new Set();

      for (let i = 0; i < filledSlots.length; i += 1) {
        const entry = filledSlots[i];
        if (entry.dbId) {
          keptIds.add(entry.dbId);
          if (!entry.locked) {
            if (apiBase === '/sugar-new' && modal.nodeType === 'equipment') {
              const globalDup = findGlobalSubEquipmentNameInTree(
                tree,
                entry.equipmentName,
                entry.dbId,
              );
              if (globalDup) {
                const message = duplicateMessage('equipment', entry.equipmentName);
                setModalError(message);
                toast.error(message);
                setSaving(false);
                return;
              }
            }

            const nameChanged = sugarLeafFields
              ? false
              : entry.name !== (entry.originalName ?? '');
            const orderChanged = entry.originalSortOrder == null
              || Number(entry.originalSortOrder) !== i;
            const sugarChanged = sugarLeafFields && (
              entry.equipmentName !== (entry.originalName ?? '')
              || (entry.histLocation || '') !== (entry.originalLocation || '')
              || (entry.equipNo || '') !== (entry.originalEquipNo || '')
            );

            // Skip no-op PUTs so Audit Log only records real changes
            if (!nameChanged && !orderChanged && !sugarChanged) {
              continue;
            }

            const payload = {
              name: entry.name,
              sort_order: i,
            };
            if (sugarLeafFields) {
              payload.lookup_name = entry.lookupName;
              payload.hist_location = entry.histLocation;
              payload.equip_no = entry.equipNo;
            }
            await api.put(`${apiBase}/hierarchy/${entry.dbId}`, payload);
          }
        } else {
          const payload = {
            parent_id: modal.parentDbId,
            node_type: modal.nodeType,
            name: entry.name,
            sort_order: i,
          };
          if (sugarLeafFields) {
            payload.lookup_name = entry.lookupName;
            payload.hist_location = entry.histLocation;
            payload.equip_no = entry.equipNo;
          }
          await api.post(`${apiBase}/hierarchy`, payload);
        }
      }

      for (const oldId of modal.existingIds || []) {
        if (!keptIds.has(oldId)) {
          const slot = slots.find((s) => s.dbId === oldId);
          if (slot?.locked) {
            keptIds.add(oldId);
            continue;
          }
          await api.delete(`${apiBase}/hierarchy/${oldId}`);
        }
      }

      toast.success('Changes saved.');
      closeModal();
      await onReload?.({ silent: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Save failed.';
      setModalError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    const equipmentName = editForm.name.trim();
    const location = (editForm.location || '').trim();
    const equipNo = (editForm.equipNo || '').trim();
    const sugarLeafFields = Boolean(modal?.sugarLeafFields);

    if (!equipmentName) {
      if (sugarLeafFields) {
        setModalError('Sub equipment name is required.');
        toast.error('Sub equipment name is required.');
      }
      return;
    }
    if (sugarLeafFields && !location) {
      setModalError('Location is required.');
      toast.error('Location is required.');
      return;
    }
    if (sugarLeafFields && !equipNo) {
      setModalError('Equipment no. (tag) is required.');
      toast.error('Equipment no. (tag) is required.');
      return;
    }

    const name = sugarLeafFields
      ? composeSugarLeafDisplayName(equipmentName, location)
      : equipmentName;

    if (apiBase === '/sugar-new' && modal.node?.nodeType === 'equipment') {
      const globalDup = findGlobalSubEquipmentNameInTree(
        tree,
        equipmentName,
        modal.node?.dbId ?? modal.node?.id,
      );
      if (globalDup) {
        const message = duplicateMessage('equipment', equipmentName);
        setModalError(message);
        toast.error(message);
        return;
      }
    }
    setSaving(true);
    try {
      const nodeId = modal.node?.dbId ?? Number(modal.node.id);
      const payload = { name };
      if (sugarLeafFields) {
        payload.lookup_name = equipmentName;
        payload.hist_location = location;
        payload.equip_no = equipNo;
      }
      await api.put(`${apiBase}/hierarchy/${nodeId}`, payload);

      // Keep linked equipment record name in sync so breadcrumbs/detail match the leaf
      const linkedEquipId = modal.node?.ppnEquipId || modal.node?.shnEquipId;
      if (modal.node?.nodeType === 'equipment' && linkedEquipId) {
        try {
          const equipPayload = { name: sugarLeafFields ? equipmentName : name };
          if (sugarLeafFields && equipNo) {
            equipPayload.equip_no = equipNo;
            equipPayload.tag_name = equipNo;
          }
          if (sugarLeafFields && location) {
            equipPayload.location = location;
          }
          await api.put(`${apiBase}/${linkedEquipId}`, equipPayload);
        } catch {
          // Non-fatal — hierarchy rename already saved
        }
      }

      toast.success('Updated.');
      closeModal();
      await onReload?.({ silent: true });
    } catch (err) {
      const message = err.response?.data?.message || 'Save failed.';
      setModalError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const deleteNode = async (node) => {
    if (isHierarchyNodeLocked(tree, node, apiBase)) return;
    if (!window.confirm(`Delete "${node.name}"?`)) return;
    const nodeId = node.dbId ?? Number(node.id);
    setSaving(true);
    try {
      await api.delete(`${apiBase}/hierarchy/${nodeId}`);
      toast.success('Deleted.');
      await onReload?.({ silent: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  const addButton = isDbTree && addAction ? (
    <button
      type="button"
      onClick={openAddModal}
      disabled={saving}
      className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg border border-violet-200 disabled:opacity-50"
    >
      <MdAdd className="w-3.5 h-3.5" />
      {addAction.buttonLabel}
    </button>
  ) : null;

  const manageModal = modal?.mode === 'manage' ? (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {modal.modalTitle}
          </h3>
          <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
            <MdClose className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {modal.kind === 'category' ? 'Parent' : modal.kind === 'subcategory' ? 'Category' : 'Subcategory'}
            </label>
            <input
              readOnly
              value={modal.parentLabel}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs font-semibold"
            />
          </div>
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              {isSugarSubEquipmentSlots(modal)
                ? 'Sub equipment slots'
                : modal.kind === 'equipment'
                  ? 'Equipment slots'
                  : `${modal.slotLabel}s`}
            </span>
            <button
              type="button"
              onClick={sortSlots}
              className="text-xs text-indigo-600 font-bold flex items-center gap-1"
            >
              <MdSortByAlpha className="w-3.5 h-3.5" /> Sort A-Z
            </button>
          </div>
          <div className="space-y-2">
            {Array.from({ length: visibleCount }, (_, i) => {
              const sugarLeafFields = isSugarSubEquipmentSlots(modal);
              const slot = slots[i] ?? emptySlot(sugarLeafFields);
              return (
                <div
                  key={slot.dbId ? `db-${slot.dbId}` : `new-${i}`}
                  draggable={!slot.locked}
                  onDragStart={() => !slot.locked && onSlotDragStart(i)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onSlotDrop(i)}
                  className={`flex items-start gap-3 bg-white border border-slate-200 p-2 rounded-xl ${
                    slot.locked ? 'opacity-80' : 'cursor-move'
                  }`}
                >
                  <span className="text-[10px] font-bold text-slate-400 w-4 pt-2">#{i + 1}</span>
                  {!slot.locked && (
                    <MdDragIndicator className="w-4 h-4 text-slate-400 shrink-0 mt-2" />
                  )}
                  {slot.locked && <span className="w-4 shrink-0" />}
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <input
                      type="text"
                      value={slot.name}
                      readOnly={slot.locked}
                      onChange={(e) => {
                        if (slot.locked) return;
                        setModalError('');
                        setSlots((prev) => {
                          const next = [...prev];
                          while (next.length <= i) {
                            next.push(emptySlot());
                          }
                          next[i] = { ...next[i], name: e.target.value };
                          return next;
                        });
                      }}
                      placeholder={sugarLeafFields ? 'Sub equipment name' : modal.slotLabel}
                      className={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs ${
                        slot.locked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50'
                      }`}
                      title={slot.locked ? 'Built-in hierarchy — cannot rename or remove' : undefined}
                    />
                    {sugarLeafFields && (
                      <>
                        <input
                          type="text"
                          value={slot.equipNo || ''}
                          readOnly={slot.locked}
                          onChange={(e) => {
                            if (slot.locked) return;
                            setModalError('');
                            setSlots((prev) => {
                              const next = [...prev];
                              while (next.length <= i) {
                                next.push(emptySlot());
                              }
                              next[i] = { ...next[i], equipNo: e.target.value };
                              return next;
                            });
                          }}
                          placeholder="Equipment no. (tag)"
                          className={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs ${
                            slot.locked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50'
                          }`}
                        />
                        <input
                          type="text"
                          value={slot.location || ''}
                          readOnly={slot.locked}
                          onChange={(e) => {
                            if (slot.locked) return;
                            setModalError('');
                            setSlots((prev) => {
                              const next = [...prev];
                              while (next.length <= i) {
                                next.push(emptySlot());
                              }
                              next[i] = { ...next[i], location: e.target.value };
                              return next;
                            });
                          }}
                          placeholder="Location (Inst. History card location)"
                          className={`w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs ${
                            slot.locked ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-slate-50'
                          }`}
                        />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
            {visibleCount < MAX_SLOTS && (
              <button
                type="button"
                onClick={addSlot}
                className="flex items-center justify-center gap-2 w-full bg-white border border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 p-2 rounded-xl text-xs font-bold text-indigo-600 transition-colors"
              >
                <MdAdd className="w-4 h-4" />
                Add {isSugarSubEquipmentSlots(modal) ? 'sub equipment' : modal.kind === 'equipment' ? 'equipment' : modal.kind} slot
              </button>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            {isSugarSubEquipmentSlots(modal)
              ? `Saved with Equipment no. (tag). Display: “Sub equipment name · Location”. Up to ${MAX_SLOTS} sub equipment at this level.`
              : `Up to ${MAX_SLOTS} ${modal.kind === 'equipment' ? 'equipment' : `${modal.kind} entries`} at this level.`}
            {' '}Showing {visibleCount} slot{visibleCount !== 1 ? 's' : ''}. Clear a slot and save to remove an item.
          </p>
          {modalError && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {modalError}
            </p>
          )}
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-2">
          <button
            type="button"
            onClick={closeModal}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold border rounded-lg disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveManageModal}
            disabled={saving}
            className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  const editModal = modal?.mode === 'edit' ? (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Edit</h3>
          <button type="button" onClick={closeModal} className="text-slate-400 hover:text-slate-600">
            <MdClose className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={saveEdit} className="p-6 space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              {modal.sugarLeafFields ? 'Sub equipment name' : 'Name'}
            </label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => {
                setModalError('');
                setEditForm((f) => ({ ...f, name: e.target.value }));
              }}
              required
              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-xs"
            />
          </div>
          {modal.sugarLeafFields && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Equipment no. (tag)
                </label>
                <input
                  type="text"
                  value={editForm.equipNo}
                  onChange={(e) => {
                    setModalError('');
                    setEditForm((f) => ({ ...f, equipNo: e.target.value }));
                  }}
                  required
                  placeholder="Inst. History card tag / equipment no."
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => {
                    setModalError('');
                    setEditForm((f) => ({ ...f, location: e.target.value }));
                  }}
                  required
                  placeholder="Inst. History card location"
                  className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-xs"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Tag is stored as equipment no. Display: “Sub equipment name · Location”.
                </p>
              </div>
            </>
          )}
          {modalError && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
              {modalError}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={closeModal} className="px-3 py-1.5 text-xs font-semibold border rounded-lg">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return {
    saving,
    addButton,
    manageModal: manageModal || editModal,
    openEdit,
    deleteNode,
    isDbTree,
  };
}
