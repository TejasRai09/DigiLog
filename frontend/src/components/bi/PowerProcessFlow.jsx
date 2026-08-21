import { useMemo } from 'react';
import { formatCompact, formatInr, formatNum, formatPct } from '../../utils/powerHouseMeasures';
import { FitShell, cardShadow } from './powerHouseUi';

/**
 * Animated Power Process — boilers → steam → turbines → Grid / Sugar / Distillery.
 * SVG layout aligned to Power House theme (navy headers, cane-style elevation, dark mode).
 */

function FlowLine({ d, color, dashColor = '#ffffff', flowSpeed = '1s', reverse = false, opacity = 0.35, active = true }) {
  return (
    <g opacity={active ? 1 : 0.35}>
      <path d={d} fill="none" stroke={color} strokeWidth="6" strokeOpacity={opacity} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d={d}
        fill="none"
        stroke={dashColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? 'ph-flow-path' : undefined}
        style={
          active
            ? {
                strokeDasharray: '15 15',
                animation: `phFlowDash ${flowSpeed} linear infinite ${reverse ? 'reverse' : 'normal'}`,
              }
            : { strokeDasharray: '15 15', opacity: 0.4 }
        }
      />
    </g>
  );
}

function BoilerSVG({ x, y }) {
  return (
    <svg x={x} y={y} width="120" height="150" viewBox="0 0 120 150" overflow="visible">
      <ellipse cx="60" cy="140" rx="40" ry="10" fill="rgba(0,0,0,0.12)" />
      <rect x="25" y="120" width="12" height="20" fill="#1F2937" rx="2" />
      <rect x="83" y="120" width="12" height="20" fill="#1F2937" rx="2" />
      <rect x="15" y="130" width="90" height="6" fill="#FBBF24" rx="2" />
      <rect x="20" y="40" width="80" height="90" rx="20" fill="#EF4444" stroke="#7F1D1D" strokeWidth="4" />
      <path d="M 20 50 C 20 10, 100 10, 100 50 Z" fill="#FBBF24" stroke="#B45309" strokeWidth="4" />
      <circle cx="60" cy="30" r="6" fill="#7F1D1D" />
      <rect x="40" y="70" width="40" height="20" rx="4" fill="#FEF08A" stroke="#B45309" strokeWidth="3" />
      <rect x="45" y="75" width="8" height="10" fill="#F59E0B" rx="2" />
      <rect x="56" y="75" width="8" height="10" fill="#F59E0B" rx="2" />
      <rect x="67" y="75" width="8" height="10" fill="#F59E0B" rx="2" />
      <path
        d="M 10 40 L 0 50 L 10 55 L 5 70"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-pulse"
      />
      <path
        d="M 25 25 L 15 35 L 25 40 L 20 50"
        fill="none"
        stroke="#F59E0B"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-pulse"
        style={{ animationDelay: '0.5s' }}
      />
      <path d="M 100 60 L 120 60 L 120 100 L 130 100" fill="none" stroke="#D97706" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TurbineSVG({ x, y, spinning = true, clipId = 'ph-turbine-clip' }) {
  return (
    <svg x={x} y={y} width="100" height="100" viewBox="0 0 100 100" overflow="hidden">
      <defs>
        <clipPath id={clipId}>
          <circle cx="50" cy="50" r="34" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="45" fill="#E5E7EB" stroke="#374151" strokeWidth="6" />
      <circle cx="50" cy="50" r="35" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="2" />
      {/* Rotate in SVG space around (50,50) — CSS transform-origin is unreliable on nested <g>. */}
      <g clipPath={`url(#${clipId})`}>
        <g>
          {spinning ? (
            <animateTransform
              attributeName="transform"
              attributeType="XML"
              type="rotate"
              from="0 50 50"
              to="360 50 50"
              dur="2s"
              repeatCount="indefinite"
            />
          ) : null}
          <circle cx="50" cy="50" r="12" fill="#1F2937" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <g key={angle} transform={`rotate(${angle} 50 50)`}>
              <path
                d="M 47 38 L 53 38 L 55 16 C 50 12, 45 16, 45 16 Z"
                fill="#3B82F6"
                stroke="#1D4ED8"
                strokeWidth="1"
              />
            </g>
          ))}
          <circle cx="50" cy="50" r="5" fill="#60A5FA" />
        </g>
      </g>
    </svg>
  );
}

function GridSVG({ x, y }) {
  return (
    <svg x={x} y={y} width="100" height="100" viewBox="0 0 100 100" overflow="visible">
      <path d="M 50 10 L 20 90 L 30 90 L 50 30 L 70 90 L 80 90 Z" fill="#DBEAFE" stroke="#2563EB" strokeWidth="3" />
      <path d="M 35 45 L 65 45" stroke="#2563EB" strokeWidth="3" />
      <path d="M 28 65 L 72 65" stroke="#2563EB" strokeWidth="3" />
      <path d="M 50 10 L 15 50 M 50 10 L 85 50" stroke="#60A5FA" strokeWidth="2" strokeDasharray="4 4" />
      <circle cx="50" cy="10" r="4" fill="#F59E0B" />
      <circle cx="15" cy="50" r="4" fill="#F59E0B" />
      <circle cx="85" cy="50" r="4" fill="#F59E0B" />
    </svg>
  );
}

function SugarSVG({ x, y }) {
  return (
    <svg x={x} y={y} width="100" height="100" viewBox="0 0 100 100" overflow="visible">
      <path d="M 25 35 Q 25 10 50 15 Q 75 10 75 35 L 85 90 Q 85 95 50 95 Q 15 95 15 90 Z" fill="#FBCFE8" stroke="#DB2777" strokeWidth="4" />
      <rect x="30" y="45" width="40" height="20" fill="#FEF08A" rx="4" stroke="#CA8A04" strokeWidth="2" />
      <text x="50" y="59" fontSize="12" fontWeight="bold" textAnchor="middle" fill="#854D0E">
        SUGAR
      </text>
      <rect x="65" y="70" width="16" height="16" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="2" rx="2" />
      <rect x="75" y="80" width="16" height="16" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="2" rx="2" />
      <rect x="55" y="82" width="16" height="16" fill="#FFFFFF" stroke="#9CA3AF" strokeWidth="2" rx="2" />
    </svg>
  );
}

function DistillerySVG({ x, y }) {
  return (
    <svg x={x} y={y} width="100" height="100" viewBox="0 0 100 100" overflow="visible">
      <rect x="15" y="50" width="40" height="40" fill="#FECACA" stroke="#DC2626" strokeWidth="3" />
      <polygon points="10,50 35,30 60,50" fill="#F87171" stroke="#DC2626" strokeWidth="3" />
      <rect x="60" y="40" width="25" height="50" fill="#BAE6FD" stroke="#0284C7" strokeWidth="3" rx="8" />
      <rect x="25" y="10" width="10" height="30" fill="#FDE047" stroke="#CA8A04" strokeWidth="3" rx="2" />
      <rect x="25" y="65" width="10" height="15" fill="#FFFFFF" />
      <rect x="40" y="65" width="10" height="15" fill="#FFFFFF" />
    </svg>
  );
}

function LabelObj({ x, y, w, h, children, className = '' }) {
  return (
    <foreignObject x={x} y={y} width={w} height={h} overflow="visible">
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        className={`w-full h-full flex items-center justify-center rounded-md shadow-sm border font-semibold text-sm leading-tight tabular-nums ${className}`}
      >
        {children}
      </div>
    </foreignObject>
  );
}

function HeaderBand({ x, y, w, title }) {
  return (
    <LabelObj
      x={x}
      y={y}
      w={w}
      h={36}
      className="bg-gradient-to-r from-slate-800 via-blue-950 to-slate-900 text-white text-[12px] font-black uppercase tracking-[0.14em] border-none shadow-md"
    >
      {title}
    </LabelObj>
  );
}

export default function PowerProcessFlow({ powerKpis, steamKpis, dm = false }) {
  const p = powerKpis || {};
  const s = steamKpis || {};

  const active = useMemo(
    () => ({
      b150: (s.SteamGen150 || 0) > 0,
      b70: (s.SteamGen70 || 0) > 0,
      b35: (s.SteamGen35 || 0) > 0,
      t30: (p.PowerGen30 || 0) > 0,
      t3o: (p.PowerGen3Old || 0) > 0,
      t3n: (p.PowerGen3New || 0) > 0,
      t4: (p.PowerGen4MW || 0) > 0,
      grid: (p.ExportGrid30 || 0) > 0,
      sugar: (p.Export_Sugar || 0) > 0,
      dist: (p.PowerCons_Dist_CPU_4MW || 0) > 0,
    }),
    [p, s],
  );

  const canvasBg = dm ? '#0f172a' : '#ffffff';
  const muted = dm ? '#94a3b8' : '#4B5563';
  const chipBase = dm
    ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-md'
    : 'bg-white border-slate-200/80 text-slate-900 shadow-[0_6px_14px_-4px_rgba(15,23,42,.12)]';
  const chip = {
    bag: `${chipBase} text-emerald-500`,
    sb: `${chipBase} text-violet-500`,
    name: chipBase,
    steam: `${chipBase} text-amber-500`,
    orange: `${chipBase} text-amber-500 text-[15px]`,
    orangeOut: `${chipBase} text-amber-500`,
    spec: `${chipBase} ${dm ? 'text-slate-400' : 'text-slate-500'} text-xs`,
    power: `${chipBase} text-[15px]`,
    aux: `${chipBase} ${dm ? 'text-slate-300' : 'text-slate-600'}`,
    transfer: `${chipBase} text-blue-500 text-[15px]`,
    grid: `${chipBase} text-blue-500 text-[15px]`,
    sugar: `${chipBase} text-violet-500 text-[15px]`,
    dist: `${chipBase} text-emerald-500 text-[15px]`,
    inr: `${chipBase} text-cyan-500`,
    label: chipBase,
  };

  return (
    <FitShell>
      <style>{`
        @keyframes phFlowDash {
          0% { stroke-dashoffset: 30; }
          100% { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ph-flow-path, .animate-pulse { animation: none !important; }
        }
      `}</style>

      <div
        className={`flex-1 min-h-0 w-full overflow-auto rounded-2xl border ${dm ? 'border-slate-800' : 'border-slate-100'}`}
        style={{ boxShadow: cardShadow(dm), background: canvasBg }}
      >
        {/* Size by width so the diagram spans the card (no left/right letterbox). */}
        <svg
          viewBox="0 0 1920 940"
          className="block w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          style={{ background: canvasBg }}
        >
              <HeaderBand x={20} y={12} w={420} title="Steam Generation (MT)" />
              <HeaderBand x={470} y={12} w={500} title="Steam Flow (MT)" />
              <HeaderBand x={1000} y={12} w={900} title="Power Generation & Flow (kWh)" />

              {/* Steam lines — longer runs between boilers and turbines */}
              <FlowLine d="M 240 145 L 670 145" color="#EF4444" active={active.b150 && active.t30} />
              <FlowLine d="M 240 470 L 430 470" color="#EF4444" active={active.b70} />
              <FlowLine d="M 430 470 L 430 380 L 670 380" color="#EF4444" active={active.b70 && active.t3o} />
              <FlowLine d="M 430 470 L 430 560 L 670 560" color="#EF4444" active={active.b70 && active.t3n} />
              <FlowLine d="M 240 790 L 670 790" color="#EF4444" active={active.b35 && active.t4} />

              {/* Power lines — extra gap before Grid / Sugar / Distillery */}
              <FlowLine d="M 1020 145 L 1140 145" color="#1F2937" dashColor="#9CA3AF" active={active.t30} />
              <FlowLine d="M 1140 145 L 1500 145 L 1500 235 L 1610 235" color="#3B82F6" dashColor="#DBEAFE" opacity={0.55} active={active.t30 && active.grid} />
              <FlowLine d="M 1140 145 L 1140 470 L 1610 470" color="#9333EA" dashColor="#E9D5FF" opacity={0.55} active={active.t30 && active.sugar} />
              <FlowLine d="M 1020 380 L 1280 380 L 1280 470" color="#9333EA" dashColor="#E9D5FF" opacity={0.55} active={active.t3o && active.sugar} />
              <FlowLine d="M 1020 560 L 1280 560 L 1280 470" color="#9333EA" dashColor="#E9D5FF" opacity={0.55} active={active.t3n && active.sugar} />
              <FlowLine d="M 1020 790 L 1610 790" color="#22C55E" dashColor="#DCFCE7" opacity={0.55} active={active.t4 && active.dist} />

              {/* Vertical transfer */}
              <path
                d="M 1360 145 L 1360 790"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                strokeDasharray="10 10"
                className="ph-flow-path"
                style={{ animation: 'phFlowDash 1.5s linear infinite' }}
                opacity={active.t30 || active.t4 ? 0.9 : 0.35}
              />
              <polygon points="1355,785 1365,785 1360,795" fill="#3B82F6" />
              <path
                d="M 1440 145 L 1440 790"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="3"
                strokeDasharray="10 10"
                className="ph-flow-path"
                style={{ animation: 'phFlowDash 1.5s linear infinite' }}
                opacity={active.t30 || active.t4 ? 0.9 : 0.35}
              />
              <polygon points="1435,785 1445,785 1440,795" fill="#3B82F6" />

              {/* Aux loops */}
              <path d="M 1080 145 L 1080 215 L 1045 215" fill="none" stroke="#9CA3AF" strokeWidth="3" opacity={active.t30 ? 1 : 0.35} />
              <polygon points="1050,210 1050,220 1040,215" fill="#9CA3AF" />
              <path d="M 965 215 L 860 215 L 860 190" fill="none" stroke="#9CA3AF" strokeWidth="3" opacity={active.t30 ? 1 : 0.35} />
              <polygon points="855,195 865,195 860,185" fill="#9CA3AF" />
              <path d="M 1080 790 L 1080 860 L 1045 860" fill="none" stroke="#9CA3AF" strokeWidth="3" opacity={active.t4 ? 1 : 0.35} />
              <polygon points="1050,855 1050,865 1040,860" fill="#9CA3AF" />
              <path d="M 965 860 L 860 860 L 860 835" fill="none" stroke="#9CA3AF" strokeWidth="3" opacity={active.t4 ? 1 : 0.35} />
              <polygon points="855,840 865,840 860,830" fill="#9CA3AF" />

              {/* —— Boiler 150 —— */}
              <BoilerSVG x={110} y={70} />
              <LabelObj x={20} y={120} w={78} h={28} className={chip.bag}>
                {formatCompact(s.Baggase150)}
              </LabelObj>
              <text x="59" y="162" fontSize="11" fill={muted} textAnchor="middle" fontWeight="bold">
                Bagasse
              </text>
              <LabelObj x={20} y={172} w={78} h={28} className={chip.sb}>
                {s.StmtoBaggase150 != null ? formatNum(s.StmtoBaggase150, 2) : '—'}
              </LabelObj>
              <text x="59" y="214" fontSize="11" fill={muted} textAnchor="middle" fontWeight="bold">
                S/B
              </text>
              <LabelObj x={130} y={212} w={85} h={28} className={chip.name}>
                150 TPH
              </LabelObj>
              <LabelObj x={250} y={95} w={80} h={28} className={chip.steam}>
                {formatCompact(s.SteamGen150)}
              </LabelObj>

              {/* —— Boiler 70 —— */}
              <BoilerSVG x={110} y={395} />
              <LabelObj x={20} y={445} w={78} h={28} className={chip.bag}>
                {formatCompact(s.Baggase70)}
              </LabelObj>
              <text x="59" y="487" fontSize="11" fill={muted} textAnchor="middle" fontWeight="bold">
                Bagasse
              </text>
              <LabelObj x={20} y={497} w={78} h={28} className={chip.sb}>
                {s.StmtoBaggase70 != null ? formatNum(s.StmtoBaggase70, 2) : '—'}
              </LabelObj>
              <text x="59" y="539" fontSize="11" fill={muted} textAnchor="middle" fontWeight="bold">
                S/B
              </text>
              <LabelObj x={130} y={537} w={85} h={28} className={chip.name}>
                70 TPH
              </LabelObj>
              <LabelObj x={250} y={420} w={80} h={28} className={chip.steam}>
                {formatCompact(s.SteamGen70)}
              </LabelObj>

              {/* —— Boiler 35 —— */}
              <BoilerSVG x={110} y={715} />
              <LabelObj x={20} y={765} w={78} h={28} className={chip.bag}>
                {formatCompact(s.Baggase35)}
              </LabelObj>
              <text x="59" y="807" fontSize="11" fill={muted} textAnchor="middle" fontWeight="bold">
                Bagasse
              </text>
              <LabelObj x={20} y={817} w={78} h={28} className={chip.sb}>
                {s.StmtoBaggase35 != null ? formatNum(s.StmtoBaggase35, 2) : '—'}
              </LabelObj>
              <text x="59" y="859" fontSize="11" fill={muted} textAnchor="middle" fontWeight="bold">
                S/B
              </text>
              <LabelObj x={130} y={857} w={85} h={28} className={chip.name}>
                35 TPH
              </LabelObj>
              <LabelObj x={250} y={740} w={80} h={28} className={chip.steam}>
                {formatCompact(s.SteamGen35)}
              </LabelObj>

              {/* —— Turbine 30 MW —— */}
              <TurbineSVG x={760} y={95} spinning={active.t30} clipId="ph-turbine-clip-30" />
              <LabelObj x={770} y={198} w={80} h={28} className={chip.label}>
                30 MW
              </LabelObj>
              <LabelObj x={670} y={95} w={80} h={32} className={chip.orange}>
                {formatCompact(s.SteamCon30MW)}
              </LabelObj>
              <LabelObj x={670} y={135} w={80} h={28} className={chip.orangeOut}>
                {p.SpecSteam30 != null ? formatNum(p.SpecSteam30, 2) : '—'}
              </LabelObj>
              <LabelObj x={670} y={168} w={80} h={18} className={chip.spec}>
                Spec. Steam
              </LabelObj>
              <LabelObj x={980} y={128} w={88} h={28} className={chip.power}>
                {formatCompact(p.PowerGen30)}
              </LabelObj>
              <LabelObj x={985} y={200} w={75} h={28} className={chip.aux}>
                {formatCompact(p.ExportCogen30)}
              </LabelObj>
              <LabelObj x={985} y={232} w={75} h={24} className={`${chip.aux} text-xs`}>
                {formatPct(p['%Aux_cons30MW'])}
              </LabelObj>

              {/* —— Turbine 3 Old —— */}
              <TurbineSVG x={760} y={330} spinning={active.t3o} clipId="ph-turbine-clip-3o" />
              <LabelObj x={770} y={433} w={80} h={28} className={chip.label}>
                3 MW (O)
              </LabelObj>
              <LabelObj x={670} y={330} w={80} h={32} className={chip.orange}>
                {formatCompact(s.StmCons3Old70)}
              </LabelObj>
              <LabelObj x={670} y={370} w={80} h={28} className={chip.orangeOut}>
                {p.SpecSteam3Old != null ? formatNum(p.SpecSteam3Old, 2) : '—'}
              </LabelObj>
              <LabelObj x={670} y={403} w={80} h={18} className={chip.spec}>
                Spec. Steam
              </LabelObj>
              <LabelObj x={980} y={363} w={88} h={28} className={chip.power}>
                {formatCompact(p.PowerGen3Old)}
              </LabelObj>

              {/* —— Turbine 3 New —— */}
              <TurbineSVG x={760} y={510} spinning={active.t3n} clipId="ph-turbine-clip-3n" />
              <LabelObj x={770} y={613} w={80} h={28} className={chip.label}>
                3 MW (N)
              </LabelObj>
              <LabelObj x={670} y={510} w={80} h={32} className={chip.orange}>
                {formatCompact(s.StmCons3New70)}
              </LabelObj>
              <LabelObj x={670} y={550} w={80} h={28} className={chip.orangeOut}>
                {p.SpecSteam3New != null ? formatNum(p.SpecSteam3New, 2) : '—'}
              </LabelObj>
              <LabelObj x={670} y={583} w={80} h={18} className={chip.spec}>
                Spec. Steam
              </LabelObj>
              <LabelObj x={980} y={543} w={88} h={28} className={chip.power}>
                {formatCompact(p.PowerGen3New)}
              </LabelObj>

              {/* —— Turbine 4 MW —— */}
              <TurbineSVG x={760} y={740} spinning={active.t4} clipId="ph-turbine-clip-4" />
              <LabelObj x={770} y={843} w={80} h={28} className={chip.label}>
                4 MW
              </LabelObj>
              <LabelObj x={670} y={740} w={80} h={32} className={chip.orange}>
                {formatCompact(s.StmCons4)}
              </LabelObj>
              <LabelObj x={670} y={780} w={80} h={28} className={chip.orangeOut}>
                {p.SpecSteam4 != null ? formatNum(p.SpecSteam4, 2) : '—'}
              </LabelObj>
              <LabelObj x={670} y={813} w={80} h={18} className={chip.spec}>
                Spec. Steam
              </LabelObj>
              <LabelObj x={980} y={773} w={88} h={28} className={chip.power}>
                {formatCompact(p.PowerGen4MW)}
              </LabelObj>
              <LabelObj x={985} y={843} w={75} h={28} className={chip.aux}>
                {formatCompact(p.ExportCogen4)}
              </LabelObj>
              <LabelObj x={1068} y={843} w={65} h={28} className={`${chip.aux} text-xs`}>
                {formatPct(p['%Aux_Cons4MW'])}
              </LabelObj>

              {/* Transfer labels */}
              <LabelObj x={1288} y={520} w={80} h={32} className={chip.transfer}>
                {formatCompact(p.Export_Cogen)}
              </LabelObj>
              <LabelObj x={1380} y={420} w={80} h={32} className={chip.transfer}>
                {formatCompact(p.ExportDist30)}
              </LabelObj>

              {/* Consumers */}
              <GridSVG x={1720} y={170} />
              <LabelObj x={1730} y={275} w={80} h={28} className={chip.label}>
                Grid
              </LabelObj>
              <LabelObj x={1610} y={220} w={90} h={32} className={chip.grid}>
                {formatCompact(p.ExportGrid30)}
              </LabelObj>
              <LabelObj x={1675} y={175} w={100} h={28} className={chip.inr}>
                {formatInr(p.AMtGrid)}
              </LabelObj>

              <SugarSVG x={1720} y={405} />
              <LabelObj x={1720} y={520} w={100} h={28} className={chip.label}>
                Sugar Mill
              </LabelObj>
              <LabelObj x={1610} y={455} w={90} h={32} className={chip.sugar}>
                {formatCompact(p.Export_Sugar)}
              </LabelObj>
              <LabelObj x={1675} y={410} w={100} h={28} className={chip.inr}>
                {formatInr(p.AmtSugar)}
              </LabelObj>

              <DistillerySVG x={1720} y={725} />
              <LabelObj x={1720} y={830} w={100} h={28} className={chip.label}>
                Distillery
              </LabelObj>
              <LabelObj x={1625} y={775} w={75} h={32} className={chip.dist}>
                {formatCompact(p.PowerCons_Dist_CPU_4MW)}
              </LabelObj>
              <LabelObj x={1680} y={730} w={90} h={28} className={chip.inr}>
                {formatInr(p.AmtDistill)}
              </LabelObj>
        </svg>
      </div>
    </FitShell>
  );
}
