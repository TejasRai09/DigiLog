import { withoutGsmaLabel } from '../../utils/displayLabels';
import { getBiHubMeta } from '../../config/biHubMeta';

const CARD_IMAGES = {
  bi_management_dashboard: '/images/bi/bi-card-management.jpg',
  bi_cane_performance: '/images/bi/bi-card-cane.jpg',
  bi_brix_sampling: '/images/bi/bi-card-quality.jpg',
  bi_centre_maturity: '/images/bi/bi-card-maturity.jpg',
  bi_milling_operations: '/images/bi/bi-card-milling.jpg',
  bi_power_house: '/images/bi/bi-card-power.jpg',
  bi_distillery_operations: '/images/bi/bi-card-distillery.jpg',
  bi_purchy_analysis: '/images/bi/bi-card-purchy.jpg',
};

function LightPhoto({ src, className = '' }) {
  return (
    <div className={`overflow-hidden bg-slate-200 ${className}`}>
      {src ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover object-center brightness-[1.15] contrast-[0.95] saturate-[0.85] transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="h-full w-full bg-slate-200" />
      )}
    </div>
  );
}

function GridCard({ form, onOpen }) {
  const meta = getBiHubMeta(form.formKey, withoutGsmaLabel(form.name));
  const Icon = meta.Icon;
  const isManagement = form.formKey === 'bi_management_dashboard';
  const spanClass = isManagement ? 'sm:col-span-2 sm:row-span-2' : 'col-span-1';
  const bgImage = CARD_IMAGES[form.formKey];

  return (
    <button
      type="button"
      onClick={() => onOpen(form)}
      className={`group relative flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl border border-slate-200 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-[240px] ${spanClass} ${isManagement ? 'min-h-[280px] sm:min-h-full' : ''}`}
    >
      <LightPhoto src={bgImage} className="absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/70 to-transparent" />

      <div className="relative z-10 flex h-full flex-col justify-between p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className={`flex items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${isManagement ? 'h-12 w-12' : 'h-10 w-10'}`}>
            <Icon className={`${isManagement ? 'h-6 w-6' : 'h-5 w-5'} text-blue-600`} aria-hidden />
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200 transition-colors group-hover:bg-blue-600 group-hover:text-white group-hover:ring-blue-600">
            <svg className="h-4 w-4 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </div>

        <div className="min-w-0 rounded-xl bg-white px-3.5 py-3 ring-1 ring-slate-200/80 sm:px-4 sm:py-3.5">
          <h3 className={`font-black tracking-tight text-slate-900 ${isManagement ? 'text-xl sm:text-2xl' : 'text-base sm:text-lg'}`}>
            {meta.title}
          </h3>
          {meta.subtitle && (
            <p className={`mt-0.5 font-semibold text-slate-500 ${isManagement ? 'text-sm' : 'text-xs'}`}>
              {meta.subtitle}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function HubListTable({ forms, onOpen }) {
  return (
    <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="w-14 px-4 py-3">#</th>
                <th className="px-4 py-3">Dashboard</th>
                <th className="px-4 py-3">Description</th>
                <th className="w-28 px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((form, i) => {
                const meta = getBiHubMeta(form.formKey, withoutGsmaLabel(form.name));
                const Icon = meta.Icon;
                return (
                  <tr
                    key={form._id ?? form.id ?? form.formKey}
                    onClick={() => onOpen(form)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onOpen(form);
                      }
                    }}
                    tabIndex={0}
                    className="group cursor-pointer border-b border-slate-100 last:border-b-0 transition-colors even:bg-slate-50/70 hover:bg-blue-50 focus:outline-none focus-visible:bg-blue-50"
                  >
                    <td className="px-4 py-3 align-middle text-sm font-bold tabular-nums text-slate-400">
                      {String(i + 1).padStart(2, '0')}
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
                          <Icon className="h-5 w-5 text-blue-600" aria-hidden />
                        </div>
                        <span className="font-bold text-slate-900">{meta.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-middle text-[13px] leading-snug text-slate-600">
                      {meta.description || '—'}
                    </td>
                    <td className="px-4 py-3 align-middle text-right">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white shadow-sm shadow-blue-500/20 transition-colors group-hover:bg-blue-700">
                        Open
                        <svg className="h-3.5 w-3.5 -rotate-45" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function BiBentoHub({ forms, onOpen, viewMode = 'grid' }) {
  if (!forms || forms.length === 0) return null;

  if (viewMode === 'list') {
    return <HubListTable forms={forms} onOpen={onOpen} />;
  }

  return (
    <div className="mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4 xl:gap-8">
        {forms.map((form) => (
          <GridCard key={form._id ?? form.id ?? form.formKey} form={form} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}
