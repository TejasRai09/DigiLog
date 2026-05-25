import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdInsights, MdApps } from 'react-icons/md';
import AppBreadcrumb from '../components/AppBreadcrumb';
import { buildBiTowerTrail } from '../utils/breadcrumbTrail';
import toast from 'react-hot-toast';
import api from '../api/axios';
import FormTable from '../components/FormTable';
import AppFormsHeader from '../components/AppFormsHeader';
import Spinner from '../components/Spinner';
import { BI_CONTROL_TOWER_APP_NAME } from '../config/biDashboardRoutes';

const BiControlTower = () => {
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <AppBreadcrumb items={buildBiTowerTrail()} />

      <AppFormsHeader
        name={BI_CONTROL_TOWER_APP_NAME}
        description={
          <>
            Analytics dashboards you are mapped to—same employee access as{' '}
            <Link to="/forms-hub" className="text-blue-600 hover:underline font-medium">
              Forms Hub
            </Link>
            . Pick a row to open a dashboard.
          </>
        }
        icon={MdInsights}
        color="#6366f1"
      />

      {!app || !app.forms?.length ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <MdApps className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No BI dashboards assigned</p>
          <p className="text-sm text-gray-400 mt-1 max-w-md">
            An administrator can assign the <span className="font-medium text-gray-600">BI Control Tower</span> app or
            individual dashboard forms to your account under Employee management.
          </p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-800">Dashboards</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {app.forms.length} dashboard{app.forms.length !== 1 ? 's' : ''} available
            </p>
          </div>
          <div className="p-0">
            <FormTable
              forms={app.forms}
              appId={app._id ?? app.id}
              nameColumnHeader="Dashboard name"
              emptyMessage="No dashboards are assigned to you for this app."
            />
          </div>
        </div>
      )}
    </main>
  );
};

export default BiControlTower;
