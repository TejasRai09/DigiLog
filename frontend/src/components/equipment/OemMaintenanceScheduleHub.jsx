import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  MdAdd,
  MdCheck,
  MdClose,
  MdDelete,
  MdEdit,
  MdInfo,
  MdRefresh,
  MdSearch,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import {
  SCHEDULE_INTERVALS,
  newScheduleId,
  parseScheduleFromApi,
} from '../../utils/equipmentScheduleModel';
import EquipmentSectionShell from './EquipmentSectionShell';
import EquipmentMultiSelectDropdown from './EquipmentMultiSelectDropdown';

const ACTION_STEP_INPUT =
  'flex-1 w-full min-w-0 px-2 py-1 text-xs border border-slate-200 rounded resize-none leading-5 overflow-y-hidden';

const ACTION_STEP_INPUT_MOBILE =
  'flex-1 w-full min-w-0 px-2 py-1.5 text-sm border border-slate-200 rounded-lg resize-none leading-5 overflow-y-hidden';

const ACTION_STEP_VIEW = 'break-words break-all whitespace-pre-wrap min-w-0';

function ActionStepInput({ value, onChange, className, placeholder }) {
  const ref = useRef(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const styles = getComputedStyle(el);
    const lineHeight = parseFloat(styles.lineHeight) || 20;
    const padding =
      parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const minHeight = lineHeight + padding;
    const maxHeight = lineHeight * 3 + padding;
    const nextHeight = Math.min(Math.max(el.scrollHeight, minHeight), maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      onInput={resize}
      className={className}
      placeholder={placeholder}
    />
  );
}

export default function OemMaintenanceScheduleHub({
  apiSchedule = [],
  onSave,
  saving = false,
  embedded = false,
  hideBulkActions = false,
  equipmentOptions = [],
  disciplineSection = null,
}) {
  const scopedEquipmentOptions = useMemo(() => {
    if (!disciplineSection) return equipmentOptions;
    return equipmentOptions.filter((opt) => opt.section === disciplineSection);
  }, [equipmentOptions, disciplineSection]);

  const showEquipmentPicker = scopedEquipmentOptions.length > 0;
  const equipmentLabelMap = useMemo(() => {
    const map = new Map();
    scopedEquipmentOptions.forEach((opt) => map.set(opt.key, opt.label));
    return map;
  }, [scopedEquipmentOptions]);

  const labelForEquipmentKeys = (keys = []) => {
    if (!keys.length) return '—';
    return keys
      .map((key) => equipmentLabelMap.get(key))
      .filter(Boolean)
      .join(', ') || '—';
  };

  const initial = useMemo(() => parseScheduleFromApi(apiSchedule), [apiSchedule]);
  const baselineRef = useRef(initial);

  const [schedule, setSchedule] = useState(initial);
  const [draft, setDraft] = useState([]);
  const [isEditing, setIsEditing] = useState(false);
  const [bodyOpen, setBodyOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [intervalFilter, setIntervalFilter] = useState('ALL');

  useEffect(() => {
    const parsed = parseScheduleFromApi(apiSchedule);
    baselineRef.current = parsed;
    setSchedule(parsed);
    setIsEditing(false);
    setSearch('');
    setIntervalFilter('ALL');
  }, [apiSchedule]);

  const searchVal = search.toLowerCase().trim();

  const filtered = useMemo(() => {
    return schedule.filter((row) => {
      const equipmentLabel = labelForEquipmentKeys(row.equipmentKeys).toLowerCase();
      const matchesSearch =
        !searchVal ||
        row.component.toLowerCase().includes(searchVal) ||
        row.actions.some((a) => a.toLowerCase().includes(searchVal)) ||
        (showEquipmentPicker && equipmentLabel !== '—' && equipmentLabel.includes(searchVal));
      const matchesInterval =
        intervalFilter === 'ALL' || row.intervals.includes(intervalFilter);
      return matchesSearch && matchesInterval;
    });
  }, [schedule, searchVal, intervalFilter, showEquipmentPicker, equipmentLabelMap]);

  const startEdit = () => {
    setDraft(
      JSON.parse(JSON.stringify(schedule)).map((row) => ({
        ...row,
        equipmentKeys: row.equipmentKeys?.length
          ? [...row.equipmentKeys]
          : (row.equipmentKey ? [row.equipmentKey] : []),
      })),
    );
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft([]);
  };

  const saveEdit = async () => {
    const invalid = draft.some(
      (r) =>
        (showEquipmentPicker && (!r.equipmentKeys || r.equipmentKeys.length === 0))
        || !r.component.trim()
        || !r.actions.length
        || r.actions.some((a) => !a.trim())
    );
    if (invalid) {
      toast.error(
        showEquipmentPicker
          ? 'Select equipment and fill all component names and action steps.'
          : 'Fill all component names and action steps.',
      );
      return;
    }
    try {
      if (onSave) await onSave(draft);
      setSchedule(draft);
      setIsEditing(false);
      setDraft([]);
    } catch {
      /* parent shows error */
    }
  };

  const handleReset = () => {
    if (!window.confirm('Revert schedule to last saved data?')) return;
    setSchedule(baselineRef.current.map((r) => ({
      ...r,
      equipmentKeys: [...(r.equipmentKeys || [])],
      actions: [...r.actions],
      intervals: [...r.intervals],
    })));
    setIsEditing(false);
    setDraft([]);
    setSearch('');
    setIntervalFilter('ALL');
  };

  const canAddRow = !showEquipmentPicker || draft.every((r) => r.equipmentKeys?.length > 0);

  const addRow = () => {
    if (!canAddRow) return;
    const nextNo = draft.length ? Math.max(...draft.map((r) => r.no)) + 1 : 1;
    setDraft((prev) => [
      ...prev,
      { id: newScheduleId(), no: nextNo, equipmentKeys: [], component: '', actions: [''], intervals: [] },
    ]);
  };

  const deleteRow = (id) => setDraft((prev) => prev.filter((r) => r.id !== id));

  const updateEquipmentKeys = (id, keys) =>
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, equipmentKeys: keys } : r)));

  const updateComponent = (id, value) =>
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, component: value } : r)));

  const updateAction = (id, idx, value) =>
    setDraft((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const actions = [...r.actions];
        actions[idx] = value;
        return { ...r, actions };
      })
    );

  const addAction = (id) =>
    setDraft((prev) =>
      prev.map((r) => (r.id === id ? { ...r, actions: [...r.actions, ''] } : r))
    );

  const deleteAction = (id, idx) =>
    setDraft((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const actions = r.actions.filter((_, i) => i !== idx);
        return { ...r, actions: actions.length ? actions : [''] };
      })
    );

  const toggleInterval = (id, key) =>
    setDraft((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const has = r.intervals.includes(key);
        return {
          ...r,
          intervals: has ? r.intervals.filter((k) => k !== key) : [...r.intervals, key],
        };
      })
    );

  const renderIntervalBadges = (intervals) => (
    <div className="flex flex-wrap gap-1.5">
      {!intervals.length ? (
        <span className="text-xs text-slate-400 italic">None selected</span>
      ) : (
        intervals.map((key) => {
          const cfg = SCHEDULE_INTERVALS.find((c) => c.key === key);
          return (
            <span
              key={key}
              title={cfg?.fullLabel}
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-wider ${cfg?.color || 'bg-slate-100 text-slate-700'}`}
            >
              {cfg?.label || key}
            </span>
          );
        })
      )}
    </div>
  );

  const wrapperClass = embedded ? '' : 'max-w-[min(100%,112rem)] mx-auto';

  return (
    <div className={wrapperClass}>
      <EquipmentSectionShell
        title="OEM Maintenance Schedule"
        badge={schedule.length}
        open={bodyOpen}
        onToggle={() => setBodyOpen((o) => !o)}
      >
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/40">
              {!isEditing && (
                <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
                  <div className="relative flex-1 min-w-[180px]">
                    <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search component or action..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={intervalFilter}
                    onChange={(e) => setIntervalFilter(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700"
                  >
                    <option value="ALL">All Frequencies</option>
                    {SCHEDULE_INTERVALS.map((c) => (
                      <option key={c.key} value={c.key}>{c.fullLabel} ({c.label})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
                {!isEditing ? (
                  <button type="button" onClick={startEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 rounded-lg">
                    <MdEdit className="w-3.5 h-3.5" /> Edit Schedule
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={cancelEdit} className="px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg text-slate-600">Cancel</button>
                    <button type="button" onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg disabled:opacity-60">
                      <MdCheck className="w-3.5 h-3.5" /> {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                  </>
                )}
                {!hideBulkActions && (
                  <button type="button" onClick={handleReset} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 rounded-lg">
                    <MdRefresh className="w-3.5 h-3.5" /> Reset
                  </button>
                )}
              </div>
            </div>

            {isEditing && (
              <div className="px-4 sm:px-6 py-3 bg-amber-50/60 border-b border-amber-100">
                <div className="flex items-start gap-2 text-xs text-amber-800">
                  <MdInfo className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Click <strong>Save Changes</strong> when you have finished editing.</span>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              {!isEditing ? (
                filtered.length === 0 ? (
                  <p className="p-10 text-center text-sm text-slate-400">
                    {schedule.length === 0 ? 'No OEM schedule recorded.' : 'No rows match your filter.'}
                  </p>
                ) : (
                  <>
                    <div className="hidden md:block">
                      <table className="w-full text-left border-collapse table-fixed min-w-[720px]">
                        <thead>
                          <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/30">
                            <th className="py-3 px-4 w-12 text-center">#</th>
                            {showEquipmentPicker && <th className="py-3 px-4 w-40">Equipment</th>}
                            <th className="py-3 px-4 w-1/4">Component</th>
                            <th className="py-3 px-4 w-1/2">Maintenance Action</th>
                            <th className="py-3 px-4 w-1/4">Active Intervals</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filtered.map((row, index) => (
                            <tr key={row.id} className="hover:bg-slate-50/40 align-top">
                              <td className="py-3 px-4 text-center text-xs text-slate-400">{index + 1}</td>
                              {showEquipmentPicker && (
                                <td className="py-3 px-4 text-slate-800 text-sm max-w-0 break-words font-semibold" title={labelForEquipmentKeys(row.equipmentKeys)}>
                                  {labelForEquipmentKeys(row.equipmentKeys)}
                                </td>
                              )}
                              <td className="py-3 px-4 font-semibold text-slate-900 text-sm max-w-0 break-words">{row.component}</td>
                              <td className="py-3 px-4 text-slate-600 text-sm max-w-0 align-top">
                                <ul className="list-disc pl-4 space-y-1 min-w-0">
                                  {row.actions.map((step, i) => (
                                    <li key={i} className={ACTION_STEP_VIEW}>{step}</li>
                                  ))}
                                </ul>
                              </td>
                              <td className="py-3 px-4 max-w-0 align-top">{renderIntervalBadges(row.intervals)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden p-3 space-y-3">
                      {filtered.map((row, index) => (
                        <div key={row.id} className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm space-y-2.5">
                          <div className="space-y-2">
                            <div className="flex items-start gap-2 min-w-0">
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full shrink-0">#{index + 1}</span>
                              <div className="min-w-0 flex-1 space-y-1">
                                {showEquipmentPicker && (
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 truncate" title={labelForEquipmentKeys(row.equipmentKeys)}>
                                    {labelForEquipmentKeys(row.equipmentKeys)}
                                  </p>
                                )}
                                <h4 className="font-bold text-slate-900 text-xs leading-snug break-words">{row.component}</h4>
                              </div>
                            </div>
                            <div className="w-full pl-0">
                              {renderIntervalBadges(row.intervals)}
                            </div>
                          </div>
                          <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-1 border-t border-slate-100 pt-2 min-w-0">
                            {row.actions.map((step, i) => (
                              <li key={i} className={ACTION_STEP_VIEW}>{step}</li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </>
                )
                ) : (
                  <>
                    {/* Laptop / tablet: matrix edit */}
                    <div className="hidden md:block">
                      <table className="w-full min-w-[980px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-150 text-[10px] font-bold uppercase text-slate-400 bg-slate-50 sticky top-0">
                            <th className="py-2 px-3 w-10 text-center">#</th>
                            {showEquipmentPicker && <th className="py-2 px-3 w-40">Equipment</th>}
                            <th className="py-2 px-3 w-44">Component</th>
                            <th className="py-2 px-3 w-80">Action Steps</th>
                            {SCHEDULE_INTERVALS.map((c) => (
                              <th key={c.key} className="py-2 px-1 w-12 text-center" title={c.fullLabel}>{c.label}</th>
                            ))}
                            <th className="py-2 px-2 w-10" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {draft.map((row, index) => (
                            <tr key={row.id} className="align-top">
                              <td className="py-2 px-3 text-center text-xs text-slate-400">{index + 1}</td>
                              {showEquipmentPicker && (
                                <td className="py-2 px-2 min-w-[10rem]">
                                  <EquipmentMultiSelectDropdown
                                    options={scopedEquipmentOptions}
                                    value={row.equipmentKeys || []}
                                    onChange={(keys) => updateEquipmentKeys(row.id, keys)}
                                    labelMap={equipmentLabelMap}
                                    emptyLabel="— Select equipment —"
                                    compact
                                  />
                                </td>
                              )}
                              <td className="py-2 px-2">
                                <input type="text" value={row.component} onChange={(e) => updateComponent(row.id, e.target.value)} className="w-full px-2 py-1 text-xs border border-slate-200 rounded-lg" placeholder="Component..." />
                              </td>
                              <td className="py-2 px-2">
                                <div className="space-y-1">
                                  {row.actions.map((step, stepIdx) => (
                                    <div key={stepIdx} className="flex items-start gap-1">
                                      <span className="text-slate-300 mt-1">•</span>
                                      <ActionStepInput
                                        value={step}
                                        onChange={(e) => updateAction(row.id, stepIdx, e.target.value)}
                                        className={ACTION_STEP_INPUT}
                                        placeholder={`Step ${stepIdx + 1}`}
                                      />
                                      {row.actions.length > 1 && (
                                        <button type="button" onClick={() => deleteAction(row.id, stepIdx)} className="text-slate-300 hover:text-rose-500 mt-0.5 shrink-0"><MdClose className="w-3.5 h-3.5" /></button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <button type="button" onClick={() => addAction(row.id)} className="mt-1 text-[10px] font-bold text-blue-600">+ Add Step</button>
                              </td>
                              {SCHEDULE_INTERVALS.map((c) => {
                                const on = row.intervals.includes(c.key);
                                return (
                                  <td key={c.key} className="py-2 px-1 text-center">
                                    <button type="button" onClick={() => toggleInterval(row.id, c.key)} className={`w-7 h-7 rounded border mx-auto flex items-center justify-center ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'}`}>
                                      {on && <MdCheck className="w-3.5 h-3.5" />}
                                    </button>
                                  </td>
                                );
                              })}
                              <td className="py-2 px-2 text-center">
                                <button type="button" onClick={() => deleteRow(row.id)} className="text-slate-400 hover:text-rose-600"><MdDelete className="w-4 h-4" /></button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: stacked card edit */}
                    <div className="md:hidden p-4 space-y-4">
                      {draft.map((row, index) => (
                        <div key={row.id} className="border border-slate-200 rounded-xl p-4 bg-white shadow-sm">
                          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                            <span className="text-xs font-bold text-slate-500 uppercase">Item {index + 1}</span>
                            <button type="button" onClick={() => deleteRow(row.id)} className="text-slate-400 hover:text-rose-600"><MdDelete className="w-4 h-4" /></button>
                          </div>
                          <div className="space-y-4">
                            {showEquipmentPicker && (
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Equipment</label>
                                <div className="mt-1">
                                  <EquipmentMultiSelectDropdown
                                    options={scopedEquipmentOptions}
                                    value={row.equipmentKeys || []}
                                    onChange={(keys) => updateEquipmentKeys(row.id, keys)}
                                    labelMap={equipmentLabelMap}
                                    emptyLabel="— Select equipment —"
                                    compact
                                  />
                                </div>
                              </div>
                            )}
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Component</label>
                              <input type="text" value={row.component} onChange={(e) => updateComponent(row.id, e.target.value)} className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-lg" />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Action steps</label>
                              <div className="mt-1 space-y-1.5">
                                {row.actions.map((step, stepIdx) => (
                                  <div key={stepIdx} className="flex items-start gap-2">
                                    <span className="text-slate-300 mt-1.5">•</span>
                                    <ActionStepInput
                                      value={step}
                                      onChange={(e) => updateAction(row.id, stepIdx, e.target.value)}
                                      className={ACTION_STEP_INPUT_MOBILE}
                                    />
                                    {row.actions.length > 1 && (
                                      <button type="button" onClick={() => deleteAction(row.id, stepIdx)} className="text-slate-400 hover:text-rose-600 mt-1 shrink-0"><MdClose className="w-4 h-4" /></button>
                                    )}
                                  </div>
                                ))}
                                <button type="button" onClick={() => addAction(row.id)} className="text-xs font-bold text-indigo-600">+ Add Step</button>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-slate-50">
                            <span className="text-[10px] font-bold text-slate-500 uppercase block mb-2">Intervals</span>
                            <div className="flex flex-wrap gap-1.5">
                              {SCHEDULE_INTERVALS.map((c) => {
                                const on = row.intervals.includes(c.key);
                                return (
                                  <button key={c.key} type="button" onClick={() => toggleInterval(row.id, c.key)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                                    {c.fullLabel}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
            </div>

            {isEditing && (
              <div className="px-4 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/40">
                <button
                  type="button"
                  onClick={addRow}
                  disabled={!canAddRow}
                  title={!canAddRow ? 'Select equipment on all rows before adding another' : undefined}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold border border-slate-200 bg-white rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <MdAdd className="w-4 h-4" /> Add Row
                </button>
              </div>
            )}
      </EquipmentSectionShell>
    </div>
  );
}
