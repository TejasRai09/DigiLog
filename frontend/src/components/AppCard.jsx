import { useNavigate } from 'react-router-dom';
import { MdElectricBolt, MdApps, MdChevronRight, MdLocalBar, MdPrecisionManufacturing, MdScience, MdPower, MdFlashOn, MdSecurity } from 'react-icons/md';

const ICON_MAP = {
  MdElectricBolt,
  MdApps,
  MdLocalBar,
  MdPrecisionManufacturing,
  MdScience,
  MdPower,
  MdFlashOn,
  MdSecurity,
};

const AppCard = ({ app }) => {
  const navigate = useNavigate();
  const Icon = ICON_MAP[app.icon] || MdApps;
  const formCount = app.forms?.length ?? 0;

  return (
    <button
      onClick={() => navigate(`/apps/${String(app._id)}`)}
      className="card p-6 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-sm"
          style={{ backgroundColor: app.color || '#2563EB' }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <MdChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors mt-1" />
      </div>

      <h3 className="text-base font-semibold text-gray-900 mb-1">{app.name}</h3>
      {app.description && (
        <p className="text-sm text-gray-500 line-clamp-2 mb-3">{app.description}</p>
      )}

      <div className="flex items-center gap-1.5">
        <span className="badge bg-blue-50 text-blue-700">
          {formCount} {formCount === 1 ? 'Form' : 'Forms'}
        </span>
      </div>
    </button>
  );
};

export default AppCard;
