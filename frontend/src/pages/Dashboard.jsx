import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MdApps } from 'react-icons/md';
import toast from 'react-hot-toast';
import AppBreadcrumb from '../components/AppBreadcrumb';
import AppPageHeader from '../components/AppPageHeader';
import AppCard from '../components/AppCard';
import Spinner from '../components/Spinner';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';
import { buildFormsHubTrail } from '../utils/breadcrumbTrail';
import { BI_CONTROL_TOWER_APP_NAME } from '../config/biDashboardRoutes';
import { isRetiredFormsHubApp } from '../config/retiredFormsHubApps';

const EQUIPMENT_APP_NAMES = [
  'Power Plant Equipment History',
  'Sugar House Equipment History',
  'Production House Equipment History',
  'Mill House Equipment History',
  'Power Plant Equipment History (old)',
];

const SECTIONS = [
  {
    id: 'operations',
    title: 'Operations forms',
    description: 'Daily operational logbooks including mill, lab, power, distillery, and EHS forms.',
  },
  {
    id: 'equipment',
    title: 'Equipment maintenance and history',
    description: 'Equipment hierarchy, specifications, OEM schedules, and maintenance history.',
  },
];

function AppGrid({ apps }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {apps.map((app) => (
        <AppCard key={app._id ?? app.id} app={app} />
      ))}
    </div>
  );
}

const Dashboard = () => {
  const { user } = useAuth();
  const { hash } = useLocation();
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/apps');
        if (!cancelled) setApps(data);
      } catch {
        if (!cancelled) toast.error('Failed to load apps.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { operationsApps, equipmentApps } = useMemo(() => {
    const formsHubApps = apps.filter(
      (a) => a.name !== BI_CONTROL_TOWER_APP_NAME && !isRetiredFormsHubApp(a.name),
    );
    return {
      operationsApps: formsHubApps.filter((app) => !EQUIPMENT_APP_NAMES.includes(app.name)),
      equipmentApps: formsHubApps.filter((app) => EQUIPMENT_APP_NAMES.includes(app.name)),
    };
  }, [apps]);

  const sections = [
    { ...SECTIONS[0], apps: operationsApps },
    { ...SECTIONS[1], apps: equipmentApps },
  ];
  const visibleSections = sections.filter((section) => section.apps.length > 0);
  const showEmptyHub = !loading && visibleSections.length === 0;

  useEffect(() => {
    if (loading) return undefined;
    const id = String(hash || '').replace('#', '');
    if (!id) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hash, loading, visibleSections.length]);

  return (
    <main className="app-main">
      <AppBreadcrumb items={buildFormsHubTrail()} />

      <AppPageHeader className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Forms Hub
        </h1>
        {user?.name ? (
          <p className="mt-2 text-sm font-medium text-slate-700">Signed in as {user.name}</p>
        ) : (
          <p className="mt-2 text-sm font-medium text-slate-700">
            Your assigned applications, grouped by section.
          </p>
        )}
      </AppPageHeader>

      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : showEmptyHub ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-white/60 bg-white/50 py-24 text-center shadow-sm backdrop-blur-md">
          <MdApps className="mb-3 h-12 w-12 text-gray-300" />
          <p className="font-medium text-gray-500">No applications assigned</p>
          <p className="mt-1 text-sm text-gray-400">Contact your admin to get access.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {visibleSections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-24">
              <div className="mb-5">
                <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
                  {section.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{section.description}</p>
              </div>
              <AppGrid apps={section.apps} />
            </section>
          ))}
        </div>
      )}
    </main>
  );
};

export default Dashboard;
