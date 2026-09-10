import { useNavigate } from 'react-router-dom';
import {
  MdElectricBolt,
  MdApps,
  MdChevronRight,
  MdLocalBar,
  MdPrecisionManufacturing,
  MdScience,
  MdPower,
  MdFlashOn,
  MdSecurity,
  MdInsights,
  MdFactory,
  MdDomain,
} from 'react-icons/md';
import { getSingleHubRoute, hubNavState } from '../config/hubFormRoutes';
import { withoutGsmaLabel } from '../utils/displayLabels';

const ICON_MAP = {
  MdElectricBolt,
  MdApps,
  MdLocalBar,
  MdPrecisionManufacturing,
  MdScience,
  MdPower,
  MdFlashOn,
  MdSecurity,
  MdInsights,
  MdFactory,
  MdDomain,
};

function parseHexColor(raw, fallback = '#2563EB') {
  const hex = String(raw || fallback).trim();
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return { r: 37, g: 99, b: 235, hex: fallback };
  const n = parseInt(m[1], 16);
  return {
    r: (n >> 16) & 255,
    g: (n >> 8) & 255,
    b: n & 255,
    hex: `#${m[1]}`,
  };
}

function rgba({ r, g, b }, a) {
  return `rgba(${r},${g},${b},${a})`;
}

const AppCard = ({ app }) => {
  const navigate = useNavigate();
  const Icon = ICON_MAP[app.icon] || MdApps;
  const formCount = app.forms?.length ?? 0;
  const singleHub = getSingleHubRoute(app.forms);
  const appId = String(app._id ?? app.id);
  const color = parseHexColor(app.color);

  const openApp = () => {
    if (singleHub) {
      navigate(singleHub.path, { state: hubNavState(singleHub.formKey, { appId }) });
      return;
    }
    navigate(`/apps/${appId}`);
  };

  return (
    <button
      type="button"
      onClick={openApp}
      className="group relative w-full overflow-hidden rounded-2xl border border-white/70 p-6 text-left shadow-sm backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:border-white hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      style={{
        backgroundImage: `linear-gradient(145deg, ${rgba(color, 0.07)} 0%, ${rgba(color, 0.025)} 45%, rgba(255,255,255,0.82) 100%)`,
        backgroundColor: 'rgba(255,255,255,0.68)',
      }}
    >
      <span
        className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full opacity-20 blur-2xl"
        style={{ background: rgba(color, 0.22) }}
        aria-hidden
      />
      <span
        className="pointer-events-none absolute -bottom-12 -left-8 h-24 w-24 rounded-full opacity-15 blur-2xl"
        style={{ background: rgba(color, 0.14) }}
        aria-hidden
      />

      <div className="relative mb-4 flex items-start justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-white shadow-sm ring-1 ring-white/50"
          style={{
            backgroundImage: `linear-gradient(135deg, ${color.hex} 0%, ${rgba(color, 0.78)} 100%)`,
            backgroundColor: color.hex,
          }}
        >
          <Icon className="h-6 w-6" />
        </div>
        <MdChevronRight className="mt-1 h-5 w-5 text-slate-400 transition-colors group-hover:text-slate-700" />
      </div>

      <h3 className="relative mb-1 text-base font-semibold text-slate-900">
        {withoutGsmaLabel(app.name)}
      </h3>
      {app.description && (
        <p className="relative mb-3 line-clamp-2 text-sm text-slate-600">
          {withoutGsmaLabel(app.description)}
        </p>
      )}

      <div className="relative flex items-center gap-1.5">
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium backdrop-blur-sm"
          style={{
            backgroundColor: rgba(color, 0.07),
            color: color.hex,
            border: `1px solid ${rgba(color, 0.12)}`,
          }}
        >
          {formCount} {formCount === 1 ? 'Form' : 'Forms'}
        </span>
      </div>
    </button>
  );
};

export default AppCard;
