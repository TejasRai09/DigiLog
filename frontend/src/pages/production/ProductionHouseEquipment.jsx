import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MdArrowForward, MdPrecisionManufacturing, MdSearch, MdSettings } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import AppFormsHeader from '../../components/AppFormsHeader';
import { buildProductionHouseEquipmentTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import { productionHouseSectionLabel } from '../../config/productionHouseHouses';

const LIMIT = 200;

const ProductionHouseEquipment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const appId = location.state?.appId;
  const appName = useAppName(appId);

  const [equipment, setEquipment] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/production-house', {
          params: { limit: LIMIT, q: query },
        });
        if (!cancelled) {
          const rows = (data.equipment || []).sort((a, b) =>
            String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' })
          );
          setEquipment(rows);
          setTotal(data.total || 0);
        }
      } catch {
        if (!cancelled) toast.error('Failed to load equipment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  const openCard = (eq) => {
    navigate(`/production-house-equipment/${eq.id}`, { state: location.state });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setQuery(search.trim());
  };

  return (
    <main className="app-main">
      <AppBreadcrumb
        items={buildProductionHouseEquipmentTrail({ appId, appName })}
      />

      <AppFormsHeader
        name={appName || 'Production House Equipment History'}
        description="All production house equipment cards — specs and maintenance history"
        icon={MdPrecisionManufacturing}
        color="#C026D3"
        className="mb-6"
      />

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search equipment…"
          className="input max-w-sm"
        />
        <button type="submit" className="btn-primary">
          <MdSearch className="h-4 w-4" /> Search
        </button>
        {query && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setSearch(''); setQuery(''); }}
          >
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : equipment.length === 0 ? (
        <p className="text-center py-16 text-gray-400 text-sm">No equipment found.</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-3">{total} equipment cards</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {equipment.map((eq) => (
              <button
                key={eq.id}
                type="button"
                onClick={() => openCard(eq)}
                className="card p-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                      <MdSettings className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900 leading-snug">{eq.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {productionHouseSectionLabel(eq.house_section)}
                        {eq.type ? ` · ${eq.type}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {eq.duty || ''}
                        {eq.duty && eq.capacity ? ' · ' : ''}
                        {eq.capacity || ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {eq.spec_count || 0} specs · {eq.history_count || 0} history
                      </p>
                    </div>
                  </div>
                  <MdArrowForward className="h-5 w-5 text-gray-400 group-hover:text-violet-600 mt-0.5 shrink-0" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
};

export default ProductionHouseEquipment;
