import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdApps, MdRefresh, MdPrecisionManufacturing, MdChevronRight, MdFlashOn, MdSecurity } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import useAuth from '../hooks/useAuth';
import AppCard from '../components/AppCard';
import Spinner from '../components/Spinner';

// Static module cards that live outside the DB-driven app list
const STATIC_MODULES = [
  {
    id:          'mill-house-equipment',
    name:        'Mill House Equipment',
    description: 'Equipment life history cards — specs, OEM schedule and maintenance history',
    color:       '#7C3AED',
    Icon:        MdPrecisionManufacturing,
    route:       '/equipment',
    badge:       'History Cards',
  },
  {
    id:          'power-plant-equipment',
    name:        'Power Plant Equipment',
    description: 'Electrical, Instrument and control valve history cards for the 30MW power plant',
    color:       '#D97706',
    Icon:        MdFlashOn,
    route:       '/power',
    badge:       'History Cards',
  },
  {
    id:          'ehs',
    name:        'EHS',
    description: 'Environment Health & Safety — incident reports, accident register and water dashboard',
    color:       '#16A34A',
    Icon:        MdSecurity,
    route:       '/ehs',
    badge:       'EHS Forms',
  },
];

const StaticCard = ({ mod }) => {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(mod.route)}
      className="card p-6 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-sm"
          style={{ backgroundColor: mod.color }}
        >
          <mod.Icon className="h-6 w-6" />
        </div>
        <MdChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors mt-1" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1">{mod.name}</h3>
      {mod.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{mod.description}</p>
      )}
      <div className="flex items-center gap-1.5">
        <span className="badge bg-purple-50 text-purple-700">{mod.badge}</span>
      </div>
    </button>
  );
};

const Dashboard = () => {
  const { user } = useAuth();
  const [apps, setApps]       = useState([]);
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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
          {STATIC_MODULES.map((mod) => (
            <StaticCard key={mod.id} mod={mod} />
          ))}
          {apps.length === 0 && STATIC_MODULES.length === 0 && (
            <div className="col-span-full card flex flex-col items-center justify-center py-24 text-center">
              <MdApps className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No applications assigned</p>
              <p className="text-sm text-gray-400 mt-1">Contact your admin to get access.</p>
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default Dashboard;
