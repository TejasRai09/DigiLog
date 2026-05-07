import { useEffect, useState } from 'react';
import { MdApps, MdRefresh } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';
import AppCard from '../components/AppCard';
import Spinner from '../components/Spinner';

const Dashboard = () => {
  const { user } = useAuth();
  const [apps, setApps]     = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/apps');
      setApps(data);
    } catch {
      toast.error('Failed to load apps.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApps(); }, []);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="page-title">
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Select an application to get started
          </p>
        </div>
        <button onClick={fetchApps} className="btn-secondary">
          <MdRefresh className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* App cards */}
      {loading ? (
        <div className="flex justify-center py-24">
          <Spinner size="lg" />
        </div>
      ) : apps.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <MdApps className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No applications assigned</p>
          <p className="text-sm text-gray-400 mt-1">Contact your admin to get access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps.map((app) => (
            <AppCard key={app._id} app={app} />
          ))}
        </div>
      )}
    </main>
  );
};

export default Dashboard;
