import { useEffect, useState } from 'react';
import {
  MdSave,
  MdCheckCircle,
  MdOutlineCheckCircle,
  MdSelectAll,
  MdDeselect,
  MdCalendarToday,
  MdTune,
  MdCheck
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

const BI_DASHBOARDS = [
  { id: 'brix_sampling', label: 'Brix Sampling Analytics', icon: '🍇', desc: 'Field & Yard sampling dashboards' },
  { id: 'centre_maturity', label: 'Centre Maturity BI', icon: '📊', desc: 'Centre indents, purchases & maturity analytics' },
  { id: 'purchy_analysis', label: 'Purchy Analysis', icon: '🎫', desc: 'Purchy distribution and cane supply analytics' },
  { id: 'milling_operations', label: 'Milling Operations', icon: '⚙️', desc: 'Mill thermal, lube, roller and outage reports' },
  { id: 'distillery_operations', label: 'Distillery Analytics', icon: '🧪', desc: 'Distillery production and yield analytics' },
];

export default function BiDashboardSettingsSection() {
  const [enabled, setEnabled] = useState(false);
  const [dashboardSeasons, setDashboardSeasons] = useState({});
  const [activeDashboardId, setActiveDashboardId] = useState('brix_sampling');
  const [allSeasons, setAllSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [settingsRes, seasonsRes] = await Promise.allSettled([
          api.get('/admin/bi-settings'),
          api.get('/admin/season-mapping'),
        ]);

        if (cancelled) return;

        if (settingsRes.status === 'fulfilled' && settingsRes.value.data) {
          const data = settingsRes.value.data;
          setEnabled(Boolean(data.thirdSeasonCompareEnabled));
          
          let ds = data.dashboardSeasons;
          if (!ds || typeof ds !== 'object' || Array.isArray(ds)) {
            ds = {};
          }
          // Support legacy payload if visibleSeasons array was saved
          if (Object.keys(ds).length === 0 && Array.isArray(data.visibleSeasons) && data.visibleSeasons.length > 0) {
            ds = {
              brix_sampling: data.visibleSeasons,
              centre_maturity: data.visibleSeasons,
            };
          }
          setDashboardSeasons(ds);
        }

        if (seasonsRes.status === 'fulfilled' && seasonsRes.value.data) {
          setAllSeasons(Array.isArray(seasonsRes.value.data) ? seasonsRes.value.data : []);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load BI dashboard settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeDashboardObj = BI_DASHBOARDS.find(d => d.id === activeDashboardId) || BI_DASHBOARDS[0];
  const activeVisibleSeasons = Array.isArray(dashboardSeasons[activeDashboardId]) ? dashboardSeasons[activeDashboardId] : [];

  const toggleSeasonForDashboard = (dashboardId, seasonLabel) => {
    setDashboardSeasons(prev => {
      const currentList = Array.isArray(prev[dashboardId]) ? prev[dashboardId] : [];
      const updatedList = currentList.includes(seasonLabel)
        ? currentList.filter(s => s !== seasonLabel)
        : [...currentList, seasonLabel];
      
      return {
        ...prev,
        [dashboardId]: updatedList,
      };
    });
  };

  const selectAllSeasonsForDashboard = (dashboardId) => {
    setDashboardSeasons(prev => ({
      ...prev,
      [dashboardId]: allSeasons.map(s => s.season_label),
    }));
  };

  const clearAllSeasonsForDashboard = (dashboardId) => {
    setDashboardSeasons(prev => ({
      ...prev,
      [dashboardId]: [],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/bi-settings', {
        thirdSeasonCompareEnabled: enabled,
        dashboardSeasons,
      });
      setEnabled(Boolean(data.thirdSeasonCompareEnabled));
      if (data.dashboardSeasons && typeof data.dashboardSeasons === 'object') {
        setDashboardSeasons(data.dashboardSeasons);
      }
      toast.success('Dashboard season settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dStr) => {
    if (!dStr) return '';
    return new Date(dStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <ConfigSectionPanel
      title="BI Dashboards & Season Settings"
      description="Configure comparison rules and choose visible seasons independently for each BI analytics dashboard."
      actions={
        loading ? (
          <Spinner size="sm" />
        ) : (
          <button type="button" onClick={handleSave} disabled={saving} className="btn-primary shrink-0 gap-2">
            <MdSave className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        )
      }
    >
      <div className="space-y-6">
        {/* Toggle 3rd Season */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={enabled}
              disabled={loading || saving}
              onChange={(e) => setEnabled(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <div>
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Enable 3rd season comparison on all BI dashboards
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                When enabled, analytics dashboards display options to compare up to 3 seasons simultaneously.
              </p>
            </div>
          </label>
        </div>

        {/* Dashboard Selector Tabs */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mb-1">
              <MdTune className="text-blue-500" /> Select BI Dashboard to Configure
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a dashboard tab below to configure which seasons are visible for comparison in that specific dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
            {BI_DASHBOARDS.map((dash) => {
              const selectedList = Array.isArray(dashboardSeasons[dash.id]) ? dashboardSeasons[dash.id] : [];
              const isActive = activeDashboardId === dash.id;
              const filterCountText = selectedList.length === 0 ? 'All' : `${selectedList.length} Active`;

              return (
                <button
                  key={dash.id}
                  type="button"
                  onClick={() => setActiveDashboardId(dash.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{dash.icon}</span>
                  <span>{dash.label}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded-md ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : selectedList.length > 0
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                  }`}>
                    {filterCountText}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Dashboard Configuration Panel */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">{activeDashboardObj.icon}</span>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {activeDashboardObj.label} — Season Settings
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {activeDashboardObj.desc}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => selectAllSeasonsForDashboard(activeDashboardId)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                >
                  <MdSelectAll className="w-3.5 h-3.5" /> Select All
                </button>
                <span className="text-slate-300 dark:text-slate-700">|</span>
                <button
                  type="button"
                  onClick={() => clearAllSeasonsForDashboard(activeDashboardId)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <MdDeselect className="w-3.5 h-3.5" /> Show All (Default)
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-8 flex justify-center"><Spinner size="md" /></div>
            ) : allSeasons.length === 0 ? (
              <div className="text-sm text-slate-500 py-4 text-center">
                No mapped seasons found. Add seasons in the <strong>Season Mapping</strong> section first.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {allSeasons.map((s) => {
                  const isSelected = activeVisibleSeasons.includes(s.season_label);
                  const isAllMode = activeVisibleSeasons.length === 0;

                  return (
                    <div
                      key={s.id || s.season_label}
                      onClick={() => toggleSeasonForDashboard(activeDashboardId, s.season_label)}
                      className={`p-3 rounded-xl border cursor-pointer transition-all duration-150 flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30 dark:border-blue-500/80 shadow-sm'
                          : isAllMode
                          ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/30 opacity-60 hover:opacity-80'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`text-lg ${isSelected ? 'text-blue-600 dark:text-blue-400' : isAllMode ? 'text-slate-400' : 'text-slate-300 dark:text-slate-600'}`}>
                          {isSelected ? <MdCheckCircle /> : <MdOutlineCheckCircle />}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {s.season_label}
                          </span>
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {formatDate(s.start_date)} — {formatDate(s.end_date)}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : isAllMode
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600'
                      }`}>
                        {isSelected ? 'Active' : isAllMode ? 'All (Default)' : 'Hidden'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between pt-1">
              <span>
                {activeVisibleSeasons.length === 0
                  ? `Showing all seasons by default in ${activeDashboardObj.label}.`
                  : `${activeVisibleSeasons.length} of ${allSeasons.length} season(s) explicitly enabled for ${activeDashboardObj.label}.`}
              </span>
            </div>
          </div>
        </div>

        {/* Dashboard Overview Summary */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-2">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            All Dashboards Configuration Summary
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {BI_DASHBOARDS.map((dash) => {
              const list = Array.isArray(dashboardSeasons[dash.id]) ? dashboardSeasons[dash.id] : [];
              return (
                <div key={dash.id} className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800">
                  <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span>{dash.icon}</span> {dash.label}
                  </span>
                  <span className="font-mono text-[11px] text-blue-600 dark:text-blue-400 font-bold">
                    {list.length === 0 ? 'All Seasons' : `${list.length} Season(s)`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ConfigSectionPanel>
  );
}
