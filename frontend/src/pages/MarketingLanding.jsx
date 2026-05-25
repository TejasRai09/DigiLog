import { useState, useEffect } from 'react';
import {
  MdArrowForward,
  MdAutoAwesome,
  MdBolt,
  MdCheck,
  MdCheckCircle,
  MdEditNote,
  MdGrass,
  MdLocalFlorist,
  MdTabletMac,
  MdTrendingUp,
  MdVerifiedUser,
  MdWaterDrop,
} from 'react-icons/md';
import DigiLogLoginModal from '../components/DigiLogLoginModal';
import MarketingSiteNav from '../components/marketing/MarketingSiteNav';
import OperationsDeskCard from '../components/marketing/OperationsDeskCard';
import { useOpenLoginFromQuery } from '../hooks/useOpenLoginFromQuery';

/** Public marketing homepage at `/` with embedded operations desk preview; log in via modal only. */
export default function MarketingLanding() {
  const [loginOpen, setLoginOpen] = useState(false);
  useOpenLoginFromQuery(setLoginOpen);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setLoginOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-screen bg-[#fafaf9] font-sans text-slate-800 antialiased selection:bg-green-100 selection:text-green-900">
      <DigiLogLoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
      <MarketingSiteNav onLoginClick={() => setLoginOpen(true)} />

      <main className="relative overflow-hidden bg-mesh pb-16 pt-32 lg:pb-24 lg:pt-40">
        <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h1 className="mx-auto mb-6 max-w-5xl text-5xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            Forms, Analytics & Secure AI.
            <br />
            <span className="text-green-700">Unified in your digital logbook.</span>
          </h1>
          <p className="mx-auto mb-12 mt-4 max-w-3xl text-lg font-medium leading-relaxed text-slate-600 sm:text-xl">
            DigiLog connects Sugar, Power, and Ethanol divisions. Instantly digitize manual shift sheets, generate
            real-time performance analytics, and deploy local AI queries that respect your data&apos;s privacy.
          </p>
        </div>

        <div id="operations-desk" className="relative z-10 mx-auto mt-4 max-w-7xl scroll-mt-24 px-4 pb-4 sm:px-6 lg:px-8">
          <OperationsDeskCard />
        </div>
      </main>

      <section id="three-pillars" className="relative bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-green-600">The Platform</h2>
            <h3 className="mb-4 text-3xl font-extrabold text-slate-900 md:text-4xl">The Three Pillars of Plant Efficiency</h3>
            <p className="text-lg text-slate-600">
              DigiLog doesn&apos;t stop at replacing paper. It connects every part of your operation with secure data streams,
              custom math calculations, and enterprise AI.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 shadow-bento transition-all hover:-translate-y-1 hover:shadow-soft">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <MdEditNote className="text-2xl" />
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-green-700">Pillar 1: Connected Forms</div>
              <h4 className="mb-3 text-xl font-bold text-slate-900">Digitized Plant Floors</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                Say goodbye to clipboard binders. Operators log everything directly onto tablets. Built-in range validation
                immediately flags typo corrections, even when operating offline.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 shadow-bento transition-all hover:-translate-y-1 hover:shadow-soft">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <MdTrendingUp className="text-2xl" />
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-green-700">Pillar 2: Real-Time Analytics</div>
              <h4 className="mb-3 text-xl font-bold text-slate-900">Automated Dashboards</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                No manual consolidation required. Collected data flows instantly into auto-calculated charts tracking extraction
                rates, fuel burn rates, and crushing volumes in real time.
              </p>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-8 shadow-bento transition-all hover:-translate-y-1 hover:shadow-soft">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-700">
                <MdAutoAwesome className="text-2xl" />
              </div>
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-green-700">Pillar 3: Secure AI Insights</div>
              <h4 className="mb-3 text-xl font-bold text-slate-900">Intelligent Diagnostics</h4>
              <p className="text-sm leading-relaxed text-slate-600">
                An AI assistant that understands complex parameters. Generate shift summaries, query database metrics instantly,
                and identify mechanical anomalies before they lead to shutdowns.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="divisions" className="relative overflow-hidden border-t border-slate-100 bg-slate-50 py-24">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-2xl text-center">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Purpose-Built</h2>
            <h3 className="mb-4 text-3xl font-extrabold text-slate-900 md:text-4xl">Tailored for every division.</h3>
            <p className="text-lg text-slate-600">
              DigiLog isn&apos;t a generic spreadsheet. It understands the specific operational language of your sugar, power, and
              ethanol facilities.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="absolute -right-0 -top-0 -z-10 h-32 w-32 rounded-bl-full bg-emerald-50 transition-transform group-hover:scale-110" />
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <MdLocalFlorist className="text-2xl" />
              </div>
              <h4 className="mb-4 text-xl font-bold text-slate-900">Sugar Division</h4>
              <ul className="space-y-3 text-sm font-medium text-slate-600">
                {['Cane weighbridge & crushing logs', 'Mill extraction efficiency tracking', 'Boiling house parameter checks', 'Bagasse moisture analysis forms'].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <MdCheck className="mt-0.5 shrink-0 text-emerald-500" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="absolute -right-0 -top-0 -z-10 h-32 w-32 rounded-bl-full bg-amber-50 transition-transform group-hover:scale-110" />
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <MdBolt className="text-2xl" />
              </div>
              <h4 className="mb-4 text-xl font-bold text-slate-900">Power Division</h4>
              <ul className="space-y-3 text-sm font-medium text-slate-600">
                {['Hourly boiler pressure & temp logs', 'Turbine operation parameters', 'Grid export & captive consumption', 'Fuel (Bagasse/Coal) inventory sync'].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <MdCheck className="mt-0.5 shrink-0 text-amber-500" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md">
              <div className="absolute -right-0 -top-0 -z-10 h-32 w-32 rounded-bl-full bg-cyan-50 transition-transform group-hover:scale-110" />
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-100 text-cyan-600">
                <MdWaterDrop className="text-2xl" />
              </div>
              <h4 className="mb-4 text-xl font-bold text-slate-900">Ethanol Division</h4>
              <ul className="space-y-3 text-sm font-medium text-slate-600">
                {['Fermentation vat temperature logs', 'Distillation yield tracking', 'Molasses quality (Brix/TRS) entry', 'Daily dispatch & storage reports'].map((t) => (
                  <li key={t} className="flex items-start gap-3">
                    <MdCheck className="mt-0.5 shrink-0 text-cyan-500" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="transformation" className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-16 text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-green-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-700">
              The Transformation
            </div>
            <h2 className="mb-4 text-3xl font-extrabold text-[#0B1B54] md:text-4xl">A night and day difference.</h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
              See exactly how DigiLog replaces chaotic, error-prone manual tasks with streamlined software workflows.
            </p>
          </div>
          <div className="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-2">
            <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-[#F8F9FA] p-8 transition-shadow hover:shadow-md">
              <div className="mb-8 flex flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="w-full max-w-sm">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                      <MdTabletMac />
                    </div>
                    <div className="text-sm font-semibold text-slate-800">Shift Log Submission</div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4">
                      <div className="h-2 w-24 rounded bg-slate-200" />
                      <div className="h-2 w-12 rounded bg-slate-200" />
                    </div>
                    <div className="relative flex h-10 items-center justify-between overflow-hidden rounded-lg border border-green-200 bg-slate-50 px-4">
                      <div className="h-2 w-32 rounded bg-green-200" />
                      <div className="h-2 w-8 rounded bg-green-400" />
                      <div className="absolute inset-0 flex items-center justify-end bg-green-500/10 px-3">
                        <MdCheck className="text-sm text-green-600" />
                      </div>
                    </div>
                    <div className="flex h-10 items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4">
                      <div className="h-2 w-20 rounded bg-slate-200" />
                      <div className="h-2 w-16 rounded bg-slate-200" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-green-600">Connected Forms</div>
                <h4 className="mb-3 text-2xl font-bold leading-tight text-[#0B1B54]">Digitized Forms that don&apos;t suck</h4>
                <p className="text-sm leading-relaxed text-slate-600">
                  Operators use tablets with clean, customized DigiLog input designs. Built-in validation prevents typos, and data is
                  instantly synced—no more greasy clipboards.
                </p>
              </div>
            </div>

            <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-[#F8F9FA] p-8 transition-shadow hover:shadow-md">
              <div className="relative mb-8 flex flex-1 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="relative z-10 w-full max-w-sm">
                  <div className="mb-6 flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <MdTrendingUp />
                    </div>
                    <div className="text-sm font-semibold text-slate-800">Daily Production Yield</div>
                  </div>
                  <div className="mt-2 flex h-24 items-end gap-2">
                    <div className="h-1/3 w-1/5 rounded-t-md bg-slate-100" />
                    <div className="h-1/2 w-1/5 rounded-t-md bg-slate-200" />
                    <div className="h-2/3 w-1/5 rounded-t-md bg-slate-300" />
                    <div className="h-3/4 w-1/5 rounded-t-md bg-emerald-200" />
                    <div className="group relative h-full w-1/5 rounded-t-md bg-emerald-500">
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-slate-800 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                        9.2%
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-green-600">Real-Time Analytics</div>
                <h4 className="mb-3 text-2xl font-bold leading-tight text-[#0B1B54]">Live Dashboards in seconds</h4>
                <p className="text-sm leading-relaxed text-slate-600">
                  No manual data entry or paper transcription. The moment a form is submitted to DigiLog, the corporate dashboard
                  updates with interactive charts.
                </p>
              </div>
            </div>

            <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-[#F8F9FA] p-8 transition-shadow hover:shadow-md">
              <div className="mb-8 flex flex-1 flex-col justify-center gap-4 rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex max-w-[85%] items-start gap-3 self-end rounded-xl border border-green-100 bg-green-50 p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100">
                    <MdAutoAwesome className="text-xs text-green-700" />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-bold text-green-900">DigiLog AI</div>
                    <div className="text-xs leading-snug text-green-800">
                      Notice: Boiler #2 pressure has dropped 5% steadily over the last 3 shifts.
                    </div>
                    <button type="button" className="mt-2 rounded-md bg-green-600 px-3 py-1 text-[10px] font-semibold text-white">
                      Investigate
                    </button>
                  </div>
                </div>
                <div className="flex max-w-[70%] items-center gap-3 rounded-xl bg-slate-100 p-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-300 text-xs font-bold text-slate-600">
                    JD
                  </div>
                  <div className="text-xs text-slate-700">Thanks, sending maintenance team now.</div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-green-600">Secure AI Insights</div>
                <h4 className="mb-3 text-2xl font-bold leading-tight text-[#0B1B54]">AI Early Warnings</h4>
                <p className="text-sm leading-relaxed text-slate-600">
                  The secure AI constantly monitors incoming logbook data. It detects subtle drifts from baseline and alerts
                  supervisors before surprises happen.
                </p>
              </div>
            </div>

            <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-[#F8F9FA] p-8 transition-shadow hover:shadow-md">
              <div className="mb-8 flex flex-1 items-center justify-center rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="w-full max-w-sm space-y-4">
                  <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-600">
                        <MdGrass className="text-xs" />
                      </div>
                      <span className="text-xs font-medium text-slate-700">Sugar: Bagasse Output</span>
                    </div>
                    <MdArrowForward className="text-slate-400" />
                  </div>
                  <div className="flex justify-center">
                    <div className="h-6 w-px bg-slate-200" />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-600">
                        <MdBolt className="text-xs" />
                      </div>
                      <span className="text-xs font-bold text-green-900">Power: Fuel Inventory Updated</span>
                    </div>
                    <MdCheckCircle className="text-green-500" />
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-sm font-semibold text-green-600">Cross-Division Sync</div>
                <h4 className="mb-3 text-2xl font-bold leading-tight text-[#0B1B54]">One Unified Hub</h4>
                <p className="text-sm leading-relaxed text-slate-600">
                  All three divisions feed into the same database. Bagasse from Sugar instantly reflects as Fuel Inventory in Power.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="relative overflow-hidden border-b border-t border-slate-100 bg-slate-50 py-24">
        <div className="absolute left-1/2 top-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-50/40 blur-3xl" />
        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-16 max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-green-800">
              <MdVerifiedUser className="text-sm text-green-600" /> Enterprise Security
            </div>
            <h2 className="mb-4 text-3xl font-extrabold text-slate-900 md:text-4xl">Secure AI that respects your database privacy.</h2>
            <p className="text-lg leading-relaxed text-slate-600">
              Most industrial tools feed entire databases to third-party AI models, risking critical business IP. DigiLog uses a
              proprietary <strong>Zero-Data Query Architecture</strong>. Here is exactly how we keep your records 100% isolated.
            </p>
          </div>
          <div className="relative mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-4">
            <div className="pointer-events-none absolute left-[10%] right-[10%] top-[70px] -z-10 hidden h-0.5 border-t-2 border-dashed border-slate-200 lg:block" />
            {[
              { n: '1', box: 'slate', title: 'Schema-Only Transfer', sub: 'Metadata Sharing', body: 'We only send structural blueprints (columns, types) of your DB to the AI model. No real figures or names ever leave.' },
              { n: '2', box: 'green', title: 'AI Writes the Query', sub: 'Secure AI Drafting', body: 'The AI reasons against the schema to write custom SQL. It drafts this blind, relying purely on the metadata template.' },
              { n: '3', box: 'emerald', title: 'Executed Internally', sub: 'Local Sandboxing', body: 'DigiLog intercepts the query and runs it locally on your secure server. The AI has zero connection to your active databases.' },
              { n: '4', box: 'cyan', title: 'Summarized Output Only', sub: 'Contextual Summaries', body: 'Only the aggregated data result is shown back to the AI. It uses this restricted output to construct your human-friendly executive summary.' },
            ].map((s) => (
              <div key={s.n} className="flex h-full flex-col rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-base font-extrabold text-slate-700">
                  {s.n}
                </div>
                <div className="mb-1 text-xs font-semibold text-green-600">{s.sub}</div>
                <h4 className="mb-2 text-base font-bold text-slate-900">{s.title}</h4>
                <p className="text-xs leading-relaxed text-slate-600">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-900 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center">
              <svg viewBox="0 0 64 64" fill="none" className="h-full w-full" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <rect x="18" y="38" width="32" height="12" rx="2" fill="#94a3b8" />
                <rect x="16" y="28" width="32" height="12" rx="2" fill="#cbd5e1" />
                <rect x="14" y="18" width="32" height="12" rx="2" fill="#f1f5f9" />
                <path d="M34 18V28L37 25.5L40 28V18H34" fill="#94a3b8" />
              </svg>
            </div>
            <span className="text-sm font-bold text-slate-300">DigiLog</span>
          </div>
          <div className="text-sm text-slate-500">&copy; {new Date().getFullYear()} DigiLog. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
