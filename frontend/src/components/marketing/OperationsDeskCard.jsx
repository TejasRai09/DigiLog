import { useState } from 'react';
import {
  MdArrowForward,
  MdAutoAwesome,
  MdBolt,
  MdCheck,
  MdCheckCircle,
  MdEditDocument,
  MdEditNote,
  MdGrass,
  MdHome,
  MdTrendingUp,
  MdVerifiedUser,
  MdWaterDrop,
} from 'react-icons/md';

const tabBtnInactive =
  'flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 hover:text-slate-800 flex items-center justify-center gap-1.5';
const tabBtnActive =
  'flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition-all bg-white text-slate-800 shadow-sm ring-1 ring-green-100 flex items-center justify-center gap-1.5 [&>svg]:text-green-600';

/** Interactive operations-desk mockup (Digital Forms / Analytics / Secure AI). */
export default function OperationsDeskCard({ className = '' }) {
  const [tab, setTab] = useState('ai');

  return (
    <div className={`group relative mx-auto w-full max-w-5xl ${className}`}>
      <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-br from-green-200/55 via-emerald-100/40 to-green-50/30 opacity-90 blur-xl transition duration-1000 group-hover:opacity-100" />
      <div className="relative flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_50px_-12px_rgba(22,101,52,0.08),0_8px_24px_-8px_rgba(15,23,42,0.06)]">
        <div className="flex h-auto min-h-16 flex-col items-center justify-between gap-3 border-b border-slate-100 bg-white px-4 py-2 sm:h-16 sm:flex-row sm:py-0">
          <div className="flex w-full items-center gap-4 sm:w-auto">
            <div className="hidden gap-1.5 md:flex">
              <div className="h-3.5 w-3.5 rounded-full bg-red-400" />
              <div className="h-3.5 w-3.5 rounded-full bg-amber-400" />
              <div className="h-3.5 w-3.5 rounded-full bg-green-500" />
            </div>
            <div className="flex w-full rounded-xl bg-slate-100 p-1 sm:w-auto">
              <button type="button" onClick={() => setTab('forms')} className={tab === 'forms' ? tabBtnActive : tabBtnInactive}>
                <MdEditNote className="text-base" /> Digital Forms
              </button>
              <button type="button" onClick={() => setTab('analytics')} className={tab === 'analytics' ? tabBtnActive : tabBtnInactive}>
                <MdTrendingUp className="text-base" /> Analytics
              </button>
              <button type="button" onClick={() => setTab('ai')} className={tab === 'ai' ? tabBtnActive : tabBtnInactive}>
                <MdAutoAwesome className="text-base" /> Secure AI Assistant
              </button>
            </div>
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-bold text-green-800 ring-1 ring-green-100/80">
              Mill Operations Desk
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
              OP
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-6 bg-slate-50/50 p-6 text-left md:flex-row">
          <div className="flex w-full shrink-0 flex-row gap-2 overflow-x-auto border-b border-slate-100 pb-2 pr-0 md:w-48 md:flex-col md:border-b-0 md:border-r md:pb-0 md:pr-4">
            <div className="flex shrink-0 items-center gap-2 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-xs font-bold text-green-900 shadow-sm">
              <MdHome className="text-green-600" /> Main Logbook
            </div>
            <div className="flex shrink-0 items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" /> Sugar Division
            </div>
            <div className="flex shrink-0 items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" /> Power Division
            </div>
            <div className="flex shrink-0 items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-500">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-cyan-500" /> Ethanol Division
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {tab === 'forms' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Boiler Operational Parameters Log</h3>
                    <p className="text-[11px] text-slate-400">Power Division — Shift B Logbook Entry</p>
                  </div>
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Pending Submission</span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">Steam Temperature (°C)</label>
                    <input type="text" disabled className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium" value="512.5" readOnly />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">Boiler Steam Pressure (kg/cm²)</label>
                    <input
                      type="text"
                      disabled
                      className="w-full rounded-lg border border-green-200/80 bg-green-50/50 px-3 py-1.5 text-xs font-semibold text-green-900"
                      value="42.8"
                      readOnly
                    />
                    <span className="mt-1 block text-[9px] font-medium text-green-700">✓ Auto-validated within range</span>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold text-slate-500">Feed Water Flow (Tons/Hr)</label>
                    <input type="text" disabled className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium" value="115" readOnly />
                  </div>
                </div>
                <div className="mt-2 flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-200/50 bg-slate-100/50 p-4 sm:flex-row">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                      <MdEditDocument />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-700">Digital Handover Signature</div>
                      <div className="text-[10px] text-slate-400">Authenticated via PIN (Operator Code: OP-424)</div>
                    </div>
                  </div>
                  <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800">
                    Sign & Sync Log
                  </button>
                </div>
              </div>
            )}

            {tab === 'analytics' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Production Performance Analytics</h3>
                    <p className="text-[11px] text-slate-400">Cross-Division derived calculations (Real-Time)</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">Sugar Extraction: Active</span>
                    <span className="rounded bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-800">Ethanol Yield: Optimal</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { label: 'Sugar Recovery Rate', badge: '11.4% Target', value: '11.18%', color: 'text-green-600', path: 'M0 15 Q20 5, 40 12 T80 2 T100 8' },
                    { label: 'Power Exported to Grid', badge: 'Daily Peak', value: '18.5 MW', color: 'text-green-700', path: 'M0 18 Q20 12, 40 14 T80 3 T100 5' },
                    { label: 'Ethanol Yield per Ton', badge: 'B-Heavy', value: '298 Liters', color: 'text-green-600', path: 'M0 12 Q20 18, 40 8 T80 15 T100 3' },
                  ].map((w) => (
                    <div key={w.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">{w.label}</span>
                        <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{w.badge}</span>
                      </div>
                      <div className="mb-1 text-xl font-extrabold text-slate-800">{w.value}</div>
                      <svg viewBox="0 0 100 20" className={`h-6 w-full ${w.color}`} stroke="currentColor" fill="none" strokeWidth="2" aria-hidden>
                        <path d={w.path} />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === 'ai' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Secure AI Assistant</h3>
                    <p className="text-[11px] text-slate-400">Local Schema Pipeline Execution — Active Sandbox Mode</p>
                  </div>
                  <span className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                    <MdVerifiedUser className="text-sm text-white" /> Zero Data Leak Protection
                  </span>
                </div>
                <div className="space-y-3 rounded-xl border border-slate-200/50 bg-[#F8F9FA] p-4">
                  <div className="flex max-w-[80%] items-start gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[9px] font-bold text-white">
                      JD
                    </div>
                    <div className="rounded-xl border border-slate-200/50 bg-white p-2.5 text-xs text-slate-700 shadow-sm">
                      &quot;Tell me if there were any weird steam pressure anomalies yesterday.&quot;
                    </div>
                  </div>
                  <div className="flex max-w-[90%] flex-row-reverse items-start gap-2 self-end">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-[9px] font-bold text-white">
                      AI
                    </div>
                    <div className="rounded-xl border border-green-100 bg-green-50 p-3 text-xs text-slate-800 shadow-sm">
                      <div className="mb-1 flex items-center gap-1.5 font-bold text-green-900">
                        <MdAutoAwesome /> Secure Query Complete
                      </div>
                      <p className="mb-2 text-[11px] leading-relaxed text-slate-600">
                        Based on the structured database schema, I queried average pressure trends. Yes, we identified a{' '}
                        <strong>4.5 kg/cm² drop at 14:32</strong>.
                      </p>
                      <div className="rounded-lg border border-green-100 bg-green-50/90 p-2 font-mono text-[10px] text-slate-600">
                        Executed offline query: SELECT avg_pressure FROM power_shift_metrics WHERE timestamp = &apos;14:32:00&apos;
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
