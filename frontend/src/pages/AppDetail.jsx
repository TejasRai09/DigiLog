import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdArrowBack, MdApps } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import FormTable from '../components/FormTable';
import Spinner from '../components/Spinner';
import { BI_CONTROL_TOWER_APP_NAME } from '../config/biDashboardRoutes';

const AppDetail = () => {
  const { appId } = useParams();
  const navigate  = useNavigate();

  const [app, setApp]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApp = async () => {
      try {
        const { data: apps } = await api.get('/apps');
        const found = apps.find((a) => String(a._id) === String(appId));
        if (!found) { toast.error('App not found.'); navigate('/'); return; }
        setApp(found);
      } catch {
        toast.error('Failed to load app details.');
      } finally {
        setLoading(false);
      }
    };
    fetchApp();
  }, [appId, navigate]);

  if (loading) return <div className="flex justify-center py-24"><Spinner size="lg" /></div>;
  if (!app)    return null;

  const isBiControlTower = app.name === BI_CONTROL_TOWER_APP_NAME;
  const n = app.forms?.length ?? 0;

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <MdArrowBack className="h-4 w-4" />
        Back to homepage
      </button>

      {/* App header */}
      <div className="flex items-center gap-4 mb-8">
        <div
          className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-md flex-shrink-0"
          style={{ backgroundColor: app.color || '#2563EB' }}
        >
          <MdApps className="h-7 w-7" />
        </div>
        <div>
          <h1 className="page-title">{app.name}</h1>
          {app.description && (
            <p className="text-sm text-gray-500 mt-0.5">{app.description}</p>
          )}
        </div>
      </div>

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
