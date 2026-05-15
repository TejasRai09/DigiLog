import { Link } from 'react-router-dom';
import { MdChevronRight } from 'react-icons/md';
import useAuth from '../hooks/useAuth';

const HomeLanding = () => {
  const { user } = useAuth();

  const cardBase =
    'group relative flex h-full min-h-[30rem] sm:min-h-[32rem] lg:min-h-[35rem] flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-0 ' +
    'shadow-[0_22px_48px_-12px_rgba(15,23,42,0.14),0_10px_22px_-12px_rgba(15,23,42,0.08)] ' +
    'ring-1 ring-slate-900/[0.04] transition-all duration-300 ease-out ' +
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
    'hover:-translate-y-1.5';

  return (
    <main className="mx-auto min-h-[calc(100vh-4rem)] max-w-6xl px-4 sm:px-6 lg:px-10 py-10 sm:py-12 lg:py-16 bg-slate-50/60">
      <div className="mb-10 sm:mb-12 lg:mb-14 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700/90 mb-2">
          Zuari Industries · DigiLog
        </p>
        <h1 className="page-title text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900">
          Hello{user?.name ? `, ${user.name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-2.5 text-sm sm:text-base text-slate-600 leading-relaxed">
          Pick a destination. Forms Hub opens your assigned operational logbooks and modules; BI Control
          Tower lists analytics dashboards you are assigned (same access model as forms).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 xl:gap-10 md:items-stretch">
        <Link
          to="/forms-hub"
          className={
            cardBase +
            ' hover:border-blue-200/90 hover:ring-blue-500/10 ' +
            'hover:shadow-[0_32px_64px_-14px_rgba(37,99,235,0.28),0_18px_40px_-16px_rgba(15,23,42,0.14)] ' +
            'focus-visible:ring-blue-500'
          }
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-500 to-violet-500 opacity-90" />
          <div className="relative min-h-0 flex-[2] basis-0 overflow-hidden border-b border-slate-100/90 bg-gradient-to-br from-blue-50 via-indigo-50/90 to-violet-50">
            <img
              src="/forms-hub-illustration.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center select-none"
              loading="lazy"
              decoding="async"
              sizes="(min-width: 768px) 42vw, 100vw"
            />
          </div>
          <div className="relative flex min-h-0 flex-[1] basis-0 flex-col justify-center bg-gradient-to-b from-white via-white to-slate-50/70 px-8 py-8 sm:px-9 sm:py-9 lg:px-10">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-2.5">
              Forms Hub
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm sm:text-[15px]">
              Centralized access to digital operational forms—mill, lab, power, distillery, EHS and
              equipment history, based on your access.
            </p>
            <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-blue-200/80 bg-blue-50/90 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition-all duration-300 group-hover:border-blue-300 group-hover:bg-blue-100/95 group-hover:gap-3 group-hover:shadow-md">
              Open Forms Hub
              <MdChevronRight className="h-5 w-5 shrink-0" aria-hidden />
            </span>
          </div>
        </Link>

        <Link
          to="/bi"
          className={
            cardBase +
            ' hover:border-violet-200/90 hover:ring-violet-500/10 ' +
            'hover:shadow-[0_32px_64px_-14px_rgba(109,40,217,0.24),0_18px_40px_-16px_rgba(15,23,42,0.14)] ' +
            'focus-visible:ring-violet-600'
          }
        >
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-violet-600 via-indigo-500 to-sky-500 opacity-90" />
          <div className="relative min-h-0 flex-[2] basis-0 overflow-hidden border-b border-slate-100/90 bg-gradient-to-br from-sky-50 via-violet-50/95 to-indigo-100">
            <img
              src="/bi-control-tower-illustration.png"
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center select-none"
              loading="lazy"
              decoding="async"
              sizes="(min-width: 768px) 42vw, 100vw"
            />
          </div>
          <div className="relative flex min-h-0 flex-[1] basis-0 flex-col justify-center bg-gradient-to-b from-white via-white to-slate-50/70 px-8 py-8 sm:px-9 sm:py-9 lg:px-10">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 mb-2.5">
              BI Control Tower
            </h2>
            <p className="text-slate-600 leading-relaxed text-sm sm:text-[15px]">
              Unified business intelligence: open assigned dashboards from live operational data (starting
              with distillery operations analytics).
            </p>
            <span className="mt-6 inline-flex w-fit items-center gap-2 rounded-full border border-violet-200/80 bg-violet-50/90 px-4 py-2 text-sm font-semibold text-violet-900 shadow-sm transition-all duration-300 group-hover:border-violet-300 group-hover:bg-violet-100/95 group-hover:gap-3 group-hover:shadow-md">
              Open BI Control Tower
              <MdChevronRight className="h-5 w-5 shrink-0" aria-hidden />
            </span>
          </div>
        </Link>
      </div>
    </main>
  );
};

export default HomeLanding;
