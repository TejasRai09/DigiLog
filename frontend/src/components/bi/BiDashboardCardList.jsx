import { useNavigate } from 'react-router-dom';
import { MdOpenInNew, MdScience, MdPrecisionManufacturing, MdShoppingCart, MdElectricBolt, MdAgriculture, MdInsights, MdNaturePeople } from 'react-icons/md';
import { biDashboardPath } from '../../config/biDashboardRoutes';
import { withoutGsmaLabel } from '../../utils/displayLabels';

// Icons per dashboard
const ICON_BY_FORM_KEY = {
  bi_distillery_operations: MdScience,
  bi_milling_operations: MdPrecisionManufacturing,
  bi_purchy_analysis: MdShoppingCart,
  bi_power_house: MdElectricBolt,
  bi_cane_performance: MdAgriculture,
  bi_brix_sampling: MdScience,
  bi_centre_maturity: MdNaturePeople,
};

function getDashboardIcon(formKey) {
  return ICON_BY_FORM_KEY[formKey] || MdInsights;
}

function getDashboardImage(formKey) {
  if (!formKey) return '/images/bi/distillery_1786537981132.png';
  if (formKey.includes('distillery')) return '/images/bi/distillery_1786537981132.png';
  if (formKey.includes('milling')) return '/images/bi/milling_1786537998090.png';
  if (formKey.includes('purchy')) return '/images/bi/purchy_1786538013993.png';
  if (formKey.includes('power')) return '/images/bi/power_1786538037518.png';
  if (formKey.includes('cane_performance')) return '/images/bi/cane_perf_1786538051591.png';
  if (formKey.includes('brix')) return '/images/bi/brix_1786538065719.png';
  if (formKey.includes('centre_maturity')) return '/images/bi/centre_maturity_1786538090829.png';
  return '/images/bi/distillery_1786537981132.png';
}

export default function BiDashboardCardList({ forms, appId }) {
  const navigate = useNavigate();

  const openDashboard = (form) => {
    const path = biDashboardPath(form.formKey);
    if (!path) return;
    const state = {};
    if (appId != null && appId !== '') {
      state.appId = String(appId);
      state.returnTo = '/bi';
    }
    navigate(path, { state: Object.keys(state).length ? state : undefined });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5">
      {forms.map((form) => {
        const Icon = getDashboardIcon(form.formKey);
        const imageUrl = getDashboardImage(form.formKey);
        
        return (
          <div
            key={form._id ?? form.id ?? form.formKey}
            className="flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1 group cursor-pointer"
            onClick={() => openDashboard(form)}
          >
            {/* Top Image Section */}
            <div className="relative h-44 w-full overflow-hidden bg-slate-100">
              <img
                src={imageUrl}
                alt={withoutGsmaLabel(form.name)}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent opacity-80" />
              <div className="absolute bottom-3 left-3 rounded-xl bg-white/20 p-2 backdrop-blur-md shadow-sm border border-white/20">
                <Icon className="h-5 w-5 text-white" />
              </div>
            </div>

            {/* Content Section */}
            <div className="flex flex-1 flex-col p-5">
              <h3 className="mb-2 text-lg font-extrabold text-slate-900 line-clamp-1">
                {withoutGsmaLabel(form.name)}
              </h3>
              <p className="flex-1 text-[13px] leading-relaxed text-slate-500 line-clamp-2">
                {form.description || 'Analytics dashboard mapped to your account.'}
              </p>

              {/* Action Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openDashboard(form);
                }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50/60 py-3 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Open Dashboard
                <MdOpenInNew className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
