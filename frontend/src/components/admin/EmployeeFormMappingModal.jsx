import { useEffect, useMemo, useState } from 'react';
import {
  MdClose, MdSave,
  MdFolder, MdFolderOpen,
  MdInsertDriveFile,
  MdKeyboardArrowRight, MdKeyboardArrowDown,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../Spinner';
import { BI_CONTROL_TOWER_APP_NAME } from '../../config/biDashboardRoutes';
import { withoutGsmaLabel } from '../../utils/displayLabels';

/**
 * Map one employee to apps + forms — multi-app tree view.
 * `mappings` should list current rows for all users (from GET /admin/mappings).
 * @param {'forms' | 'dashboards'} variant
 */
const EmployeeFormMappingModal = ({ user, mappings, onClose, onSaved, variant = 'forms' }) => {
  const isDashboardVariant = variant === 'dashboards';

  const [appsWithForms, setAppsWithForms] = useState([]);
  const [loadingApps, setLoadingApps]     = useState(true);
  const [saving, setSaving]               = useState(false);

  // Which apps are collapsed in the tree
  const [collapsedApps, setCollapsedApps] = useState(new Set());
  // Which apps the user has access to (mapping row exists)
  const [enabledApps, setEnabledApps]     = useState(new Set());
  // Per-app explicitly selected form IDs
  const [formChecked, setFormChecked]     = useState(new Map()); // Map<appId, Set<formId>>

  // ── Load apps ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/apps-all');
        if (!cancelled) {
          const raw = Array.isArray(data) ? data : [];
          const filtered = isDashboardVariant
            ? raw.filter((a) => a.name === BI_CONTROL_TOWER_APP_NAME)
            : raw.filter((a) => a.name !== BI_CONTROL_TOWER_APP_NAME);
          setAppsWithForms(filtered);
        }
      } catch {
        toast.error('Failed to load applications.');
      } finally {
        if (!cancelled) setLoadingApps(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isDashboardVariant]);

  // ── Seed state from existing mappings ────────────────────────
  const userMappings = useMemo(
    () => mappings.filter((m) => String(m.user?._id) === String(user._id)),
    [mappings, user._id],
  );

  useEffect(() => {
    if (appsWithForms.length === 0) return;
    const enabled = new Set();
    const checked = new Map();
    for (const um of userMappings) {
      const appId = String(um.app?._id);
      enabled.add(appId);
      checked.set(appId, new Set(um.forms?.map((f) => Number(f._id)) ?? []));
    }
    setEnabledApps(enabled);
    setFormChecked(checked);
    // Collapse all app form lists by default
    setCollapsedApps(new Set(appsWithForms.map((a) => String(a._id))));
  }, [userMappings, appsWithForms]);

  // ── Derived counts ───────────────────────────────────────────
  const totalMapped = useMemo(() => {
    let n = 0;
    for (const appId of enabledApps) {
      n += (formChecked.get(appId) ?? new Set()).size;
    }
    return n;
  }, [enabledApps, formChecked]);

  const appStats = (app) => {
    const appId    = String(app._id);
    const total    = (app.forms ?? []).length;
    const checked  = (formChecked.get(appId) ?? new Set()).size;
    const enabled  = enabledApps.has(appId);
    const allChecked  = total > 0 && checked === total;
    const someChecked = checked > 0 && checked < total;
    return { total, checked, enabled, allChecked, someChecked };
  };

  // ── Handlers ─────────────────────────────────────────────────
  const toggleExpand = (appId) =>
    setCollapsedApps((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId); else next.add(appId);
      return next;
    });

  const toggleAppEnabled = (app) => {
    const appId    = String(app._id);
    const allIds   = (app.forms ?? []).map((f) => Number(f._id));
    const isEnabled = enabledApps.has(appId);

    if (isEnabled) {
      // disable — remove mapping entirely
      setEnabledApps((prev) => { const s = new Set(prev); s.delete(appId); return s; });
      setFormChecked((prev) => { const m = new Map(prev); m.delete(appId); return m; });
    } else {
      // enable — select all forms by default
      setEnabledApps((prev) => new Set([...prev, appId]));
      setFormChecked((prev) => new Map([...prev, [appId, new Set(allIds)]]));
    }
  };

  const toggleForm = (appId, formId) => {
    // Checking a form auto-enables the app
    setEnabledApps((prev) => new Set([...prev, appId]));
    setFormChecked((prev) => {
      const next   = new Map(prev);
      const appSet = new Set(next.get(appId) ?? []);
      if (appSet.has(formId)) appSet.delete(formId); else appSet.add(formId);
      next.set(appId, appSet);
      return next;
    });
  };

  const selectAll = () => {
    setEnabledApps(new Set(appsWithForms.map((a) => String(a._id))));
    setFormChecked(new Map(
      appsWithForms.map((a) => [
        String(a._id),
        new Set((a.forms ?? []).map((f) => Number(f._id))),
      ]),
    ));
  };

  const clearAll = () => {
    setEnabledApps(new Set());
    setFormChecked(new Map());
  };

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      for (const app of appsWithForms) {
        const appId = String(app._id);
        if (enabledApps.has(appId)) {
          await api.post('/admin/mappings', {
            userId:  user._id,
            appId:   app._id,
            formIds: [...(formChecked.get(appId) ?? new Set())],
          });
        } else {
          const existing = userMappings.find((m) => String(m.app?._id) === appId);
          if (existing) await api.delete(`/admin/mappings/${existing._id}`);
        }
      }
      toast.success(
        isDashboardVariant
          ? 'Dashboard mapping saved. BI Control Tower homepage card updated automatically.'
          : 'Form mapping saved. Forms Hub homepage card updated automatically.',
      );
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save mapping.');
    } finally {
      setSaving(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isDashboardVariant ? 'Dashboard mapping' : 'Form mapping'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure access for{' '}
              <span className="font-semibold text-gray-700">{user.name}</span>{' '}
              <span className="text-blue-600">({user.email})</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 mt-0.5"
            aria-label="Close"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        {/* ── Toolbar: Select All / Clear All + count ─────────── */}
        {!loadingApps && (
          <div className="px-6 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <button
                type="button"
                onClick={selectAll}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={clearAll}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                Clear All
              </button>
            </div>
            <span className="text-xs font-semibold text-gray-500">{totalMapped} mapped</span>
          </div>
        )}


        {/* ── App / form tree ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 pb-3">
          {loadingApps ? (
            <div className="flex justify-center py-12"><Spinner size="lg" /></div>
          ) : appsWithForms.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No applications found.</p>
          ) : (
            <div className="space-y-1.5">
              {appsWithForms.map((app) => {
                const appId   = String(app._id);
                const forms   = app.forms ?? [];
                const { enabled, checked, total, allChecked } = appStats(app);
                const isCollapsed = collapsedApps.has(appId);

                return (
                  <div key={app._id} className="rounded-xl border border-gray-100 overflow-hidden">

                    {/* App header row */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-white hover:bg-gray-50/60">
                      {/* Expand / collapse arrow */}
                      <button
                        type="button"
                        onClick={() => toggleExpand(appId)}
                        className="text-gray-400 hover:text-gray-600 shrink-0"
                        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                      >
                        {isCollapsed
                          ? <MdKeyboardArrowRight className="h-4 w-4" />
                          : <MdKeyboardArrowDown  className="h-4 w-4" />}
                      </button>

                      {/* App master checkbox */}
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => toggleAppEnabled(app)}
                        className="h-4 w-4 rounded text-blue-600 shrink-0 cursor-pointer"
                      />

                      {/* Folder icon + name (click to expand) */}
                      <button
                        type="button"
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => toggleExpand(appId)}
                      >
                        {isCollapsed
                          ? <MdFolder     className="h-4 w-4 text-blue-400 shrink-0" />
                          : <MdFolderOpen className="h-4 w-4 text-blue-500 shrink-0" />}
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {withoutGsmaLabel(app.name)}
                        </span>
                      </button>

                      {/* X/Y Mapped badge */}
                      {enabled && (
                        <span className="ml-2 shrink-0 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                          {allChecked ? `${total}/${total}` : `${checked}/${total}`} Mapped
                        </span>
                      )}
                    </div>

                    {/* Form rows */}
                    {!isCollapsed && forms.length > 0 && (
                      <div className="border-t border-gray-100 divide-y divide-gray-50">
                        {forms.map((form) => {
                          const formId    = Number(form._id);
                          const isChecked = (formChecked.get(appId) ?? new Set()).has(formId);
                          return (
                            <label
                              key={form._id}
                              className="flex items-center gap-3 pl-9 pr-4 py-2.5 hover:bg-gray-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleForm(appId, formId)}
                                className="h-4 w-4 rounded text-blue-600 shrink-0"
                              />
                              <MdInsertDriveFile className="h-4 w-4 text-gray-300 shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-800 leading-tight">
                                  {withoutGsmaLabel(form.name)}
                                </p>
                                <p className="text-[10px] text-gray-400 truncate">{form.formKey}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-gray-100 shrink-0 flex items-center justify-between gap-4">
          <p className="text-[10px] text-gray-400 italic leading-snug">
            Changes persist instantly inside active state.
          </p>
          <div className="flex gap-2 shrink-0">
            <button type="button" onClick={onClose} className="btn-secondary text-sm">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loadingApps}
              className="btn-primary text-sm"
            >
              {saving ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
              {saving
                ? 'Saving…'
                : isDashboardVariant ? 'Save dashboard mapping' : 'Save mapping'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EmployeeFormMappingModal;
