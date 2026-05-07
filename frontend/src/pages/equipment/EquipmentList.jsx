import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdSearch, MdArrowForward } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';

const LIMIT = 50;

const EquipmentList = () => {
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [query, setQuery]         = useState('');
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/equipment', { params: { page, limit: LIMIT, q: query } });
        setEquipment(data.equipment);
        setTotal(data.total);
      } catch {
        toast.error('Failed to load equipment list.');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [page, query]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="page-title">Mill House — Equipment History Cards</h1>
        <p className="text-sm text-gray-500 mt-1">{total} equipment records</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or equipment number…"
          className="input max-w-sm"
        />
        <button type="submit" className="btn-primary">
          <MdSearch className="h-4 w-4" /> Search
        </button>
        {query && (
          <button
            type="button"
            className="btn-secondary"
            onClick={() => { setSearch(''); setQuery(''); setPage(1); }}
          >
            Clear
          </button>
        )}
      </form>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : (
        <>
          <div className="table-wrapper">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="th w-10">#</th>
                  <th className="th">Equipment No.</th>
                  <th className="th">Name of Equipment</th>
                  <th className="th">Location</th>
                  <th className="th">Plant</th>
                  <th className="th">Commissioned</th>
                  <th className="th w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {equipment.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="td text-center text-gray-400 py-16">
                      No equipment found.
                    </td>
                  </tr>
                ) : equipment.map((eq, idx) => (
                  <tr
                    key={eq.id}
                    className="hover:bg-blue-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/equipment/${eq.id}`)}
                  >
                    <td className="td text-gray-400">{(page - 1) * LIMIT + idx + 1}</td>
                    <td className="td font-mono font-semibold text-blue-700">{eq.equip_no}</td>
                    <td className="td font-medium text-gray-900">{eq.name}</td>
                    <td className="td text-gray-500">{eq.location || '—'}</td>
                    <td className="td text-gray-500">{eq.plant}</td>
                    <td className="td text-gray-500">{eq.commissioned || '—'}</td>
                    <td className="td text-gray-400">
                      <MdArrowForward className="h-4 w-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  Previous
                </button>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
};

export default EquipmentList;
