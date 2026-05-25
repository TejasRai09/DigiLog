import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdApps } from 'react-icons/md';
import AppBreadcrumb from '../components/AppBreadcrumb';
import { buildAppDetailTrail } from '../utils/breadcrumbTrail';
import toast from 'react-hot-toast';
import api from '../api/axios';
import FormTable from '../components/FormTable';
import AppFormsHeader from '../components/AppFormsHeader';
import Spinner from '../components/Spinner';
import { BI_CONTROL_TOWER_APP_NAME } from '../config/biDashboardRoutes';
import { getSingleHubRoute, hubNavState } from '../config/hubFormRoutes';
import { withoutGsmaLabel } from '../utils/displayLabels';

const AppDetail = () => {
  const { appId } = useParams();
  const navigate  = useNavigate();

  const [app, setApp]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchApp = async () => {
      let skipLoadingDone = false;
      try {
        const { data: apps } = await api.get('/apps');
        if (cancelled) return;
        const found = apps.find((a) => String(a._id) === String(appId));
        if (!found) {
          toast.error('App not found.');
          navigate('/dashboard');
          return;
        }
        const singleHub = getSingleHubRoute(found.forms);
        if (singleHub) {
          skipLoadingDone = true;
          navigate(singleHub.path, {
            state: hubNavState(singleHub.formKey, { appId: String(appId) }),
            replace: true,
          });
          return;
        }
        setApp(found);
      } catch {
        if (!cancelled) toast.error('Failed to load app details.');
      } finally {
        if (!cancelled && !skipLoadingDone) setLoading(false);
      }
    };
    fetchApp();
    return () => {
      cancelled = true;
    };
  }, [appId, navigate]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!app)    return null;

  const isBiControlTower = app.name === BI_CONTROL_TOWER_APP_NAME;
  const n = app.forms?.length ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <AppBreadcrumb items={buildAppDetailTrail(withoutGsmaLabel(app.name))} />

      <AppFormsHeader
        name={app.name}
        description={app.description}
        color={app.color || '#2563EB'}
        icon={MdApps}
      />

      {/* Forms table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            {isBiControlTower ? 'Available dashboards' : 'Available Forms'}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {n} {isBiControlTower ? 'dashboard' : 'form'}
            {n !== 1 ? 's' : ''} available
          </p>
        </div>
        <div className="p-0">
          <FormTable
            forms={app.forms}
            appId={appId}
            nameColumnHeader={isBiControlTower ? 'Dashboard name' : 'Form Name'}
            emptyMessage={
              isBiControlTower
                ? 'No dashboards are assigned to you for this app.'
                : 'No forms are assigned to you for this app.'
            }
          />
        </div>
      </div>
    </main>
  );
};

export default AppDetail;
