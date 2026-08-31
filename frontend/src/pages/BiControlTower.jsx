import { Link, useNavigate } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MdChevronRight, MdGridView, MdHome, MdInsights, MdViewList } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from '../components/Spinner';
import BiBentoHub from '../components/bi/BiBentoHub';
import { BI_CONTROL_TOWER_APP_NAME, biDashboardPath } from '../config/biDashboardRoutes';
import { sortBiHubForms } from '../config/biHubMeta';

const HUB_BG = '/images/bi/bi-industry-bg-day.jpg';
const VIEW_STORAGE_KEY = 'bi-hub-view';

function readStoredView() {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'list' ? 'list' : 'grid';
  } catch {
    return 'grid';
  }
}

const BiControlTower = () => {
  const navigate = useNavigate();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(readStoredView);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: apps } = await api.get('/apps');
        const found = apps.find((a) => a.name === BI_CONTROL_TOWER_APP_NAME);
        if (!cancelled) setApp(found ?? null);
      } catch {
        if (!cancelled) toast.error('Failed to load BI Control Tower.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const forms = useMemo(() => sortBiHubForms(app?.forms || []), [app]);

  const openDashboard = useCallback((form) => {
    const path = biDashboardPath(form.formKey);
    if (!path) return;
    const appId = app?._id ?? app?.id;
    const state = { returnTo: '/bi' };
    if (appId != null && appId !== '') state.appId = String(appId);
    navigate(path, { state });
  }, [navigate, app]);

  if (loading) {
    return (
      <div className="relative flex min-h-[calc(100dvh-3.75rem)] items-center justify-center bg-slate-100">
        <img src={HUB_BG} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <main className="relative min-h-[calc(100dvh-3.75rem)] overflow-hidden bg-slate-100">
      <img
        src={HUB_BG}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100/75 via-white/70 to-slate-100/85" />

      <div className="relative z-10 flex min-h-[calc(100dvh-3.75rem)] flex-col">
        <div className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <nav aria-label="Breadcrumb" className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 shadow-sm backdrop-blur-md">
            <ol className="flex items-center gap-1 text-xs font-semibold text-slate-600 sm:text-sm">
              <li>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1 rounded-md text-[#0056b3] hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <MdHome className="h-4 w-4" aria-hidden />
                  Home
                </Link>
              </li>
              <li className="flex items-center gap-1 text-slate-800">
                <MdChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
                BI Control Tower
              </li>
            </ol>
          </nav>

          {forms.length > 0 && (
            <div className="flex items-center gap-2">
              <div
                className="inline-flex rounded-full border border-slate-200 bg-white/90 p-0.5 shadow-sm backdrop-blur-md"
                role="group"
                aria-label="Dashboard layout"
              >
                <button
                  type="button"
                  aria-pressed={viewMode === 'grid'}
                  title="Card view"
                  onClick={() => setViewMode('grid')}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MdGridView className="h-5 w-5" aria-hidden />
                  <span className="sr-only">Card view</span>
                </button>
                <button
                  type="button"
                  aria-pressed={viewMode === 'list'}
                  title="List view"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    viewMode === 'list'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <MdViewList className="h-5 w-5" aria-hidden />
                  <span className="sr-only">List view</span>
                </button>
              </div>
              <p className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 shadow-sm backdrop-blur-md">
                {forms.length} dashboard{forms.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </div>

        {!forms.length ? (
          <div className="flex flex-1 items-center justify-center px-4 pb-16">
            <div className="max-w-md rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center shadow-sm">
              <MdInsights className="mx-auto h-12 w-12 text-blue-600" />
              <p className="mt-3 text-lg font-bold text-slate-900">No BI dashboards assigned</p>
              <p className="mt-2 text-sm text-slate-500">
                An administrator can assign the BI Control Tower app or individual dashboards to your account under Employee management.
              </p>
            </div>
          </div>
        ) : (
          <div className={`flex min-h-0 flex-1 flex-col ${viewMode === 'list' ? 'items-stretch' : 'items-center justify-center'}`}>
            <div className={`w-full overflow-y-auto pb-12 ${viewMode === 'list' ? 'pt-2 sm:pt-4' : 'pt-8 sm:pt-12'}`}>
              <BiBentoHub forms={forms} onOpen={openDashboard} viewMode={viewMode} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default BiControlTower;
