import { MdClose, MdHome } from 'react-icons/md';
import { PRODUCTION_HOUSE_SECTIONS } from '../../config/productionHouseHouses';

export default function ProductionHouseMoveModal({
  sourceItems = [],
  onClose,
  onConfirm,
  saving = false,
}) {
  const count = sourceItems.length;
  const currentHouse = count === 1 ? sourceItems[0]?.house_section : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Move items</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {count === 1 ? '1 item selected' : `${count} items selected`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" disabled={saving}>
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-1 p-3">
          {PRODUCTION_HOUSE_SECTIONS.map((house) => {
            const alreadyThere = count > 0 && sourceItems.every((item) => item.house_section === house.id);
            return (
              <button
                key={house.id}
                type="button"
                disabled={saving || alreadyThere}
                onClick={() => onConfirm(house.id)}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left hover:bg-fuchsia-50 disabled:opacity-50"
              >
                <MdHome className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-600" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{house.label}</span>
                  <span className="text-xs text-slate-500">
                    {alreadyThere
                      ? currentHouse === house.id
                        ? 'Already in this house'
                        : 'Selected items are already in this house'
                      : house.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
