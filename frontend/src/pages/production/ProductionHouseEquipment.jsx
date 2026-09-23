import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  MdArrowForward,
  MdCheckBox,
  MdCheckBoxOutlineBlank,
  MdDriveFileMove,
  MdPrecisionManufacturing,
  MdSearch,
  MdSelectAll,
  MdSettings,
} from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../api/axios';
import Spinner from '../../components/Spinner';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import AppFormsHeader from '../../components/AppFormsHeader';
import CardOverflowMenu from '../../components/CardOverflowMenu';
import ProductionHouseMoveModal from '../../components/production/ProductionHouseMoveModal';
import { buildProductionHouseEquipmentTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';
import useLockedCardManageAccess from '../../hooks/useLockedCardManageAccess';
import useFormsHubViewOnly from '../../hooks/useFormsHubViewOnly';
import { productionHouseSectionLabel } from '../../config/productionHouseHouses';

const LIMIT = 200;

const ProductionHouseEquipment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const appId = location.state?.appId;
  const appName = useAppName(appId);
  const { canManage } = useLockedCardManageAccess();
  const canManageProduction = canManage('production');
  const viewOnly = useFormsHubViewOnly();

  const [equipment, setEquipment] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [moveItems, setMoveItems] = useState(null);
  const [moveSaving, setMoveSaving] = useState(false);

  const loadEquipment = async (nextQuery = query) => {
    const { data } = await api.get('/production-house', {
      params: { limit: LIMIT, q: nextQuery },
    });
    const rows = (data.equipment || []).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }),
    );
    setEquipment(rows);
    setTotal(data.total || 0);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/production-house', {
          params: { limit: LIMIT, q: query },
        });
        if (cancelled) return;
        const rows = (data.equipment || []).sort((a, b) =>
          String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }),
        );
        setEquipment(rows);
        setTotal(data.total || 0);
      } catch {
        if (!cancelled) toast.error('Failed to load equipment.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [query]);

  const canMoveCard = (eq) => Boolean(eq) && !viewOnly && (!eq.isImported || canManageProduction);

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const startSelectMode = (eq) => {
    setSelectMode(true);
    setSelectedIds(eq ? new Set([String(eq.id)]) : new Set());
  };

  const toggleSelect = (eq) => {
    if (!canMoveCard(eq)) return;
    const id = String(eq.id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedCards = equipment.filter((eq) => selectedIds.has(String(eq.id)));

  const openMoveModal = (items) => {
    const list = (items || []).filter(canMoveCard);
    if (!list.length) {
      toast.error('Select at least one item you can move.');
      return;
    }
    setMoveItems(list);
  };

  const confirmMove = async (house_section) => {
    if (!moveItems?.length) return;
    setMoveSaving(true);
    try {
      const { data } = await api.post('/production-house/move', {
        equipmentIds: moveItems.map((eq) => Number(eq.id)),
        house_section,
      });
      toast.success(data?.message || 'Moved.');
      setMoveItems(null);
      exitSelectMode();
      try {
        await loadEquipment(query);
      } catch {
        toast.error('Moved, but the list could not be refreshed.');
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Move failed.');
    } finally {
      setMoveSaving(false);
    }
  };

  const openCard = (eq) => {
    navigate(`/production-house-equipment/${eq.id}`, { state: location.state });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    exitSelectMode();
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

      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-6">
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
            onClick={() => { setSearch(''); setQuery(''); exitSelectMode(); }}
          >
            Clear
          </button>
        )}
        {selectMode ? (
          <>
            <span className="text-xs font-semibold text-slate-600 self-center">
              {selectedCards.length} selected
            </span>
            <button
              type="button"
              disabled={moveSaving || !selectedCards.length}
              onClick={() => openMoveModal(selectedCards)}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-800 rounded-lg border border-fuchsia-200 disabled:opacity-50"
            >
              <MdDriveFileMove className="w-3.5 h-3.5" />
              Move
            </button>
            <button
              type="button"
              onClick={exitSelectMode}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg border border-slate-200"
            >
              Cancel
            </button>
          </>
        ) : null}
      </form>

      {loading ? (
        <div className="flex justify-center py-24"><Spinner size="lg" /></div>
      ) : equipment.length === 0 ? (
        <p className="text-center py-16 text-gray-400 text-sm">No equipment found.</p>
      ) : (
        <>
          <p className="text-sm text-gray-500 mb-3">{total} equipment cards</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {equipment.map((eq) => {
              const selected = selectedIds.has(String(eq.id));
              const movable = canMoveCard(eq);
              return (
                <div
                  key={eq.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (selectMode) {
                      if (movable) toggleSelect(eq);
                      return;
                    }
                    openCard(eq);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      if (selectMode) {
                        if (movable) toggleSelect(eq);
                        return;
                      }
                      openCard(eq);
                    }
                  }}
                  className={`card p-4 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-fuchsia-500 ${
                    selected ? 'ring-2 ring-fuchsia-400' : ''
                  } ${selectMode && !movable ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 min-w-0">
                      {selectMode ? (
                        <span className="mt-2 shrink-0 text-fuchsia-700">
                          {selected
                            ? <MdCheckBox className="h-5 w-5" />
                            : <MdCheckBoxOutlineBlank className="h-5 w-5" />}
                        </span>
                      ) : null}
                      <div className="h-10 w-10 rounded-lg bg-violet-50 text-violet-700 flex items-center justify-center shrink-0">
                        <MdSettings className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 leading-snug">{eq.name}</h3>
                        {eq.isImported ? (
                          <p className="text-[10px] font-medium text-slate-500 mt-0.5">Imported</p>
                        ) : null}
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
                    <div className="flex items-center gap-1 shrink-0">
                      {movable && !selectMode ? (
                        <CardOverflowMenu
                          disabled={moveSaving}
                          items={[
                            { label: 'Move', icon: MdDriveFileMove, onClick: () => openMoveModal([eq]) },
                            { label: 'Select', icon: MdSelectAll, onClick: () => startSelectMode(eq) },
                          ]}
                        />
                      ) : null}
                      <MdArrowForward className="h-5 w-5 text-gray-400 group-hover:text-violet-600 mt-0.5 shrink-0" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {moveItems?.length ? (
        <ProductionHouseMoveModal
          sourceItems={moveItems}
          saving={moveSaving}
          onClose={() => { if (!moveSaving) setMoveItems(null); }}
          onConfirm={confirmMove}
        />
      ) : null}
    </main>
  );
};

export default ProductionHouseEquipment;
