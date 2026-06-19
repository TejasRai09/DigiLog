import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MdAdd,
  MdCheck,
  MdChevronRight,
  MdClose,
  MdDelete,
  MdDownload,
  MdDragIndicator,
  MdEdit,
  MdExpandLess,
  MdExpandMore,
  MdRefresh,
  MdSearch,
  MdSortByAlpha,
  MdUpload,
} from 'react-icons/md';
import EquipmentSectionShell from './EquipmentSectionShell';
import {
  SPEC_SECTIONS,
  newSpecId,
  parseSpecsFromApi,
} from '../../utils/equipmentSpecModel';
import { downloadSpecTemplate, parseSpecWorkbook } from '../../utils/equipmentSpecExcel';

function isPlaceholderValue(val) {
  const v = String(val || '').trim().toLowerCase();
  return v === '' || v.includes('[empty') || v.includes('[enter') || v.includes('double click');
}

export default function EquipmentSpecificationHub({
  equipmentTag = '',
  apiSpecs = [],
  onSave,
  saving = false,
  embedded = false,
  hideBulkActions = false,
}) {
  const initial = useMemo(() => parseSpecsFromApi(apiSpecs), [apiSpecs]);
  const baselineRef = useRef({ specs: initial.specs, subSections: initial.subSections });

  const [specs, setSpecs] = useState(initial.specs);
  const [subSections, setSubSections] = useState(initial.subSections);
  const [search, setSearch] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [sectionCollapsed, setSectionCollapsed] = useState({});
  const [subGroupCollapsed, setSubGroupCollapsed] = useState({});

  const [subModal, setSubModal] = useState(null);
  const [subModalSlots, setSubModalSlots] = useState([]);
  const [subModalError, setSubModalError] = useState('');
  const [paramModal, setParamModal] = useState(null);
  const [tempParams, setTempParams] = useState([]);
  const [uploadedFileName, setUploadedFileName] = useState(null);

  const uploadRef = useRef(null);
  const draggedSlot = useRef(null);
  const draggedParam = useRef(null);

  useEffect(() => {
    const parsed = parseSpecsFromApi(apiSpecs);
    baselineRef.current = { specs: parsed.specs, subSections: parsed.subSections };
    setSpecs(parsed.specs);
    setSubSections(parsed.subSections);
    setSearch('');
    setIsEditMode(false);
    setSubGroupCollapsed({});
    setUploadedFileName(null);
  }, [apiSpecs]);

  const searchVal = search.toLowerCase().trim();

  const visibleCount = useMemo(() => {
    if (!searchVal) return specs.length;
    return specs.filter(
      (s) =>
        s.label.toLowerCase().includes(searchVal) || s.value.toLowerCase().includes(searchVal)
    ).length;
  }, [specs, searchVal]);

  const toggleSection = (id) =>
    setSectionCollapsed((p) => ({ ...p, [id]: !p[id] }));

  const toggleSubGroup = (section, sub) => {
    const key = `${section}-${sub}`;
    setSubGroupCollapsed((p) => ({ ...p, [key]: !p[key] }));
  };

  const updateSpecField = (id, field, value) => {
    setSpecs((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const deleteSpec = (id) => setSpecs((prev) => prev.filter((s) => s.id !== id));

  const openSubModal = (sectionId) => {
    const slots = [...(subSections[sectionId] || [])];
    while (slots.length < 6) slots.push('');
    setSubModalError('');
    setSubModal({ sectionId });
    setSubModalSlots(slots.slice(0, 6));
  };

  const saveSubModal = async () => {
    const newSubs = [];
    for (const val of subModalSlots) {
      const trimmed = val.trim();
      if (!trimmed) continue;
      if (newSubs.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
        setSubModalError('Duplicate subgroup names are not allowed.');
        return;
      }
      newSubs.push(trimmed);
    }
    if (newSubs.length === 0) return;

    const secName = subModal.sectionId;
    const oldSubs = subSections[secName] || [];

    let nextSpecs = [...specs];
    oldSubs.forEach((oldName, idx) => {
      const newName = newSubs[idx];
      if (newName && newName !== oldName) {
        nextSpecs = nextSpecs.map((s) =>
          s.section === secName && s.subSection === oldName ? { ...s, subSection: newName } : s
        );
      } else if (!newName) {
        nextSpecs = nextSpecs.filter((s) => !(s.section === secName && s.subSection === oldName));
      }
    });

    const nextSubSections = { ...subSections, [secName]: newSubs };

    setSpecs(nextSpecs);
    setSubSections(nextSubSections);
    setSubModalError('');
    setSubModal(null);

    try {
      await handlePersist(nextSpecs, nextSubSections);
      setIsEditMode(false);
    } catch {
      /* stay in edit mode on save failure */
    }
  };

  const openParamModal = (sectionId, subName) => {
    const rows = specs
      .filter((s) => s.section === sectionId && s.subSection === subName)
      .map((s) => ({ ...s }));
    if (rows.length === 0) {
      rows.push({
        id: `temp-${Date.now()}`,
        section: sectionId,
        subSection: subName,
        label: '',
        value: '',
      });
    }
    setParamModal({ sectionId, subName });
    setTempParams(rows);
  };

  const saveParamModal = () => {
    const { sectionId, subName } = paramModal;
    const clean = tempParams
      .map((s) => ({
        ...s,
        label: (s.label || '').trim(),
        value: (s.value || '').trim(),
      }))
      .filter((s) => (s.label || s.value) && !isPlaceholderValue(s.label) && !isPlaceholderValue(s.value))
      .map((s) => ({
        ...s,
        id: String(s.id).startsWith('temp-') ? newSpecId() : s.id,
      }));

    setSpecs((prev) => [
      ...prev.filter((s) => !(s.section === sectionId && s.subSection === subName)),
      ...clean,
    ]);
    setParamModal(null);
  };

  const sortSubSlots = () => {
    const filled = subModalSlots.map((s) => s.trim()).filter(Boolean);
    filled.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    while (filled.length < 6) filled.push('');
    setSubModalSlots(filled);
  };

  const sortTempParams = () => {
    setTempParams((prev) => {
      const sorted = [...prev].sort((a, b) => {
        const la = (a.label || '').trim().toLowerCase();
        const lb = (b.label || '').trim().toLowerCase();
        if (!la && lb) return 1;
        if (la && !lb) return -1;
        return la.localeCompare(lb, undefined, { sensitivity: 'base' });
      });
      return sorted;
    });
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buf = await file.arrayBuffer();
      const result = parseSpecWorkbook(buf);
      if (result.error) {
        window.alert(result.error);
        return;
      }
      setSpecs(result.specs);
      setSubSections(result.subSections);
      setSubGroupCollapsed({});
      setUploadedFileName(file.name);
    } catch {
      window.alert('Failed to parse Excel file.');
    }
    e.target.value = '';
  };

  const handleReset = () => {
    if (!window.confirm('Revert all specifications and sub-groups to last saved data?')) return;
    const { specs: bSpecs, subSections: bSubs } = baselineRef.current;
    setSpecs(bSpecs.map((s) => ({ ...s })));
    setSubSections(JSON.parse(JSON.stringify(bSubs)));
    setSearch('');
    setIsEditMode(false);
    setSubGroupCollapsed({});
    setUploadedFileName(null);
  };

  const handlePersist = useCallback(async (specsToSave = specs, subSectionsToSave = subSections) => {
    if (onSave) {
      await onSave(specsToSave, subSectionsToSave);
      setUploadedFileName(null);
    }
  }, [onSave, specs, subSections]);

  const finishEditMode = async () => {
    if (isEditMode) {
      try {
        await handlePersist();
        setIsEditMode(false);
      } catch {
        /* stay in edit mode on save failure */
      }
    } else {
      setIsEditMode(true);
    }
  };

  const onSlotDragStart = (index) => {
    draggedSlot.current = index;
  };

  const onSlotDrop = (targetIndex) => {
    const from = draggedSlot.current;
    if (from === null || from === targetIndex) return;
    setSubModalSlots((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    draggedSlot.current = null;
  };

  const onParamDragStart = (index) => {
    draggedParam.current = index;
  };

  const onParamDrop = (targetIndex) => {
    const from = draggedParam.current;
    if (from === null || from === targetIndex) return;
    setTempParams((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    draggedParam.current = null;
  };

  const renderSection = (sec) => {
    const secSpecs = specs.filter(
      (s) =>
        s.section === sec.id &&
        (!searchVal ||
          s.label.toLowerCase().includes(searchVal) ||
          s.value.toLowerCase().includes(searchVal))
    );
    const groups = subSections[sec.id] || [];
    const visibleGroups = groups.filter((sub) => {
      if (!searchVal) return true;
      return secSpecs.some((s) => s.subSection === sub);
    });

    if (searchVal && visibleGroups.length === 0) return null;

    const collapsed = sectionCollapsed[sec.id];

    return (
      <div key={sec.id} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
        <div className="bg-slate-50 px-4 sm:px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => toggleSection(sec.id)}
            className="flex-grow flex items-center gap-2 text-left min-w-0"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-widest">{sec.title}</span>
            <span className="text-[10px] text-slate-400 font-normal normal-case ml-1 hidden sm:inline truncate">
              {sec.hint}
            </span>
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {isEditMode && (
              <button
                type="button"
                onClick={() => openSubModal(sec.id)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100"
              >
                <MdAdd className="w-3 h-3" /> Sub-group
              </button>
            )}
            <button type="button" onClick={() => toggleSection(sec.id)} className="text-slate-400 hover:text-slate-600">
              {collapsed ? <MdChevronRight className="w-4 h-4" /> : <MdExpandMore className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="divide-y divide-slate-100">
            {visibleGroups.map((subName, idx) => {
              const subSpecs = secSpecs.filter((s) => s.subSection === subName);
              const subKey = `${sec.id}-${subName}`;
              const subCollapsed = subGroupCollapsed[subKey];

              return (
                <div key={`${sec.id}-${idx}-${subName}`} className="bg-white">
                  <div className="flex items-center justify-between bg-slate-50/70 hover:bg-slate-100/80 px-4 sm:px-6 py-2.5 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleSubGroup(sec.id, subName)}
                      className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      {subName}
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-slate-400 bg-slate-200/50 px-1.5 py-0.5 rounded-full">
                        {subSpecs.length} parameter{subSpecs.length !== 1 ? 's' : ''}
                      </span>
                      {isEditMode && (
                        <button
                          type="button"
                          onClick={() => openParamModal(sec.id, subName)}
                          className="text-indigo-600 hover:text-indigo-800 text-[10px] font-bold uppercase"
                        >
                          + Add/Edit Param
                        </button>
                      )}
                      <button type="button" onClick={() => toggleSubGroup(sec.id, subName)} className="text-slate-400">
                        {subCollapsed ? <MdChevronRight className="w-3.5 h-3.5" /> : <MdExpandMore className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {!subCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {subSpecs.length === 0 ? (
                        <p className="px-6 py-4 text-xs text-slate-400 italic text-center">
                          {isEditMode
                            ? 'No parameters added yet. Click "+ Add/Edit Param" to populate.'
                            : 'No parameters recorded.'}
                        </p>
                      ) : (
                        subSpecs.map((item) => (
                          <div
                            key={item.id}
                            className="grid grid-cols-12 gap-3 px-4 sm:px-6 py-2.5 items-center hover:bg-slate-50/50"
                          >
                            <div className="col-span-6 sm:col-span-5">
                              {isEditMode ? (
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={(e) => updateSpecField(item.id, 'label', e.target.value)}
                                  className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                />
                              ) : (
                                <span className="text-xs font-medium text-slate-800">{item.label}</span>
                              )}
                            </div>
                            <div className="col-span-6 sm:col-span-7 flex items-center gap-2">
                              {isEditMode ? (
                                <>
                                  <input
                                    type="text"
                                    value={item.value}
                                    onChange={(e) => updateSpecField(item.id, 'value', e.target.value)}
                                    className="w-full px-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:border-indigo-500"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => deleteSpec(item.id)}
                                    className="text-slate-300 hover:text-rose-500 p-1"
                                  >
                                    <MdDelete className="w-4 h-4" />
                                  </button>
                                </>
                              ) : (
                                <span className="text-xs text-slate-600 break-words">{item.value}</span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const wrapperClass = embedded ? '' : 'max-w-4xl mx-auto';

  return (
    <div className={wrapperClass}>
      <EquipmentSectionShell
        title="Equipment Specification"
        badge={visibleCount}
        open={bodyOpen}
        onToggle={() => setBodyOpen((o) => !o)}
      >
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/40">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-600 animate-pulse" />
                  <span className="text-xs font-bold text-indigo-600 tracking-wider uppercase">Asset Management Spec sheet</span>
                </div>
                {equipmentTag && (
                  <p className="text-sm font-semibold text-slate-500 mt-0.5">TAG: {equipmentTag}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-grow sm:flex-grow-0">
                  <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Quick filter specs..."
                    className="w-full sm:w-48 pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                  />
                </div>
                {!hideBulkActions && (
                  <>
                    <button
                      type="button"
                      onClick={() => downloadSpecTemplate()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200"
                    >
                      <MdDownload className="w-3.5 h-3.5" /> Template
                    </button>
                    <input ref={uploadRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUpload} />
                    {uploadedFileName ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 truncate max-w-[160px] sm:max-w-[220px]"
                          title={uploadedFileName}
                        >
                          {uploadedFileName}
                        </span>
                        <button
                          type="button"
                          onClick={() => uploadRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200 shrink-0"
                        >
                          <MdUpload className="w-3.5 h-3.5" /> Re-upload
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => uploadRef.current?.click()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg border border-indigo-200"
                      >
                        <MdUpload className="w-3.5 h-3.5" /> Upload
                      </button>
                    )}
                  </>
                )}
                <button
                  type="button"
                  onClick={finishEditMode}
                  disabled={saving}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    isEditMode
                      ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  {isEditMode ? <MdCheck className="w-3.5 h-3.5" /> : <MdEdit className="w-3.5 h-3.5" />}
                  {saving ? 'Saving…' : isEditMode ? 'Finish Edit' : 'Edit Specs'}
                </button>
                {!hideBulkActions && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg border border-rose-200"
                  >
                    <MdRefresh className="w-3.5 h-3.5" /> Reset
                  </button>
                )}
                {!hideBulkActions && !isEditMode && uploadedFileName && (
                  <button
                    type="button"
                    onClick={handlePersist}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-12 gap-4 px-2 sm:px-4 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <div className="col-span-6 sm:col-span-5">Specification</div>
              <div className="col-span-6 sm:col-span-7">Value</div>
            </div>

            <div className="space-y-4">
              {SPEC_SECTIONS.map(renderSection)}
            </div>

            {searchVal && visibleCount === 0 && (
              <p className="py-8 text-center text-xs text-slate-400">
                No matching specifications found for your current search.
              </p>
            )}
            </div>
      </EquipmentSectionShell>

      {/* Sub-group modal */}
      {subModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Manage Sub-groups</h3>
              <button type="button" onClick={() => { setSubModalError(''); setSubModal(null); }} className="text-slate-400 hover:text-slate-600">
                <MdClose className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Discipline</label>
                <input
                  readOnly
                  value={subModal.sectionId}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs font-semibold capitalize"
                />
              </div>
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Draggable Sub-group Slots</span>
                <button type="button" onClick={sortSubSlots} className="text-xs text-indigo-600 font-bold flex items-center gap-1">
                  <MdSortByAlpha className="w-3.5 h-3.5" /> Sort A-Z
                </button>
              </div>
              <div className="space-y-2">
                {subModalSlots.map((val, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => onSlotDragStart(i)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onSlotDrop(i)}
                    className="flex items-center gap-3 bg-white border border-slate-200 p-2 rounded-xl cursor-move"
                  >
                    <span className="text-[10px] font-bold text-slate-400 w-4">#{i + 1}</span>
                    <MdDragIndicator className="w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        setSubModalError('');
                        setSubModalSlots((prev) => prev.map((s, j) => (j === i ? e.target.value : s)));
                      }}
                      placeholder="Empty Slot Label"
                      className="w-full px-3 py-1.5 border border-slate-200 bg-slate-50 rounded-lg text-xs"
                    />
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400">At most 6 subgroups per discipline. Empty slots are hidden.</p>
              {subModalError && (
                <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                  {subModalError}
                </p>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-2">
              <button type="button" onClick={() => { setSubModalError(''); setSubModal(null); }} className="px-3 py-1.5 text-xs font-semibold border rounded-lg">
                Cancel
              </button>
              <button type="button" onClick={saveSubModal} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg">
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parameter modal */}
      {paramModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Manage Parameters</h3>
              <button type="button" onClick={() => setParamModal(null)} className="text-slate-400 hover:text-slate-600">
                <MdClose className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg border">
                <div>
                  <span className="block text-[9px] font-bold text-slate-400 uppercase">Target Sub-group</span>
                  <span className="text-xs font-semibold text-slate-700">
                    {paramModal.sectionId.toUpperCase()} → {paramModal.subName}
                  </span>
                </div>
                <button type="button" onClick={sortTempParams} className="text-xs text-indigo-600 font-bold flex items-center gap-1 border px-2 py-1 rounded bg-white">
                  <MdSortByAlpha className="w-3.5 h-3.5" /> Sort A-Z
                </button>
              </div>
              <div className="flex justify-between items-center border-b pb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Parameters</span>
                <button
                  type="button"
                  onClick={() =>
                    setTempParams((p) => [
                      ...p,
                      {
                        id: `temp-${Date.now()}`,
                        section: paramModal.sectionId,
                        subSection: paramModal.subName,
                        label: '',
                        value: '',
                      },
                    ])
                  }
                  className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded"
                >
                  + Add Parameter Row
                </button>
              </div>
              <div className="space-y-2">
                {tempParams.map((item, index) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => onParamDragStart(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => onParamDrop(index)}
                    className="grid grid-cols-12 gap-2 items-center border border-slate-200 p-2 rounded-xl cursor-move"
                  >
                    <div className="col-span-1 flex justify-center">
                      <MdDragIndicator className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={item.label}
                        onChange={(e) =>
                          setTempParams((p) =>
                            p.map((s) => (s.id === item.id ? { ...s, label: e.target.value } : s))
                          )
                        }
                        placeholder="Parameter Name"
                        className="w-full px-2 py-1.5 border rounded-lg text-xs bg-slate-50"
                      />
                    </div>
                    <div className="col-span-5">
                      <input
                        type="text"
                        value={item.value}
                        onChange={(e) =>
                          setTempParams((p) =>
                            p.map((s) => (s.id === item.id ? { ...s, value: e.target.value } : s))
                          )
                        }
                        placeholder="Value"
                        className="w-full px-2 py-1.5 border rounded-lg text-xs bg-slate-50"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setTempParams((p) => p.filter((s) => s.id !== item.id))}
                        className="text-slate-300 hover:text-rose-500"
                      >
                        <MdDelete className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setParamModal(null)} className="px-3 py-1.5 text-xs font-semibold border rounded-lg">
                Cancel
              </button>
              <button type="button" onClick={saveParamModal} className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-lg">
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
