import React, { useState, useMemo, useRef, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  ComposedChart, ScatterChart, Scatter, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from "recharts";
import {
  TrendingUp, TrendingDown, Activity, Truck, MapPin, Clock,
  BarChart2, GitMerge, ArrowRightLeft, Sun, Moon, Filter, Loader2,
  Sprout, DoorOpen, Warehouse, Scale, Factory, Cog, ArrowRight, Award,
  Search, Trophy, Building2, ShieldCheck, Eye, List, LayoutGrid,
  ChevronLeft, ChevronRight, Target, CheckCircle2, AlertCircle, Package,
  AlertTriangle, FileText, Info
} from "lucide-react";
import api from "../../api/axios";
import BiDashboardHeader from "../../components/bi/BiDashboardHeader";
import BiKpiCard from "../../components/bi/BiKpiCard";
import { BiKeyMetricBox, BiFilterBarLayout } from "../../components/bi/BiLayoutElements";
import ProcurementCutToCrushScene from "../../components/bi/ProcurementCutToCrushScene";
import { formatYMD, resolveDashboardToDate } from "../../utils/distilleryBiDateRange";
import {
  applyCockpitCompareSelection,
  buildCockpitComparisonOptions,
  ensureCompareSelectionValid,
  getCockpitPresetDateRange,
  getCockpitSeasonLabels,
  resolveCockpitCompareRange,
} from "../../utils/biCockpitDateFilters";

const CENTERS = ["Aatipat","Bandholi","Chaudharia","Dhangaon","Eklauta","Fatehpur","Gursarai"];
const TRANSPORT_MODES = ["Tractor","Truck","Bullock Cart"];
const DATES = ["01-Jul","02-Jul","03-Jul","04-Jul","05-Jul","06-Jul","07-Jul","08-Jul","09-Jul","10-Jul"];
const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316"];

/** Tooltip copy for KPI / section info buttons (matched by title). */
const SECTION_INFO = {
  "Total Cane Purchased (Qtls)": "Total cane quantity (Qtls) purchased at gate from g_ctc.purchase_qtl for the selected date range.",
  "No. of Parchy": "Count of purchy slips recorded in the selected date range.",
  "Avg Parchy Size (Qtls)": "Average cane quantity per purchy (total cane ÷ number of parchies).",
  "Avg Parchy Overrun (Qtls)": "Average excess over the standard mode capacity (avg purchase qty − standard mode qty).",
  "Cane Purchased (Qtls)": "Total cane quantity (Qtls) purchased at centres from cnt_performance for the selected date range.",
  "No. of Purchy": "Count of centre purchy slips in the selected date range.",
  "Avg Parchi Size (Qtls)": "Average cane quantity per centre purchy (total cane ÷ purchy count).",
  "Trips (C to G)": "Distinct challan / trip count from centre to gate in the selected date range.",
  "Avg Parchi Overrun (Qtls)": "Average overrun vs standard mode capacity at centres (avg cane qty − standard).",
  "Total Vehicles": "Total gate vehicles across all transport modes (count of purchyno in g_ctc).",
  "Avg Yard Holding (Hrs)": "Average of mode-wise yard holding times (yard_holding_time) at gate.",
  "Max Yard Holding (Hrs)": "Highest yard holding time (Hrs) observed across modes in the selected range.",
  "Vehicles Exceeding (>8 Hrs)": "Count of vehicles whose yard holding time exceeded the 8-hour standard.",
  "Vehicles Handled": "Total vehicles / parchies handled at centres in the selected date range.",
  "Avg Holding Time (Hrs)": "Average centre holding time (holding_time_center) across transport modes.",
  "Purchase Split - Modewise": "Share of cane purchased by transport mode (donut). Values are mode-wise sums for the selected range.",
  "Cane Purchase Trend": "Daily total cane purchased (Qtls) over the selected date range.",
  "Parchi Overrun Trend (Qtls)": "Daily average parchie overrun (Qtls) by transport mode for the selected date range.",
  "Average Yard Holding Time": "Daily average yard holding time (Hrs) by transport mode from g_ctc.",
  "Vehicles Exceeding Standard Holding Time": "Daily count of vehicles with yard holding time greater than 8 hours, by mode.",
  "Top 10 Centers - Cane Purchase": "Centres with the highest total cane purchase (Qtls). Bars = cane; line = avg parchie size.",
  "Bottom 10 Centers - Cane Purchase": "Centres with the lowest total cane purchase (Qtls). Bars = cane; line = avg parchie size.",
  "Mode wise Split": "Vehicle / parchie count split by transport mode for the selected date range.",
  "Vehicle Handling Trend (Mode wise)": "Daily vehicle handling volume by transport mode at centres.",
  "Centers with Most Vehicle Handled (Top 10)": "Top 10 centres by total vehicles handled, broken down by transport mode.",
  "Centers with Least Vehicle Handled (Top 10)": "Bottom 10 centres by total vehicles handled, broken down by transport mode.",
  "Avg Holding Time at Centers - Trend": "Daily average centre holding time (Hrs) by transport mode.",
  "Vehicle vs Center Holding Time": "Scatter of centres: average holding time (Hrs) vs number of vehicles, coloured by mode.",
  "Step 1–2 · Sourcing": "Gate and centre vehicle / cane volumes by mode for the sourcing stage.",
  "Step 3 · Yard Holding": "Yard waiting metrics and vehicles exceeding standard holding time.",
  "Step 4–5 · Mill House": "Mill-side waiting and unloading metrics before crushing.",
  "Farm": "Origin of cane supply. Gate vehicles table shows direct grower arrivals by mode.",
  "CENTERS": "Purchase centres collecting cane. Shows trips, avg time, and centre holding by mode.",
  "YARD": "Factory yard queue before weighment. Avg waiting time and vehicles exceeding 8 hours.",
  "MILL PREMISE": "Mill-side waiting: donga time, cane holding, and vehicles exceeding 0.5 hours.",
  "Total Cane (Q)": "Total cane quantity (Qtls) across gate and centre procurement for the selected range.",
  "Total Trips": "Total centre-to-gate / challan trips in the selected date range.",
  "Avg Waiting Time (Hrs)": "Average yard waiting time (Hrs) across gate vehicles.",
  "Yard Dev. (>8H)": "Count of vehicles whose yard holding exceeded 8 hours.",
  "Mill Dev. (>0.5H)": "Count of vehicles whose mill/donga wait exceeded 0.5 hours.",
  "Waiting Time (Hrs)": "Average yard waiting time for vehicles before weighment.",
  "Cane Holding Time (Hrs)": "Combined cane holding time through yard and mill stages.",
  "Time at Donga (Hrs)": "Average time vehicles spend at the donga / feeder table.",
  "Truck Holding Time (H)": "Average truck holding time at centres (Hrs).",
};

function resolveSectionInfo(title, info) {
  if (info) return info;
  if (!title) return null;
  if (SECTION_INFO[title]) return SECTION_INFO[title];
  if (/QCART|QTROLLY|QTRUCK/i.test(String(title))) {
    return `Metrics for transport mode ${title} within the selected date range and filters.`;
  }
  return `Explains what “${title}” shows for the selected date range and filters.`;
}

/** Top-right info (i) button with click popover. */
const InfoTip = ({ text, dm, className = "" }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  React.useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  if (!text) return null;
  return (
    <div ref={ref} className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        aria-label="Section information"
        title="What is this?"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`w-5 h-5 rounded-full flex items-center justify-center border transition
          ${dm
            ? "border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            : "border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-700"}`}
      >
        <Info className="w-3 h-3" strokeWidth={2.5} />
      </button>
      {open && (
        <div
          role="tooltip"
          className={`absolute right-0 top-full mt-1.5 z-50 w-64 max-w-[min(16rem,80vw)] rounded-xl border p-2.5 text-[11px] leading-relaxed font-medium shadow-lg
            ${dm ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-600"}`}
        >
          {text}
        </div>
      )}
    </div>
  );
};

const procurementCards = { totalChallan:9999, truckTransit:99.9, yardWaiting:55.5, waCane:44.4, unloading:11.1, truckHolding:88.8 };
const procTableMode = [
  {mode:"Tractor",purchy:612,caneQty:30420,cutCenter:2.4},
  {mode:"Truck",purchy:534,caneQty:45800,cutCenter:3.1},
  {mode:"Bullock Cart",purchy:138,caneQty:5100,cutCenter:1.8},
];
const holdingMode = [{mode:"Tractor",h:3.2},{mode:"Truck",h:4.9},{mode:"Bullock Cart",h:1.6}];
const gate1Overruns = [
  {date:"01-Jul",o18:42,o36:28,o63:12,o99:5},{date:"02-Jul",o18:38,o36:24,o63:10,o99:3},
  {date:"03-Jul",o18:51,o36:31,o63:18,o99:7},{date:"04-Jul",o18:46,o36:27,o63:15,o99:4},
  {date:"05-Jul",o18:55,o36:35,o63:20,o99:8},{date:"06-Jul",o18:40,o36:22,o63:9,o99:2},
  {date:"07-Jul",o18:48,o36:29,o63:14,o99:6},
];
const gate1Daily = [{date:"01-Jul",qty:1111},{date:"02-Jul",qty:2222},{date:"03-Jul",qty:3333},{date:"04-Jul",qty:4444},{date:"05-Jul",qty:5555},{date:"06-Jul",qty:6666},{date:"07-Jul",qty:7777}];
const modePie = [{mode:"Tractor",qty:99999,color:"#3b82f6"},{mode:"Truck",qty:11111,color:"#10b981"},{mode:"Bullock Cart",qty:5555,color:"#f59e0b"}];
const gate2Cards = [{mode:"Tractor",mn:0.8,av:1.45,mx:3.2,dev:32},{mode:"Truck",mn:1.1,av:2.18,mx:5.6,dev:48},{mode:"Bullock Cart",mn:0.4,av:0.92,mx:2.1,dev:11}];
const gate2Trend = DATES.map((d,i)=>({date:d,Tractor:+(1.2+Math.sin(i*0.8)*0.4).toFixed(2),Truck:+(2.0+Math.sin(i*0.6)*0.7).toFixed(2),"Bullock Cart":+(0.8+Math.sin(i*1.2)*0.2).toFixed(2)}));
const gate2Dev = DATES.map((d,i)=>({date:d,Tractor:+(18+Math.sin(i)*5).toFixed(1),Truck:+(26+Math.cos(i)*8).toFixed(1)}));
const centerBuyByDate = DATES.map((d,i)=>({date:d,qty:6000+Math.round(Math.sin(i*0.7)*2000+2000)}));
const centerBuyByCenter = CENTERS.map((c,i)=>({center:c,cane:8000+i*1200,avgParchi:55+i*3}));
const vehiclePivot = CENTERS.map((c,ci)=>({center:c,Tractor:45+ci*10,Truck:30+ci*8,"Bullock Cart":5+ci*2}));
const vehicleByMode = [{mode:"Tractor",count:612},{mode:"Truck",count:534},{mode:"Bullock Cart",count:138}];
const scatterData = Array.from({length:60},(_,i)=>({purchy:Math.round(Math.random()*200+10),h:+(Math.random()*6+0.5).toFixed(2),mode:TRANSPORT_MODES[i%3]}));
const holdingByCenter = CENTERS.map((c,ci)=>({center:c,avg:+(2+ci*0.4+Math.random()*0.8).toFixed(2),purchy:100+ci*30}));
const transitData = CENTERS.map((c,ci)=>({center:c,transit:+(1.5+ci*0.3+Math.random()*0.5).toFixed(2),dist:12+ci*5,challan:80+ci*25}));
const truckHolding = CENTERS.map((c,ci)=>({center:c,holding:+(3+ci*0.5+Math.random()).toFixed(2),challan:80+ci*25}));
const dbRows = Array.from({length:20},(_,i)=>({
  purchyNo:1000+i,center:CENTERS[i%CENTERS.length],grower:`GR-${2000+i}`,
  vehicle:`MP09-${8000+i}`,caneQty:45+Math.round(Math.random()*80),challanNo:5000+i,
  mode:TRANSPORT_MODES[i%3],arrival:`07-Jul 08:${String(15+i*3).padStart(2,"0")}`,
  holding:+(2+Math.random()*4).toFixed(2),truckH:+(1+Math.random()*5).toFixed(2)
}));

const KPICard = ({label,value,unit="",icon:Icon,color="blue",darkMode,info})=>{
  const bg=darkMode?"bg-slate-900":"bg-white";
  const bdr=darkMode?"border-slate-800":"border-slate-200/80";
  const cols={blue:"text-blue-500",green:"text-emerald-500",amber:"text-amber-500",red:"text-red-500",violet:"text-violet-500"};
  const tip = resolveSectionInfo(label, info);
  return(
    <div className={`${bg} relative rounded-2xl border ${bdr} p-4 flex flex-col gap-2 transition-all duration-200 hover:-translate-y-1`}
      style={{ boxShadow: cardShadow(darkMode) }}>
      <div className="absolute top-2.5 right-2.5 z-10">
        <InfoTip text={tip} dm={darkMode} />
      </div>
      <div className="flex items-center justify-between pr-6">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${darkMode?"text-slate-400":"text-slate-500"}`}>{label}</span>
        {Icon&&<span className={`${cols[color]||cols.blue}`}><Icon className="w-4 h-4"/></span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-black tracking-tight ${darkMode?"text-slate-100":"text-slate-900"}`}>{typeof value==="number"?value.toLocaleString("en-IN"):value}</span>
        {unit&&<span className={`text-xs font-semibold ${darkMode?"text-slate-400":"text-slate-500"}`}>{unit}</span>}
      </div>
    </div>
  );
};

const ChartCard=({title,children,darkMode,className="",info})=>(
  <div className={`${darkMode?"bg-slate-900 border-slate-800":"bg-white border-slate-200/80"} relative rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 ${className}`}
    style={{ boxShadow: cardShadow(darkMode) }}>
    <div className="absolute top-2.5 right-2.5 z-10">
      <InfoTip text={resolveSectionInfo(title, info)} dm={darkMode} />
    </div>
    {title&&<p className={`text-[10px] font-bold uppercase tracking-wider mb-3 pr-6 ${darkMode?"text-slate-400":"text-slate-500"}`}>{title}</p>}
    {children}
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// Procurement process-flow visuals (Farm → Centre/Gate → Yard →
// Weighbridge → Mill House → 5 Mills)
// ═══════════════════════════════════════════════════════════════════
const FLOW_TONES = {
  emerald:{from:"#34d399",to:"#059669",line:"#10b981"},
  cyan:   {from:"#22d3ee",to:"#0891b2",line:"#06b6d4"},
  amber:  {from:"#fbbf24",to:"#d97706",line:"#f59e0b"},
  violet: {from:"#a78bfa",to:"#7c3aed",line:"#8b5cf6"},
  blue:   {from:"#60a5fa",to:"#2563eb",line:"#3b82f6"},
  rose:   {from:"#fb7185",to:"#e11d48",line:"#f43f5e"},
  slate:  {from:"#cbd5e1",to:"#94a3b8",line:"#94a3b8"},
};
const tone = (name) => {
  const t = FLOW_TONES[name] || FLOW_TONES.blue;
  return { ...t, grad: `linear-gradient(135deg, ${t.from}, ${t.to})` };
};
const cardShadow = (dm) => (dm
  ? "0 6px 14px -4px rgba(0,0,0,.55), 0 22px 48px -14px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,.05)"
  : "0 6px 14px -4px rgba(15,23,42,.12), 0 22px 48px -14px rgba(15,23,42,.28), 0 2px 6px rgba(15,23,42,.06)");

/** Tailwind twin of cardShadow for light-mode-only className usage */
const CARD_POP = "shadow-[0_6px_14px_-4px_rgba(15,23,42,.12),0_22px_48px_-14px_rgba(15,23,42,.28),0_2px_6px_rgba(15,23,42,.06)]";
const CARD_POP_DM = "shadow-[0_6px_14px_-4px_rgba(0,0,0,.55),0_22px_48px_-14px_rgba(0,0,0,.75)]";
const cardPopCls = (dm) => (dm ? CARD_POP_DM : CARD_POP);

const StageCard = ({ icon:Icon, toneName="blue", step, title, caption, stats=[], dm, width="w-[188px]", info }) => {
  const t = tone(toneName);
  const tip = resolveSectionInfo(title, info);
  return (
    <div className={`group relative ${width} shrink-0 rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-1
      ${dm ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200/70"}`}
      style={{ boxShadow: cardShadow(dm) }}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: t.grad }} />
      <span className="pointer-events-none absolute -right-9 -top-9 w-24 h-24 rounded-full blur-2xl opacity-[.16] transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: t.line }} />

      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1.5">
        {step != null && (
          <span className="w-[18px] h-[18px] rounded-full text-[9px] font-black flex items-center justify-center text-white"
            style={{ background: t.grad, boxShadow: `0 2px 8px ${t.line}66` }}>{step}</span>
        )}
        <InfoTip text={tip} dm={dm} />
      </div>

      <div className="relative p-3">
        <div className="flex items-center gap-2.5 pr-10">
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
            style={{ background: t.grad, boxShadow: `0 8px 16px -8px ${t.line}` }}>
            <Icon className="w-[19px] h-[19px]" />
          </span>
          <div className="min-w-0">
            <p className={`text-[11.5px] font-black leading-tight truncate ${dm?"text-slate-100":"text-slate-900"}`}>{title}</p>
            {caption && <p className="text-[8.5px] font-semibold text-slate-400 leading-tight truncate">{caption}</p>}
          </div>
        </div>

        {stats.length > 0 && (
          <div className="mt-3 space-y-1">
            {stats.map(s => (
              <div key={s.label}
                className={`flex items-baseline justify-between gap-2 rounded-lg px-2 py-[5px] ${dm?"bg-slate-800/70":"bg-slate-50"}`}>
                <span className="text-[8.5px] font-bold uppercase tracking-wide text-slate-400 truncate">{s.label}</span>
                <span className={`text-[12px] font-black tabular-nums shrink-0 ${dm?"text-slate-100":"text-slate-800"}`}>{s.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Straight link with cane "particles" travelling toward the next stage. */
const FlowArrow = ({ color="#3b82f6", label, w="w-16" }) => (
  <div className={`${w} shrink-0 self-center flex flex-col items-center justify-center gap-1.5 px-1`}>
    {label && (
      <span className="text-[8px] font-black uppercase tracking-wider text-center leading-tight" style={{color}}>{label}</span>
    )}
    <div className="relative w-full h-1 rounded-full" style={{ background: `linear-gradient(90deg, ${color}22, ${color}55)` }}>
      {[0,1,2].map(i => (
        <span key={i} className="cane-dot absolute top-1/2 w-[5px] h-[5px] rounded-full -translate-y-1/2"
          style={{ background: color, boxShadow: `0 0 8px ${color}`, animationDelay: `${i * 0.6}s` }} />
      ))}
    </div>
    <ArrowRight className="w-3.5 h-3.5 -mt-0.5" style={{color}} />
  </div>
);

/** Y-shaped connector: one source splits into two lanes (or two merge into one). */
const FlowBranch = ({ color="#cbd5e1", accent="#94a3b8", merge=false }) => (
  <div className="w-12 shrink-0 self-stretch py-1">
    <svg viewBox="0 0 48 120" preserveAspectRatio="none" className="w-full h-full"
      style={{ transform: merge ? "scaleX(-1)" : undefined }}>
      {["M0 60 H14 Q26 60 26 48 V42 Q26 30 38 30 H48",
        "M0 60 H14 Q26 60 26 72 V78 Q26 90 38 90 H48"].map((d, i) => (
        <g key={i}>
          <path d={d} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path className="dash-flow" d={d} fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round"
            strokeDasharray="5 13" vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </svg>
  </div>
);

/** Moving conveyor belt with cane bundles feeding the mill bank. */
const Conveyor = ({ dm, label="Conveyor" }) => (
  <div className="w-[86px] shrink-0 self-center flex flex-col items-center gap-1.5 px-1.5">
    <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">{label}</span>
    <div className="relative w-full">
      {[0,1].map(i => (
        <span key={i} className="cane-ride absolute -top-[7px] w-3.5 h-[7px] rounded-sm bg-emerald-500"
          style={{ animationDelay: `${i * 1.1}s`, boxShadow: "0 2px 6px rgba(16,185,129,.5)" }} />
      ))}
      <div className={`belt h-3.5 w-full rounded-full border shadow-inner ${dm?"border-slate-700":"border-slate-300"}`} />
    </div>
    <div className="flex w-full justify-between px-1">
      {[0,1,2].map(i => (
        <span key={i} className={`w-2.5 h-2.5 rounded-full border ${dm?"bg-slate-800 border-slate-700":"bg-white border-slate-300"}`} />
      ))}
    </div>
  </div>
);

const MillBank = ({ dm, count=5 }) => (
  <div className={`shrink-0 rounded-2xl border overflow-hidden ${dm?"bg-slate-900/90 border-slate-800":"bg-white border-slate-200/70"}`}
    style={{ boxShadow: cardShadow(dm) }}>
    <div className="flex items-center gap-1.5 px-3 py-2" style={{ background: "linear-gradient(135deg,#1e3a8a,#3b82f6)" }}>
      <Factory className="w-3.5 h-3.5 text-white/90" />
      <span className="text-[9px] font-black uppercase tracking-wider text-white">Milling Tandem</span>
    </div>
    <div className="p-2 flex flex-col gap-1.5">
      {Array.from({length:count}).map((_,i) => (
        <div key={i} className={`flex items-center gap-2 rounded-lg border pl-1.5 pr-2 py-1 transition-colors
          ${dm?"border-slate-800 bg-slate-800/50 hover:bg-slate-800":"border-slate-200/80 bg-slate-50 hover:bg-white"}`}>
          <span className="w-[18px] h-[18px] rounded-md text-[9px] font-black text-white flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#60a5fa,#2563eb)" }}>{i+1}</span>
          <Cog className="w-3.5 h-3.5 text-slate-400 spin-slow" />
          <span className={`text-[10px] font-black ${dm?"text-slate-200":"text-slate-700"}`}>Mill</span>
          <span className="pulse-dot ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
        </div>
      ))}
    </div>
  </div>
);

/** Large single-number tile used under each stage. */
const StatTile = ({ label, value, unit, dm, toneName="blue", children }) => {
  const t = tone(toneName);
  return (
    <div className={`relative rounded-xl border p-3 text-center overflow-hidden transition-transform hover:-translate-y-0.5
      ${dm?"border-slate-800 bg-slate-800/50":"border-slate-200/80 bg-white"}`}
      style={{ boxShadow: cardShadow(dm) }}>
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: t.grad }} />
      <span className="pointer-events-none absolute -right-7 -bottom-7 w-20 h-20 rounded-full blur-xl opacity-[.12]" style={{ background: t.line }} />
      <p className="relative text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="relative text-[26px] leading-none font-black tabular-nums mt-1.5 bg-clip-text text-transparent"
        style={{ backgroundImage: t.grad }}>
        {value}{unit && <span className="text-xs font-bold ml-0.5">{unit}</span>}
      </p>
      <span className="relative block">{children}</span>
    </div>
  );
};

const PanelCard = ({ icon:Icon, toneName="blue", title, caption, dm, children, info }) => {
  const t = tone(toneName);
  const tip = resolveSectionInfo(title, info);
  return (
    <div className={`rounded-2xl border overflow-visible transition-all duration-200 hover:-translate-y-0.5 ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"}`}
      style={{ boxShadow: cardShadow(dm) }}>
      <div className="relative flex items-center gap-2.5 px-3.5 py-3 pr-10">
        <span className="absolute inset-0 opacity-[.09]" style={{ background: t.grad }} />
        <span className="absolute inset-x-0 bottom-0 h-[2px]" style={{ background: t.grad }} />
        <span className="relative w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
          style={{ background: t.grad, boxShadow: `0 8px 16px -8px ${t.line}` }}>
          <Icon className="w-4 h-4" />
        </span>
        <div className="relative min-w-0">
          <p className={`text-[11.5px] font-black leading-tight ${dm?"text-slate-100":"text-slate-900"}`}>{title}</p>
          {caption && <p className="text-[9px] font-semibold text-slate-400 truncate">{caption}</p>}
        </div>
        <div className="absolute top-2.5 right-2.5 z-10">
          <InfoTip text={tip} dm={dm} />
        </div>
      </div>
      <div className="p-3.5 space-y-3.5">{children}</div>
    </div>
  );
};

/** Small colour-barred heading above a table inside a panel. */
const SubLabel = ({ color, children }) => (
  <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider mb-2" style={{color}}>
    <span className="w-1 h-3 rounded-full" style={{ background: color }} />
    {children}
  </p>
);

/** Sidebar KPI row with an icon chip, used on the Center Purchase tab. */
const SideStat = ({ icon: Icon, label, value, tint = "#2563eb", dm, children }) => (
  <div className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 border transition-all duration-200 hover:-translate-y-0.5
    ${dm ? "bg-slate-800/50 border-slate-700/80" : "bg-white border-slate-100"}`}
    style={{ boxShadow: cardShadow(dm) }}>
    <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
      style={{ background: `linear-gradient(135deg,${tint}b3,${tint})`, boxShadow: `0 8px 14px -6px ${tint}88` }}>
      <Icon className="w-4 h-4" />
    </span>
    <div className="min-w-0">
      <p className={`text-2xl font-black leading-none tabular-nums ${dm ? "text-slate-100" : "text-slate-900"}`}>{value}</p>
      <p className={`text-[10px] font-bold mt-1 ${dm ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      {children}
    </div>
  </div>
);

/** Rank badge for the top 10 lowest-time rows in holding/transit tables. */
const TopTenBadge = ({ rank, dm }) => {
  if (rank > 10) return null;
  const tones = {
    1: { bg: "linear-gradient(135deg,#fde68a 0%,#f59e0b 52%,#d97706 100%)", text: "text-slate-900", ring: "shadow-amber-500/35" },
    2: { bg: "linear-gradient(135deg,#f8fafc 0%,#cbd5e1 45%,#94a3b8 100%)", text: "text-slate-900", ring: "shadow-slate-400/35" },
    3: { bg: "linear-gradient(135deg,#fed7aa 0%,#fb923c 45%,#ea580c 100%)", text: "text-white", ring: "shadow-orange-500/35" },
    4: { bg: "linear-gradient(135deg,#bfdbfe 0%,#60a5fa 45%,#2563eb 100%)", text: "text-white", ring: "shadow-blue-500/30" },
    5: { bg: "linear-gradient(135deg,#bbf7d0 0%,#4ade80 45%,#16a34a 100%)", text: "text-slate-900", ring: "shadow-green-500/30" },
    6: { bg: "linear-gradient(135deg,#ddd6fe 0%,#a78bfa 45%,#7c3aed 100%)", text: "text-white", ring: "shadow-violet-500/30" },
    7: { bg: "linear-gradient(135deg,#fecdd3 0%,#fb7185 45%,#e11d48 100%)", text: "text-white", ring: "shadow-rose-500/30" },
    8: { bg: "linear-gradient(135deg,#a7f3d0 0%,#2dd4bf 45%,#0f766e 100%)", text: "text-white", ring: "shadow-teal-500/30" },
    9: { bg: "linear-gradient(135deg,#fde68a 0%,#facc15 45%,#ca8a04 100%)", text: "text-slate-900", ring: "shadow-yellow-500/30" },
    10: { bg: "linear-gradient(135deg,#fbcfe8 0%,#f472b6 45%,#be185d 100%)", text: "text-white", ring: "shadow-pink-500/30" },
  };
  const tone = tones[rank];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-black shrink-0 shadow-md ${tone.text} ${tone.ring}`}
      style={{ background: tone.bg }}>
      <Award className="w-2.5 h-2.5" />
      #{rank}
    </span>
  );
};

/** Gradient tone for time-value badges in holding/transit tables. */
const timeBadgeTone = (val) => {
  const x = Math.max(0, Math.min(8, n(val)));
  const p = x / 8;
  const hue = Math.round(145 - (p * 145)); // green -> red
  const midHue = Math.max(0, hue - 12);
  const endHue = Math.max(0, hue - 20);
  const start = `hsl(${hue} 82% 76%)`;
  const mid = `hsl(${midHue} 84% 58%)`;
  const end = `hsl(${endHue} 78% 40%)`;
  const text = hue >= 42 && hue <= 78 ? "text-slate-900" : "text-white";
  const shadow = `0 8px 16px -10px hsla(${midHue},84%,50%,.9)`;
  return {
    text,
    bg: `linear-gradient(135deg,${start} 0%,${mid} 46%,${end} 100%)`,
    shadow,
  };
};

// ═══════════════════════════════════════════════════════════════════
// Logistics Command Center UI (Vehicle Holding 2 / Transit / Holding)
// ═══════════════════════════════════════════════════════════════════
const LOGISTICS_CFG = {
  centers: {
    entityLabel: "Hub Center",
    timeLabel: "Turnaround Duration",
    volumeLabel: "Volume (Vehicles)",
    volumeUnit: "vehicles",
    kpi1: "Total Active Centers",
    kpi1Suffix: "Hubs",
    kpi2: "Avg Turnaround Time",
    kpi3: "Total Fleet Processed",
    leaderboardTitle: "Fastest Operational Hubs",
    leaderboardSub: "Top performers by duration",
    searchPh: "Search hub / center name…",
    entityNoun: "Hubs",
    Icon: Building2,
    fastThreshold: 2.0,
    defaultSla: 3.0,
    slaMin: 1.5,
    slaMax: 5.0,
    slaStep: 0.1,
    maxScale: 6.0,
  },
  transit: {
    entityLabel: "Transporter",
    timeLabel: "Transit Time",
    volumeLabel: "Challan Qty (Qtls)",
    volumeUnit: "Qtls",
    kpi1: "Total Transporters",
    kpi1Suffix: "Fleets",
    kpi2: "Avg Transit Duration",
    kpi3: "Total Challan Volume",
    leaderboardTitle: "Fastest Transit Transporters",
    leaderboardSub: "Top transporters by speed",
    searchPh: "Search transporter name…",
    entityNoun: "Transporters",
    Icon: MapPin,
    fastThreshold: 2.0,
    defaultSla: 3.0,
    slaMin: 1.5,
    slaMax: 6.0,
    slaStep: 0.1,
    maxScale: 7.0,
  },
  holding: {
    entityLabel: "Holding Yard / Center",
    timeLabel: "Holding Duration",
    volumeLabel: "Challan Qty (Qtls)",
    volumeUnit: "Qtls",
    kpi1: "Active Holding Yards",
    kpi1Suffix: "Yards",
    kpi2: "Avg Truck Holding Time",
    kpi3: "Total Volume On Hold",
    leaderboardTitle: "Fastest Yard Turnaround",
    leaderboardSub: "Lowest truck dwell time",
    searchPh: "Search holding center…",
    entityNoun: "Yards",
    Icon: Warehouse,
    fastThreshold: 0.35,
    defaultSla: 0.5,
    slaMin: 0.2,
    slaMax: 1.2,
    slaStep: 0.05,
    maxScale: 1.5,
  },
};

const LogisticsTimeBadge = ({ time, sla, fast, dm }) => {
  const t = n(time);
  if (t < fast) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border
        ${dm ? "bg-emerald-950/60 text-emerald-300 border-emerald-800" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
        {fmt(t)} h
      </span>
    );
  }
  if (t <= sla) {
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border
        ${dm ? "bg-amber-950/60 text-amber-300 border-amber-800" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5" />
        {fmt(t)} h
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border
      ${dm ? "bg-rose-950/60 text-rose-300 border-rose-800" : "bg-rose-50 text-rose-700 border-rose-200"}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5" />
      {fmt(t)} h
    </span>
  );
};

const LogisticsSlaBar = ({ time, sla, fast, maxScale, dm }) => {
  const t = n(time);
  const pct = Math.min(Math.round((t / maxScale) * 100), 100);
  const color = t > sla ? "bg-rose-500" : t >= fast ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="w-full max-w-[130px]">
      <div className={`flex justify-between text-[9px] mb-1 ${dm ? "text-slate-500" : "text-slate-400"}`}>
        <span>0h</span>
        <span>{fmt(t)}h</span>
      </div>
      <div className={`w-full h-1.5 rounded-full overflow-hidden ${dm ? "bg-slate-800" : "bg-slate-100"}`}>
        <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const LogisticsRank = ({ rank }) => {
  if (rank === 1) return <span className="w-6 h-6 rounded-lg bg-amber-500 text-white font-black text-[11px] flex items-center justify-center shadow-sm">1</span>;
  if (rank === 2) return <span className="w-6 h-6 rounded-lg bg-slate-400 text-white font-black text-[11px] flex items-center justify-center shadow-sm">2</span>;
  if (rank === 3) return <span className="w-6 h-6 rounded-lg bg-amber-700 text-white font-black text-[11px] flex items-center justify-center shadow-sm">3</span>;
  return <span className="text-[11px] font-bold text-slate-400 pl-1">#{rank}</span>;
};

/** Shared Logistics Command panel for the three SLA tabs. rows: [{name,time,volume}] */
const LogisticsCommandPanel = ({ mode = "centers", rows = [], dm = false }) => {
  const cfg = LOGISTICS_CFG[mode] || LOGISTICS_CFG.centers;
  const [sla, setSla] = useState(cfg.defaultSla);
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("table");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortKey, setSortKey] = useState("time");
  const [sortAsc, setSortAsc] = useState(true);
  const [drawer, setDrawer] = useState(null);

  React.useEffect(() => {
    setSla(cfg.defaultSla);
    setFilter("all");
    setQ("");
    setPage(1);
    setSortKey("time");
    setSortAsc(true);
    setDrawer(null);
  }, [mode, cfg.defaultSla]);

  const ranked = useMemo(() => {
    return [...rows]
      .map((r) => ({ name: r.name || r.c || "—", time: n(r.time ?? r.t), volume: n(r.volume ?? r.v) }))
      .filter((r) => r.name)
      .sort((a, b) => a.time - b.time)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows]);

  const filtered = useMemo(() => {
    let data = ranked;
    const query = q.trim().toLowerCase();
    if (query) data = data.filter((r) => r.name.toLowerCase().includes(query));
    if (filter === "fast") data = data.filter((r) => r.time < cfg.fastThreshold);
    else if (filter === "compliant") data = data.filter((r) => r.time <= sla);
    else if (filter === "breach") data = data.filter((r) => r.time > sla);
    data = [...data].sort((a, b) => (sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]));
    return data;
  }, [ranked, q, filter, sla, cfg.fastThreshold, sortKey, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  const kpis = useMemo(() => {
    const total = ranked.length;
    const avg = total ? ranked.reduce((s, r) => s + r.time, 0) / total : 0;
    const vol = ranked.reduce((s, r) => s + r.volume, 0);
    const compliant = ranked.filter((r) => r.time <= sla).length;
    const breach = ranked.filter((r) => r.time > sla).length;
    const fast = ranked.filter((r) => r.time < cfg.fastThreshold).length;
    return {
      total, avg, vol, compliant, breach, fast,
      compliancePct: total ? ((compliant / total) * 100) : 0,
    };
  }, [ranked, sla, cfg.fastThreshold]);

  const top3 = ranked.slice(0, 3);
  const EntityIcon = cfg.Icon;

  const toggleSort = (key) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
    setPage(1);
  };

  const cardCls = dm
    ? "bg-slate-900 border-slate-800"
    : "bg-white border-slate-200/80";

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className={`relative p-4 rounded-2xl border ${cardPopCls(dm)} ${cardCls}`}>
          <div className="absolute top-2.5 right-2.5 z-10">
            <InfoTip text={resolveSectionInfo(cfg.kpi1, `Number of ${cfg.entityLabel || "entities"} in the ranked list for the selected filters.`)} dm={dm} />
          </div>
          <div className="flex items-center justify-between pr-6">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${dm ? "text-slate-400" : "text-slate-500"}`}>{cfg.kpi1}</p>
              <p className={`text-2xl font-black mt-1 ${dm ? "text-white" : "text-slate-900"}`}>
                {kpis.total.toLocaleString("en-IN")}{" "}
                <span className="text-[10px] font-semibold text-slate-400">{cfg.kpi1Suffix}</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 flex items-center justify-center">
              <EntityIcon className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Live telemetry
          </p>
        </div>

        <div className={`relative p-4 rounded-2xl border ${cardPopCls(dm)} ${cardCls}`}>
          <div className="absolute top-2.5 right-2.5 z-10">
            <InfoTip text={resolveSectionInfo(cfg.kpi2, "Average time (hrs) across all entities in this view. Lower is better.")} dm={dm} />
          </div>
          <div className="flex items-center justify-between pr-6">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${dm ? "text-slate-400" : "text-slate-500"}`}>{cfg.kpi2}</p>
              <p className={`text-2xl font-black mt-1 ${dm ? "text-white" : "text-slate-900"}`}>
                {fmt(kpis.avg)} <span className="text-sm font-semibold text-slate-400">hrs</span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-slate-500">Lowest-first ranking</p>
        </div>

        <div className={`relative p-4 rounded-2xl border ${cardPopCls(dm)} ${cardCls}`}>
          <div className="absolute top-2.5 right-2.5 z-10">
            <InfoTip text={resolveSectionInfo(cfg.kpi3, "Total volume associated with entities in this view (vehicles / challan qty depending on tab).")} dm={dm} />
          </div>
          <div className="flex items-center justify-between pr-6">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${dm ? "text-slate-400" : "text-slate-500"}`}>{cfg.kpi3}</p>
              <p className={`text-2xl font-black mt-1 ${dm ? "text-white" : "text-slate-900"}`}>
                {kpis.vol.toLocaleString("en-IN")}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{cfg.volumeUnit}</p>
        </div>

        <div className={`relative p-4 rounded-2xl border ${cardPopCls(dm)} ${cardCls}`}>
          <div className="absolute top-2.5 right-2.5 z-10">
            <InfoTip text="Share of entities whose time is within the SLA target. Breach count is shown below." dm={dm} />
          </div>
          <div className="flex items-center justify-between pr-6">
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${dm ? "text-slate-400" : "text-slate-500"}`}>SLA Target Compliance</p>
              <p className={`text-2xl font-black mt-1 ${dm ? "text-white" : "text-slate-900"}`}>
                {kpis.compliancePct.toFixed(1)}%
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <p className="mt-2 text-[10px] font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            {kpis.breach} {cfg.entityNoun} exceeding SLA
          </p>
        </div>
      </div>

      {/* SLA slider + leaderboard */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${dm ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
          <Target className="w-3.5 h-3.5 text-indigo-500" />
          <span className={`text-[11px] font-semibold ${dm ? "text-slate-300" : "text-slate-600"}`}>SLA Target</span>
          <input
            type="range"
            min={cfg.slaMin}
            max={cfg.slaMax}
            step={cfg.slaStep}
            value={sla}
            onChange={(e) => { setSla(Number(e.target.value)); setPage(1); }}
            className="w-28 accent-indigo-600 cursor-pointer"
          />
          <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
            {sla.toFixed(2)} hrs
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500"><Trophy className="w-4 h-4" /></span>
          <div>
            <p className={`text-xs font-black uppercase tracking-wider ${dm ? "text-white" : "text-slate-900"}`}>{cfg.leaderboardTitle}</p>
            <p className="text-[10px] text-slate-500">{cfg.leaderboardSub}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {top3.map((item, idx) => {
          const medals = [
            "from-amber-500/10 border-amber-300/80 dark:border-amber-500/30",
            "from-slate-300/15 border-slate-300/80 dark:border-slate-700",
            "from-amber-700/10 border-amber-800/20 dark:border-amber-700/30",
          ];
          const badge = [
            "from-amber-500 to-yellow-400",
            "from-slate-500 to-slate-400",
            "from-amber-700 to-amber-600",
          ];
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => setDrawer(item)}
              className={`text-left relative overflow-hidden bg-gradient-to-br ${medals[idx]} to-transparent border rounded-2xl p-4 hover:-translate-y-1 transition-all duration-200 ${dm ? "via-slate-900" : "via-white"}`}
              style={{ boxShadow: cardShadow(dm) }}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-2xl bg-gradient-to-tr ${badge[idx]} text-white font-black flex items-center justify-center shadow-lg text-sm shrink-0`}>
                    #{idx + 1}
                  </div>
                  <div className="min-w-0">
                    <h3 className={`font-bold truncate ${dm ? "text-white" : "text-slate-900"}`}>{item.name}</h3>
                    <p className="text-[10px] text-slate-500">{item.volume.toLocaleString("en-IN")} {cfg.volumeUnit}</p>
                  </div>
                </div>
                <span className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-700">
                  ⚡ {fmt(item.time)} hrs
                </span>
              </div>
            </button>
          );
        })}
        {!top3.length && (
          <div className={`md:col-span-3 text-center py-8 text-sm ${dm ? "text-slate-500" : "text-slate-400"}`}>No data for selected range</div>
        )}
      </div>

      {/* Toolbar + table/grid */}
      <div className={`rounded-2xl border ${cardPopCls(dm)} overflow-hidden ${cardCls}`}>
        <div className={`p-3 sm:p-4 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3 ${dm ? "border-slate-800" : "border-slate-100"}`}>
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder={cfg.searchPh}
              className={`w-full pl-9 pr-3 py-2 rounded-xl text-sm border outline-none focus:ring-2 focus:ring-indigo-500
                ${dm ? "bg-slate-800 border-slate-700 text-white" : "bg-slate-50 border-slate-200 text-slate-800"}`}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className={`flex items-center gap-0.5 p-1 rounded-xl ${dm ? "bg-slate-800" : "bg-slate-100"}`}>
              {[
                { id: "all", label: `All (${kpis.total})` },
                { id: "fast", label: `⚡ < ${cfg.fastThreshold}h (${kpis.fast})` },
                { id: "compliant", label: `🟢 Target (${kpis.compliant})` },
                { id: "breach", label: `🟠 Breach (${kpis.breach})` },
              ].map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setFilter(b.id); setPage(1); }}
                  className={`px-2.5 py-1.5 text-[10px] font-bold rounded-lg transition whitespace-nowrap
                    ${filter === b.id
                      ? (dm ? "bg-slate-700 text-white shadow-sm" : "bg-white text-slate-900 shadow-sm")
                      : (dm ? "text-slate-400 hover:text-white" : "text-slate-600 hover:text-slate-900")}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
            <div className={`flex items-center p-1 rounded-xl ${dm ? "bg-slate-800" : "bg-slate-100"}`}>
              <button type="button" onClick={() => setView("table")}
                className={`p-1.5 rounded-lg transition ${view === "table" ? (dm ? "bg-slate-700 text-white" : "bg-white text-slate-900 shadow-sm") : "text-slate-500"}`}>
                <List className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => setView("grid")}
                className={`p-1.5 rounded-lg transition ${view === "grid" ? (dm ? "bg-slate-700 text-white" : "bg-white text-slate-900 shadow-sm") : "text-slate-500"}`}>
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {view === "table" ? (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className={`text-[10px] font-black uppercase tracking-wider border-b
                  ${dm ? "bg-slate-800/90 text-slate-400 border-slate-800" : "bg-slate-50/95 text-slate-500 border-slate-200"}`}>
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">{cfg.entityLabel}</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 cursor-pointer select-none" onClick={() => toggleSort("time")}>
                    <span className="inline-flex items-center gap-1">{cfg.timeLabel}</span>
                  </th>
                  <th className="py-3 px-4">SLA Meter</th>
                  <th className="py-3 px-4 text-right cursor-pointer select-none" onClick={() => toggleSort("volume")}>
                    {cfg.volumeLabel}
                  </th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className={`divide-y text-[12px] ${dm ? "divide-slate-800 text-slate-300" : "divide-slate-100 text-slate-700"}`}>
                {!pageRows.length ? (
                  <tr><td colSpan={7} className="text-center py-12 text-slate-400">No records matching filters</td></tr>
                ) : pageRows.map((item) => (
                  <tr key={`${item.rank}-${item.name}`}
                    className={`transition cursor-pointer ${dm ? "hover:bg-slate-800/50" : "hover:bg-slate-50/80"}`}
                    onClick={() => setDrawer(item)}>
                    <td className="py-3 px-4"><LogisticsRank rank={item.rank} /></td>
                    <td className="py-3 px-4">
                      <div className={`font-bold ${dm ? "text-white" : "text-slate-900"}`}>{item.name}</div>
                      <div className="text-[10px] text-slate-400">#{item.rank}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <LogisticsTimeBadge time={item.time} sla={sla} fast={cfg.fastThreshold} dm={dm} />
                    </td>
                    <td className={`py-3 px-4 font-semibold ${dm ? "text-slate-200" : "text-slate-800"}`}>{fmt(item.time)} hrs</td>
                    <td className="py-3 px-4">
                      <LogisticsSlaBar time={item.time} sla={sla} fast={cfg.fastThreshold} maxScale={cfg.maxScale} dm={dm} />
                    </td>
                    <td className={`py-3 px-4 text-right font-bold ${dm ? "text-slate-200" : "text-slate-800"}`}>
                      {item.volume.toLocaleString("en-IN")}{" "}
                      <span className="text-[10px] font-normal text-slate-400">{cfg.volumeUnit}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50">
                        <Eye className="w-4 h-4" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto">
            {!pageRows.length ? (
              <div className="col-span-full text-center py-12 text-slate-400">No records matching filters</div>
            ) : pageRows.map((item) => (
              <button
                key={`${item.rank}-${item.name}`}
                type="button"
                onClick={() => setDrawer(item)}
                className={`text-left p-4 rounded-2xl border transition hover:shadow-md
                  ${dm ? "border-slate-800 bg-slate-900/60 hover:bg-slate-800/60" : "border-slate-200 bg-white hover:bg-slate-50"}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <LogisticsRank rank={item.rank} />
                  <LogisticsTimeBadge time={item.time} sla={sla} fast={cfg.fastThreshold} dm={dm} />
                </div>
                <h3 className={`font-bold text-sm ${dm ? "text-white" : "text-slate-900"}`}>{item.name}</h3>
                <div className={`mt-3 pt-2 border-t flex items-center justify-between text-[11px] ${dm ? "border-slate-800" : "border-slate-100"}`}>
                  <span className="text-slate-500">{cfg.volumeLabel}</span>
                  <span className={`font-bold ${dm ? "text-white" : "text-slate-900"}`}>{item.volume.toLocaleString("en-IN")}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className={`p-3 border-t flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] ${dm ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className={`rounded-lg px-2 py-1 border ${dm ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}
            >
              {[12, 25, 50, 100].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>
              Showing {filtered.length ? (pageSafe - 1) * pageSize + 1 : 0}
              –{Math.min(pageSafe * pageSize, filtered.length)} of {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className={`px-2.5 py-1.5 rounded-lg border disabled:opacity-40 ${dm ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className={`font-semibold ${dm ? "text-slate-200" : "text-slate-700"}`}>Page {pageSafe} / {totalPages}</span>
            <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className={`px-2.5 py-1.5 rounded-lg border disabled:opacity-40 ${dm ? "border-slate-700 bg-slate-800" : "border-slate-200 bg-white"}`}>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button type="button" aria-label="Close drawer" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setDrawer(null)} />
          <div className={`relative w-full max-w-md h-full border-l shadow-2xl flex flex-col ${dm ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
            <div className={`p-5 border-b flex items-start justify-between ${dm ? "border-slate-800 bg-slate-800/40" : "border-slate-100 bg-slate-50/60"}`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">#{drawer.rank}</span>
                  <h2 className={`text-lg font-black ${dm ? "text-white" : "text-slate-900"}`}>{drawer.name}</h2>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{cfg.entityLabel} detail</p>
              </div>
              <button type="button" onClick={() => setDrawer(null)} className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
            </div>
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-4 rounded-xl border ${dm ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
                  <p className="text-[10px] text-slate-500">{cfg.timeLabel}</p>
                  <p className={`text-xl font-black mt-1 ${dm ? "text-white" : "text-slate-900"}`}>{fmt(drawer.time)} hrs</p>
                </div>
                <div className={`p-4 rounded-xl border ${dm ? "bg-slate-800/50 border-slate-800" : "bg-slate-50 border-slate-100"}`}>
                  <p className="text-[10px] text-slate-500">{cfg.volumeLabel}</p>
                  <p className={`text-xl font-black mt-1 ${dm ? "text-white" : "text-slate-900"}`}>{drawer.volume.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">SLA status</p>
                <LogisticsTimeBadge time={drawer.time} sla={sla} fast={cfg.fastThreshold} dm={dm} />
                <div className="mt-3">
                  <LogisticsSlaBar time={drawer.time} sla={sla} fast={cfg.fastThreshold} maxScale={cfg.maxScale} dm={dm} />
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Target ≤ {sla.toFixed(2)} hrs · {drawer.time <= sla ? "Within SLA" : "SLA breach"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Soft per-mode yard-holding card — Gate 2 (matches Gate 1 visual language). */
const Gate2ModeCard = ({ title, color = "#3b82f6", iconBg = "#dbeafe", rows = [], dm, info }) => {
  const tip = resolveSectionInfo(title, info || `Yard holding metrics for ${title}: vehicle count, min/avg/max holding (Hrs), and vehicles exceeding the 8-hour standard.`);
  return (
  <div className={`relative rounded-2xl border flex flex-col transition-all duration-200 hover:-translate-y-1
    ${dm ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
    style={{ boxShadow: cardShadow(dm) }}>
    <div className="absolute top-2.5 right-2.5 z-10">
      <InfoTip text={tip} dm={dm} />
    </div>
    <div className="px-3.5 pt-3.5 pb-2 flex items-center gap-2.5 pr-9">
      <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: iconBg, boxShadow: `0 8px 16px -6px ${color}55` }}>
        <Truck className="w-4 h-4" style={{ color }} />
      </span>
      <p className={`text-[13px] font-bold truncate ${dm ? "text-slate-100" : "text-[#1e3a5f]"}`}>{title}</p>
    </div>
    <div className="flex-1 px-3 pb-3 flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <div key={i} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 ${dm ? "bg-slate-800/60" : "bg-slate-50"}`}>
          <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: color }} />
          <div className="min-w-0">
            <p className="text-base font-black leading-none tabular-nums" style={{ color }}>{r.value}</p>
            <p className={`text-[9px] font-bold mt-1 leading-tight ${dm ? "text-slate-400" : "text-slate-500"}`}>{r.label}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// High-contrast donut for mode-wise splits
// ═══════════════════════════════════════════════════════════════════
const donutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (!percent || percent < 0.045) return null;
  const RAD = Math.PI / 180;
  const r = innerRadius + (outerRadius - innerRadius) * 0.52;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text x={x} y={y} fill="#ffffff" textAnchor="middle" dominantBaseline="central"
      style={{ fontSize: 12, fontWeight: 900, paintOrder: "stroke", stroke: "rgba(15,23,42,.35)", strokeWidth: 3 }}>
      {(percent * 100).toFixed(1)}%
    </text>
  );
};

const Gate1KpiCard = ({ title, value, delta, lowerBetter = false, icon: Icon, iconBg, iconColor, dm, info }) => {
  const hasDelta = delta != null && Number.isFinite(delta);
  const mockValue = 100;
  const mockPyValue = hasDelta ? 100 / (1 + delta / 100) : 0;
  
  return (
    <BiKpiCard
      title={title}
      displayValue={value}
      value={mockValue}
      pyValue={mockPyValue}
      isDarkMode={dm}
      comparisonLabel="vs last period"
      inverseColor={lowerBetter}
      definition={resolveSectionInfo(title, info)}
    />
  );
};

/** Soft white chart panel (no gradient header) */
const Gate1Panel = ({ title, subtitle, children, dm, className = "", bodyClassName = "", accent = false, info }) => {
  const tip = resolveSectionInfo(title, info);
  return (
  <div className={`rounded-2xl border flex flex-col transition-all duration-200 hover:-translate-y-0.5 overflow-visible
    ${dm ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"} ${className}`}
    style={{ boxShadow: cardShadow(dm) }}>
    {(title || subtitle || tip) && (
      <div className="px-4 pt-3.5 pb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {title && <p className={`text-[13px] font-bold ${dm ? "text-slate-100" : "text-[#1e3a5f]"}`}>{title}</p>}
          {accent && <div className="mt-1.5 h-[3px] w-14 rounded-full bg-[#f97316]" />}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {subtitle && <p className={`text-[10px] font-medium ${dm ? "text-slate-500" : "text-slate-400"}`}>{subtitle}</p>}
          <InfoTip text={tip} dm={dm} />
        </div>
      </div>
    )}
    <div className={`flex-1 min-h-0 ${bodyClassName}`}>{children}</div>
  </div>
  );
};

const GATE1_MODE_COLORS = {
  "18 QCART": "#14b8a6",
  "36 QTROLLY": "#3b82f6",
  "45 QTROLLY": "#6366f1",
  "63 QTROLLY": "#f97316",
  "99 QTROLLY": "#8b5cf6",
  "99 QTRUCK": "#8b5cf6",
};
const gate1ModeColor = (m) => GATE1_MODE_COLORS[m] || COLORS[0];

const GATE1_RAD = Math.PI / 180;

/** Short display names for purchase-split callouts (matches design labels). */
const shortModeLabel = (name) => {
  const s = String(name || "").toUpperCase();
  if (s.includes("99")) return "99";
  if (s.includes("18") || s.includes("CART")) return "Q CART";
  if (s.includes("36")) return "QTROL";
  if (s.includes("45")) return "45";
  if (s.includes("63") || s.includes("TROLL")) return "OLLY";
  return String(name || "").split(/\s+/).slice(-1)[0] || name;
};

/** Pure-SVG callout (no foreignObject) so labels stay visible. */
const gate1DonutCalloutLabel = (dm) => (props) => {
  const { cx, cy, midAngle, outerRadius, percent, value, payload } = props;
  if (!percent || percent < 0.005) return null;
  const color = payload?.color || "#64748b";
  const name = shortModeLabel(payload?.name);
  const cos = Math.cos(-midAngle * GATE1_RAD);
  const sin = Math.sin(-midAngle * GATE1_RAD);
  const isRight = cos >= 0;
  const sx = cx + (outerRadius + 4) * cos;
  const sy = cy + (outerRadius + 4) * sin;
  const ex = cx + (outerRadius + 28) * cos;
  const ey = cy + (outerRadius + 28) * sin;
  const iconR = 12;
  const iconCx = isRight ? ex + iconR + 4 : ex - iconR - 4;
  const iconCy = ey;
  const textAnchor = isRight ? "start" : "end";
  const tx = isRight ? iconCx + iconR + 6 : iconCx - iconR - 6;
  const nameFill = dm ? "#e2e8f0" : "#0f172a";
  const pctFill = dm ? "#94a3b8" : "#94a3b8";
  return (
    <g style={{ pointerEvents: "none" }}>
      <line
        x1={sx} y1={sy} x2={ex} y2={ey}
        stroke={color} strokeWidth={1.5} strokeDasharray="2.5 3.5" strokeLinecap="round"
      />
      <circle cx={sx} cy={sy} r={2.5} fill={color} />
      <circle cx={iconCx} cy={iconCy} r={iconR} fill={color} />
      {/* simple truck glyph */}
      <g transform={`translate(${iconCx - 7}, ${iconCy - 7})`} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1 9V3.5A1.5 1.5 0 0 1 2.5 2H8v7" />
        <path d="M8 5h3.2L13 7.5V9H8" />
        <circle cx="3.5" cy="10.5" r="1.3" fill="#fff" stroke="none" />
        <circle cx="10.5" cy="10.5" r="1.3" fill="#fff" stroke="none" />
      </g>
      <text x={tx} y={iconCy - 10} textAnchor={textAnchor} fill={nameFill} fontSize="11" fontWeight="800">
        {name}
      </text>
      <text x={tx} y={iconCy + 3} textAnchor={textAnchor} fill={color} fontSize="12" fontWeight="800">
        {compact(value)}
      </text>
      <text x={tx} y={iconCy + 16} textAnchor={textAnchor} fill={pctFill} fontSize="10" fontWeight="600">
        {(percent * 100).toFixed(1)}%
      </text>
    </g>
  );
};

/** Donut with outside callout labels — Gate 1 purchase split */
const Gate1ModeDonut = ({ data = [], dm, centerUnit = "Qtls" }) => {
  const rows = data.filter((d) => n(d.value) > 0);
  const total = rows.reduce((a, b) => a + n(b.value), 0);
  return (
    <div className="relative flex items-center justify-center h-full min-h-[400px] px-1 pb-2 pt-0 overflow-visible">
      <div className="relative w-full h-full min-h-[380px] max-w-[560px] overflow-visible">
        <ResponsiveContainer width="100%" height="100%" minHeight={380}>
          <PieChart margin={{ top: 52, right: 78, bottom: 52, left: 78 }}>
            <defs>
              {rows.map((e, i) => (
                <linearGradient key={`pg${i}`} id={`gate1PieGrad${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={e.color} stopOpacity={1} />
                  <stop offset="100%" stopColor={e.color} stopOpacity={0.75} />
                </linearGradient>
              ))}
            </defs>
            <Pie
              data={rows}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="46%"
              outerRadius="72%"
              paddingAngle={2}
              cornerRadius={8}
              stroke="none"
              strokeWidth={0}
              label={gate1DonutCalloutLabel(dm)}
              labelLine={false}
              isAnimationActive={false}
            >
              {rows.map((e, i) => <Cell key={i} fill={`url(#gate1PieGrad${i})`} />)}
            </Pie>
            <Tooltip
              formatter={(v, nm) => [`${n(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })} ${centerUnit}`, nm]}
              {...TT(dm)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-[22px] font-black leading-none tracking-tight ${dm ? "text-slate-50" : "text-[#1e3a5f]"}`}>
            {compact(total)}
          </span>
          <span className={`text-[11px] font-semibold mt-1.5 ${dm ? "text-slate-400" : "text-slate-500"}`}>
            Total Purchase
          </span>
          <span className={`text-[10px] font-medium mt-0.5 ${dm ? "text-slate-500" : "text-slate-400"}`}>
            ({centerUnit})
          </span>
        </div>
      </div>
    </div>
  );
};

/** data: [{ name, value, color }] */
const ModeDonut = ({ data = [], dm, height = 230, unit = "Qtls", title }) => {
  const rows = data.filter(d => n(d.value) > 0);
  const total = rows.reduce((a, b) => a + n(b.value), 0);
  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="relative flex-1 min-h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie data={rows} dataKey="value" nameKey="name" cx="50%" cy="50%"
              innerRadius="54%" outerRadius="88%" paddingAngle={2} cornerRadius={5}
              stroke={dm ? "#0f172a" : "#ffffff"} strokeWidth={3}
              labelLine={false} label={donutLabel}>
              {rows.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip
              formatter={(v, nm) => [`${n(v).toLocaleString("en-IN", {maximumFractionDigits:0})} ${unit}`, nm]}
              {...TT(dm)} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-400">{title || "Total"}</span>
          <span className={`text-xl font-black leading-tight ${dm ? "text-slate-100" : "text-slate-900"}`}>{compact(total)}</span>
          <span className="text-[8.5px] font-bold text-slate-400">{unit}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 px-3 pb-2.5 pt-1">
        {rows.map(d => (
          <div key={d.name} className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: d.color }} />
            <span className={`text-[9.5px] font-bold truncate ${dm ? "text-slate-300" : "text-slate-600"}`}>{d.name}</span>
            <span className={`ml-auto text-[9.5px] font-black tabular-nums shrink-0 ${dm ? "text-slate-100" : "text-slate-800"}`}>
              {total ? ((n(d.value) / total) * 100).toFixed(1) : "0.0"}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const T=(dm)=>({fill:dm?"#94a3b8":"#64748b",fontSize:10});
const G=(dm)=>dm?"#1e293b":"#f1f5f9";
const TT=(dm)=>({
  contentStyle:{
    background:dm?"rgba(15,23,42,.96)":"rgba(255,255,255,.98)",
    border:`1px solid ${dm?"#334155":"#e2e8f0"}`,
    borderRadius:12,
    fontSize:11,
    fontWeight:600,
    padding:"8px 10px",
    boxShadow:"0 16px 32px -12px rgba(15,23,42,.35)",
  },
  labelStyle:{color:dm?"#e2e8f0":"#0f172a",fontWeight:800,marginBottom:2},
  itemStyle:{padding:0},
});

/** MySQL returns DECIMAL as strings — always coerce before math/.toFixed */
const n = (v) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
const fmt = (v, digits = 2) => n(v).toFixed(digits);

/** Short Indian-style number for flow tiles: 12,345 → 12.3K, 9,86,557 → 9.87 L */
const compact = (v) => {
  const x = n(v);
  if (x >= 1e7) return (x / 1e7).toFixed(2) + " Cr";
  if (x >= 1e5) return (x / 1e5).toFixed(2) + " L";
  if (x >= 1e3) return (x / 1e3).toFixed(1) + "K";
  return x.toLocaleString("en-IN");
};

function pctChange(curr, prior) {
  const c = n(curr);
  const p = n(prior);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}

/** % vs previous year — green when change is “good” for the metric. */
const PyBadge = ({ curr, prior, lowerBetter = false, dm = false, label = "vs PY" }) => {
  const delta = pctChange(curr, prior);
  if (delta == null) return null;
  const isUp = delta > 0.05;
  const isDown = delta < -0.05;
  const isGood = lowerBetter ? isDown : isUp;
  const isBad = lowerBetter ? isUp : isDown;
  const cls = isGood
    ? dm ? "bg-emerald-500/20 text-emerald-400" : "bg-emerald-100 text-emerald-700"
    : isBad
      ? dm ? "bg-rose-500/20 text-rose-400" : "bg-rose-100 text-rose-700"
      : dm ? "bg-slate-700 text-slate-300" : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex items-center gap-0.5 mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold tabular-nums ${cls}`} title={`Prior year: ${fmt(prior)}`}>
      {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : isDown ? <TrendingDown className="w-2.5 h-2.5" /> : null}
      {Math.abs(delta).toFixed(1)}% {label}
    </span>
  );
};

function overrunMap(list) {
  const m = {};
  (list || []).forEach((o) => { if (o?.mode) m[o.mode] = n(o.avgOverrun); });
  return m;
}

const NUM_KEYS = new Set([
  "purchy","caneQty","qty","totalChallan","yardWaiting","waCane","truckTransit","truckHolding","caneHolding",
  "totalCanePurchased","noOfPurchy","avgPurchySize","avgOverrun","isCenter","trips","cane","avgCenterWait",
  "avgTravelToYard","avgYardWait","minYardWait","maxYardWait","avgDongaWait","devGateYard","devCenterYard",
  "devMill","vehicles","avgYardHrs","devOver8H","avgDongaHrs","devOver05H","holdingHrs","transitHrs",
  "challanQty","h","v","caneQty","holding","truckH","holdingHrs","exceedCount"
]);

function normalizeRow(row) {
  if (!row || typeof row !== "object") return row;
  const out = { ...row };
  for (const k of Object.keys(out)) {
    if (NUM_KEYS.has(k) || /^(avg|min|max|dev|qty|cane|trips|purchy|holding|transit|vehicles)/i.test(k)) {
      if (out[k] !== null && out[k] !== undefined && out[k] !== "") out[k] = n(out[k]);
    }
  }
  return out;
}

function normalizeLiveData(data) {
  if (!data || typeof data !== "object") return data;
  const arr = (a) => (Array.isArray(a) ? a.map(normalizeRow) : a);
  return {
    ...data,
    modeData: arr(data.modeData),
    trendData: arr(data.trendData),
    kpis: data.kpis ? normalizeRow(data.kpis) : data.kpis,
    sidebar: data.sidebar ? normalizeRow(data.sidebar) : data.sidebar,
    overruns: arr(data.overruns),
    cntOverruns: arr(data.cntOverruns),
    procurementFlow: arr(data.procurementFlow),
    gateYard: arr(data.gateYard),
    gateMill: arr(data.gateMill),
    topCenters: arr(data.topCenters),
    bottomCenters: arr(data.bottomCenters),
    dbRows: arr(data.dbRows),
    vehiclesByMode: arr(data.vehiclesByMode),
    overrunTrend: arr(data.overrunTrend),
    modeTrend: arr(data.modeTrend),
    centerPurchaseTrend: arr(data.centerPurchaseTrend),
    centerModePie: arr(data.centerModePie),
    centerOverrunTrend: arr(data.centerOverrunTrend),
    vehicleHandlingTrend: arr(data.vehicleHandlingTrend),
    holdingByCenter: arr(data.holdingByCenter),
    holdingTrend: arr(data.holdingTrend),
    yardHoldingTrend: arr(data.yardHoldingTrend),
    yardExceedTrend: arr(data.yardExceedTrend),
    scatterData: arr(data.scatterData),
    transitByCenter: arr(data.transitByCenter),
    truckHoldByCenter: arr(data.truckHoldByCenter),
    centerSidebar: data.centerSidebar ? normalizeRow(data.centerSidebar) : data.centerSidebar,
    topCentersVehicles: arr(data.topCentersVehicles),
    bottomCentersVehicles: arr(data.bottomCentersVehicles),
    centerVehiclesByMode: arr(data.centerVehiclesByMode),
    filterOptions: data.filterOptions || { modes: [], centers: [] },
    dateRange: data.dateRange || null,
    prior: data.prior
      ? {
          ...data.prior,
          kpis: data.prior.kpis ? normalizeRow(data.prior.kpis) : data.prior.kpis,
          sidebar: data.prior.sidebar ? normalizeRow(data.prior.sidebar) : data.prior.sidebar,
          centerSidebar: data.prior.centerSidebar ? normalizeRow(data.prior.centerSidebar) : data.prior.centerSidebar,
          overruns: arr(data.prior.overruns),
          cntOverruns: arr(data.prior.cntOverruns),
          procurementFlow: arr(data.prior.procurementFlow),
          gateYard: arr(data.prior.gateYard),
          gateMill: arr(data.prior.gateMill),
        }
      : null,
  };
}

const TABS=[
  {id:"procurement",label:"Procurement Summary",icon:BarChart2},
  {id:"gate1",label:"Gate 1",icon:GitMerge},
  {id:"gate2",label:"Gate 2",icon:ArrowRightLeft},
  {id:"center-purchase",label:"Center Purchase",icon:Activity},
  {id:"vehicle-handling",label:"Vehicle Handling",icon:Truck},
  {id:"vehicle-holding",label:"Vehicle Holding",icon:Clock},
  {id:"vehicle-holding2",label:"Vehicle Holding 2",icon:Building2},
  {id:"truck-transit",label:"Truck Transit",icon:MapPin},
  {id:"truck-holding",label:"Truck Holding",icon:Warehouse},
];

export default function CanePerformanceDashboard(){
  const[tab,setTab]=useState("procurement");
  const[dm,setDm]=useState(false);
  const[liveData, setLiveData] = useState(null);
  const[loading, setLoading] = useState(true);
  
  const[fromDate, setFromDate] = useState("");
  const[toDate, setToDate] = useState("");
  const[modeFilter, setModeFilter] = useState("All");
  const[centerFilter, setCenterFilter] = useState("All");
  const[challanFilter, setChallanFilter] = useState("");
  const[rangePreset, setRangePreset] = useState("STD"); // MTD | STD | WTD | Custom
  const[comparisonType, setComparisonType] = useState("PP");
  const[seasonMapping, setSeasonMapping] = useState({});
  const[dbMinDateStr, setDbMinDateStr] = useState("");
  const[dbMaxDateStr, setDbMaxDateStr] = useState("");
  const[dbMaxDate, setDbMaxDate] = useState(null);
  const dateRangeSeeded = useRef(false);

  const centerTabs = ["center-purchase","vehicle-handling","vehicle-holding","vehicle-holding2","truck-transit"];

  const toInputDate = (v) => {
    if (!v) return "";
    if (typeof v === "string") return v.slice(0, 10);
    if (v instanceof Date && !isNaN(v)) {
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, "0");
      const d = String(v.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return String(v).slice(0, 10);
  };

  const clampToDb = useCallback((iso) => {
    if (!iso) return iso;
    if (dbMinDateStr && iso < dbMinDateStr) return dbMinDateStr;
    if (dbMaxDateStr && iso > dbMaxDateStr) return dbMaxDateStr;
    return iso;
  }, [dbMinDateStr, dbMaxDateStr]);

  React.useEffect(() => {
    api.get("/bi/settings")
      .then((r) => {
        if (r.data?.seasonMapping && typeof r.data.seasonMapping === "object") {
          setSeasonMapping(r.data.seasonMapping);
        }
      })
      .catch(() => { });
  }, []);

  const seasonLabels = useMemo(() => {
    const refIso = toDate || dbMaxDateStr || formatYMD(new Date());
    return getCockpitSeasonLabels(refIso, seasonMapping);
  }, [toDate, dbMaxDateStr, seasonMapping]);

  const comparisonOptions = useMemo(() => {
    const refIso = toDate || dbMaxDateStr || formatYMD(new Date());
    return buildCockpitComparisonOptions(rangePreset, seasonMapping, refIso);
  }, [rangePreset, seasonMapping, toDate, dbMaxDateStr]);

  React.useEffect(() => {
    ensureCompareSelectionValid(comparisonType, comparisonOptions, setComparisonType);
  }, [comparisonType, comparisonOptions]);

  const onCompareSelect = useCallback((nextId) => {
    applyCockpitCompareSelection({
      nextId,
      fromDate,
      toDate,
      rangePreset,
      seasonMapping,
      seasonLabels,
      dataMin: dbMinDateStr,
      dataMax: dbMaxDateStr,
      setComparisonType,
    });
  }, [fromDate, toDate, rangePreset, seasonMapping, seasonLabels, dbMinDateStr, dbMaxDateStr]);

  const applyDateRange = useCallback((dateRange) => {
    if (!dateRange) return;
    const minStr = toInputDate(dateRange.minDate);
    const maxStr = toInputDate(dateRange.maxDate);
    if (minStr) setDbMinDateStr((prev) => (prev === minStr ? prev : minStr));
    if (maxStr) {
      setDbMaxDateStr((prev) => (prev === maxStr ? prev : maxStr));
      setDbMaxDate((prev) => {
        const next = new Date(`${maxStr}T00:00:00`);
        if (prev instanceof Date && !isNaN(prev) && prev.getTime() === next.getTime()) return prev;
        return next;
      });
    }
    if (dateRangeSeeded.current) return;
    if (!minStr && !maxStr) return;
    dateRangeSeeded.current = true;
    const toIso = resolveDashboardToDate(null, maxStr || minStr);
    const ref = toIso ? new Date(`${toIso}T12:00:00`) : new Date();
    const std = getCockpitPresetDateRange("STD", ref, seasonMapping);
    const clamp = (iso) => {
      if (!iso) return iso;
      if (minStr && iso < minStr) return minStr;
      if (maxStr && iso > maxStr) return maxStr;
      return iso;
    };
    const from = clamp(std.from) || minStr;
    const to = clamp(std.to) || maxStr;
    setRangePreset("STD");
    if (from) setFromDate(from);
    if (to) setToDate(to);
  }, [seasonMapping]);

  const pyRange = useMemo(() => {
    if (!fromDate || !toDate) return null;
    const resolved = resolveCockpitCompareRange(
      fromDate,
      toDate,
      comparisonType,
      seasonLabels,
      seasonMapping,
      rangePreset,
    );
    if (!resolved?.start || !resolved?.end) return null;
    return {
      from: resolved.start,
      to: resolved.end,
      label: resolved.label || (comparisonType === "PP" ? "Prev. Period" : ""),
    };
  }, [comparisonType, fromDate, toDate, rangePreset, seasonLabels, seasonMapping]);

  // Refetch when filters change OR when tab needs different data packs
  const filterKey = useMemo(() => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (modeFilter && modeFilter !== "All") params.set("mode", modeFilter);
    if (centerFilter && centerFilter !== "All") params.set("center", centerFilter);
    if (challanFilter.trim()) params.set("challan", challanFilter.trim());
    if (pyRange) {
      params.set("pyFrom", pyRange.from);
      params.set("pyTo", pyRange.to);
    }
    return params.toString();
  }, [fromDate, toDate, modeFilter, centerFilter, challanFilter, pyRange]);

  const queryKey = useMemo(() => {
    const params = new URLSearchParams({ tab: tab || "procurement" });
    if (fromDate) params.set("from", fromDate);
    if (toDate) params.set("to", toDate);
    if (modeFilter && modeFilter !== "All") params.set("mode", modeFilter);
    if (centerTabs.includes(tab) && centerFilter && centerFilter !== "All") params.set("center", centerFilter);
    if (tab === "truck-holding" && challanFilter.trim()) params.set("challan", challanFilter.trim());
    if (pyRange) {
      params.set("pyFrom", pyRange.from);
      params.set("pyTo", pyRange.to);
    }
    return params.toString();
  }, [fromDate, toDate, modeFilter, centerFilter, challanFilter, tab, pyRange]);

  const hasDataRef = useRef(false);
  const prevFilterKeyRef = useRef(filterKey);

  React.useEffect(() => {
    let cancelled = false;
    const prevKey = prevFilterKeyRef.current;
    const filtersChanged = prevKey !== filterKey;
    // First response seeds from/to → filterKey changes once. That follow-up fetch
    // must NOT flash the full-page loader (it remount-feels the 3D scene).
    const prevHadDates = /(?:^|&)from=/.test(prevKey) && /(?:^|&)to=/.test(prevKey);
    const nextHasDates = /(?:^|&)from=/.test(filterKey) && /(?:^|&)to=/.test(filterKey);
    const isDateBootstrap = filtersChanged && !prevHadDates && nextHasDates;
    prevFilterKeyRef.current = filterKey;

    if (!hasDataRef.current || (filtersChanged && !isDateBootstrap)) {
      setLoading(true);
    }

    api.get(`/bi/cane-performance/procurement?${queryKey}`)
      .then(res => {
        if (cancelled || res.data.error) return;
        if (res.data.dateRange) applyDateRange(res.data.dateRange);
        setLiveData(prev => {
          const next = normalizeLiveData(res.data);
          hasDataRef.current = true;
          if (!prev || (filtersChanged && !isDateBootstrap)) return next;
          return {
            ...prev,
            ...next,
            dateRange: next.dateRange || prev.dateRange,
            filterOptions: next.filterOptions?.modes?.length ? next.filterOptions : prev.filterOptions,
            modeData: next.modeData?.length ? next.modeData : prev.modeData,
            trendData: next.trendData?.length ? next.trendData : prev.trendData,
            overrunTrend: next.overrunTrend?.length ? next.overrunTrend : prev.overrunTrend,
            modeTrend: next.modeTrend?.length ? next.modeTrend : prev.modeTrend,
            overruns: next.overruns?.length ? next.overruns : prev.overruns,
            procurementFlow: next.procurementFlow?.length ? next.procurementFlow : prev.procurementFlow,
            gateYard: next.gateYard?.length ? next.gateYard : prev.gateYard,
            gateMill: next.gateMill?.length ? next.gateMill : prev.gateMill,
            vehiclesByMode: next.vehiclesByMode?.length ? next.vehiclesByMode : prev.vehiclesByMode,
            kpis: (next.kpis?.totalChallan || next.kpis?.caneHolding) ? next.kpis : prev.kpis,
            sidebar: next.sidebar?.noOfPurchy ? next.sidebar : prev.sidebar,
            centerSidebar: (next.centerSidebar?.noOfPurchy || next.centerSidebar?.trips)
              ? { ...prev.centerSidebar, ...next.centerSidebar }
              : prev.centerSidebar,
            cntOverruns: next.cntOverruns?.length ? next.cntOverruns : prev.cntOverruns,
            topCenters: next.topCenters?.length ? next.topCenters : prev.topCenters,
            bottomCenters: next.bottomCenters?.length ? next.bottomCenters : prev.bottomCenters,
            topCentersVehicles: next.topCentersVehicles?.length ? next.topCentersVehicles : prev.topCentersVehicles,
            bottomCentersVehicles: next.bottomCentersVehicles?.length ? next.bottomCentersVehicles : prev.bottomCentersVehicles,
            centerPurchaseTrend: next.centerPurchaseTrend?.length ? next.centerPurchaseTrend : prev.centerPurchaseTrend,
            centerModePie: next.centerModePie?.length ? next.centerModePie : prev.centerModePie,
            centerOverrunTrend: next.centerOverrunTrend?.length ? next.centerOverrunTrend : prev.centerOverrunTrend,
            centerVehiclesByMode: next.centerVehiclesByMode?.length ? next.centerVehiclesByMode : prev.centerVehiclesByMode,
            vehicleHandlingTrend: next.vehicleHandlingTrend?.length ? next.vehicleHandlingTrend : prev.vehicleHandlingTrend,
            holdingByCenter: next.holdingByCenter?.length ? next.holdingByCenter : prev.holdingByCenter,
            holdingTrend: next.holdingTrend?.length ? next.holdingTrend : prev.holdingTrend,
            yardHoldingTrend: next.yardHoldingTrend?.length ? next.yardHoldingTrend : prev.yardHoldingTrend,
            yardExceedTrend: next.yardExceedTrend?.length ? next.yardExceedTrend : prev.yardExceedTrend,
            scatterData: next.scatterData?.length ? next.scatterData : prev.scatterData,
            transitByCenter: next.transitByCenter?.length ? next.transitByCenter : prev.transitByCenter,
            truckHoldByCenter: next.truckHoldByCenter?.length ? next.truckHoldByCenter : prev.truckHoldByCenter,
            dbRows: next.dbRows?.length ? next.dbRows : prev.dbRows,
            prior: next.prior || (filtersChanged ? null : prev.prior),
          };
        });
      })
      .catch(e => console.error("Error fetching live data:", e))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [queryKey, filterKey, applyDateRange]);

  const handleQuickDate = (type) => {
    const toIso = resolveDashboardToDate(null, dbMaxDateStr);
    const today = toIso
      ? new Date(`${toIso}T12:00:00`)
      : ((dbMaxDate instanceof Date && !isNaN(dbMaxDate))
        ? dbMaxDate
        : null);
    if (!today) return;
    if (type === "Custom") {
      setRangePreset("Custom");
      return;
    }
    const { from, to } = getCockpitPresetDateRange(type, today, seasonMapping);
    setFromDate(clampToDb(from));
    setToDate(clampToDb(to));
    setRangePreset(type);
  };

  const showCompare = Boolean(pyRange);
  const prior = showCompare ? liveData?.prior : null;
  const pyLabel = pyRange?.label ? `vs ${pyRange.label}` : "vs PY";
  const priorOverrun = useMemo(() => overrunMap(prior?.overruns), [prior]);
  const priorCntOverrun = useMemo(() => overrunMap(prior?.cntOverruns), [prior]);
  const priorHoldByMode = useMemo(() => {
    const m = {};
    (prior?.procurementFlow || []).forEach((r) => {
      if (r?.mode) m[r.mode] = n(r.avgCenterWait);
    });
    return m;
  }, [prior]);

  const showModeFilter = true;
  const showCenterFilter = centerTabs.includes(tab);
  const showChallanFilter = tab === "truck-holding";
  const modeOptions = liveData?.filterOptions?.modes?.length
    ? liveData.filterOptions.modes
    : ["18 QCART","36 QTROLLY","45 QTROLLY","63 QTROLLY","99 QTROLLY"];
  const centerOptions = liveData?.filterOptions?.centers || [];

  const selectCls = dm
    ? "bg-slate-800 border-slate-700 text-slate-200"
    : "bg-white border-slate-300 text-slate-700";
  const labelCls = dm ? "text-slate-400" : "text-slate-500";

  const actualProcurementCards = liveData?.kpis
    ? { ...procurementCards, ...liveData.kpis }
    : procurementCards;

  const MODE_COLORS = { "18 QCART": "#3b82f6", "36 QTROLLY": "#1a237e", "45 QTROLLY": "#e67c32", "63 QTROLLY": "#6a1b9a", "99 QTRUCK": "#10b981", "99 QTROLLY": "#10b981" };
  const modeColor = (m) => MODE_COLORS[m] || COLORS[Object.keys(MODE_COLORS).length % COLORS.length];

  const actualModePie = liveData?.modeData
    ? liveData.modeData.map(m => ({ mode: m.mode, qty: m.caneQty, color: modeColor(m.mode) }))
    : modePie;

  const actualGate1Daily = (liveData?.trendData || []).map(t => ({
    date: String(t.date).substring(5, 10),
    qty: t.qty,
  }));

  const proc = React.useMemo(() => {
    // Gate tabs can render from gateYard alone; procurement flow is center-side
    if (!liveData?.procurementFlow && !(liveData?.gateYard?.length || liveData?.gateMill?.length)) return null;
    const f = liveData.procurementFlow || [];
    const center = f.filter(x => n(x.isCenter) === 1);
    
    // Map Gate data from G_CTC (liveData.gateYard / gateMill) since CntPerformance only has Center data
    const gateYard = (liveData.gateYard || []).map(x => ({
      mode: x.mode,
      trips: x.vehicles,
      cane: x.cane,
      avgYardWait: x.avgYardHrs,
      minYardHrs: x.minYardHrs,
      maxYardHrs: x.maxYardHrs,
      minYardWait: x.minYardHrs,
      maxYardWait: x.maxYardHrs,
      devGateYard: x.devOver8H
    }));

    const gateMill = (liveData.gateMill || []).map(x => ({
      mode: x.mode,
      trips: x.vehicles, // Used for weighted average calculation
      avgDongaWait: x.avgDongaHrs,
      devMill: x.devOver05H
    }));
    
    const sumCane = (arr) => arr.reduce((a,b) => a + n(b.cane), 0);
    const sumTrips = (arr) => arr.reduce((a,b) => a + n(b.trips), 0);
    const wAvg = (arr, key) => sumTrips(arr) ? arr.reduce((a,b) => a + n(b[key]) * n(b.trips), 0) / sumTrips(arr) : 0;
    const sumDev = (arr, key) => arr.reduce((a,b) => a + n(b[key]), 0);

    const mapTbl = (arr, timeKey, devKey) => {
      const rows = arr.map(x => ({
        mode: x.mode,
        veh: n(x.trips).toLocaleString(),
        cane: n(x.cane).toLocaleString(undefined, {maximumFractionDigits:2}),
        time: timeKey ? fmt(x[timeKey]) : "-",
        avg: timeKey ? fmt(x[timeKey]) : "-",
        h: timeKey ? fmt(x[timeKey]) : "-",
        dev: devKey ? n(x[devKey]) : "-"
      }));
      rows.push({
        mode: "Total",
        veh: sumTrips(arr).toLocaleString(),
        cane: sumCane(arr).toLocaleString(undefined, {maximumFractionDigits:2}),
        time: timeKey ? fmt(wAvg(arr, timeKey)) : "-",
        avg: timeKey ? fmt(wAvg(arr, timeKey)) : "-",
        h: timeKey ? fmt(wAvg(arr, timeKey)) : "-",
        dev: devKey ? sumDev(arr, devKey) : "-",
        cls: "font-black text-slate-800 dark:text-slate-200"
      });
      return rows;
    };

    return {
      gateVehicles: mapTbl(gateYard, 'avgYardWait'),
      centerVehicles: mapTbl(center, 'avgCenterWait'),
      centerTrips: n(liveData?.kpis?.totalChallan) || center.reduce((a,b) => a + n(b.challans ?? b.trips), 0),
      avgCenterWait: n(liveData?.kpis?.avgCenterWait) || wAvg(center, 'avgCenterWait'),
      centerHolding: mapTbl(center, 'avgCenterWait'),
      yardGate: mapTbl(gateYard, 'avgYardWait', 'devGateYard'),
      yardCenter: mapTbl(center, 'avgYardWait', 'devCenterYard'),
      mill: mapTbl(gateMill, 'avgDongaWait', 'devMill'),
      avgYardWait: n(liveData?.kpis?.yardWaiting) || wAvg(gateYard, 'avgYardWait'),
      avgDongaWait: n(liveData?.kpis?.waCane) || wAvg(gateMill, 'avgDongaWait'),
      truckHolding: n(liveData?.kpis?.truckHolding),
      avgCenterWaitKpi: n(liveData?.kpis?.avgCenterWait) || wAvg(center, 'avgCenterWait'),
      caneHolding: n(liveData?.kpis?.caneHolding) || (wAvg(gateYard, 'avgYardWait') + wAvg(gateMill, 'avgDongaWait')),
      gate2: (() => {
        const modeCard = (modeMatch) => {
          const rows = gateYard.filter(x => modeMatch(x.mode));
          return {
            trips: sumTrips(rows),
            minYardWait: rows.length ? Math.min(...rows.map(x => n(x.minYardHrs ?? x.minYardWait))) : 0,
            maxYardWait: rows.length ? Math.max(...rows.map(x => n(x.maxYardHrs ?? x.maxYardWait))) : 0,
            avgYardWait: wAvg(rows, 'avgYardWait'),
            devGateYard: sumDev(rows, 'devGateYard'),
            devCenterYard: 0
          };
        };
        return {
          cart18: modeCard(m => m === '18 QCART'),
          trolly36: modeCard(m => m === '36 QTROLLY'),
          trolly63: modeCard(m => m === '63 QTROLLY'),
          truck99: modeCard(m => m === '99 QTROLLY' || m === '99 QTRUCK')
        };
      })()
    };
  }, [liveData]);

  /** Stage totals for the procurement flow ribbon (display only). */
  const flowStats = React.useMemo(() => {
    const gate = liveData?.gateYard || [];
    const centers = (liveData?.procurementFlow || []).filter(x => n(x.isCenter) === 1);
    const gateVeh = gate.reduce((a, b) => a + n(b.vehicles), 0);
    const gateCane = gate.reduce((a, b) => a + n(b.cane), 0);
    const centerVeh = centers.reduce((a, b) => a + n(b.trips), 0);
    const centerCane = centers.reduce((a, b) => a + n(b.cane), 0);
    const lastDev = (rows) => (rows?.length ? rows[rows.length - 1].dev : null);
    return {
      gateVeh, gateCane, centerVeh, centerCane,
      totalVeh: gateVeh + centerVeh,
      totalCane: gateCane + centerCane,
      yardDev: lastDev(proc?.yardGate),
      millDev: lastDev(proc?.mill),
    };
  }, [liveData, proc]);

  /** Prior-period counterparts of flowStats (for real "vs last period" deltas on the summary KPI strip). */
  const priorFlowStats = React.useMemo(() => {
    if (!prior) return null;
    const gate = prior?.gateYard || [];
    const centers = (prior?.procurementFlow || []).filter(x => n(x.isCenter) === 1);
    const gateCane = gate.reduce((a, b) => a + n(b.cane), 0);
    const centerVeh = centers.reduce((a, b) => a + n(b.trips), 0);
    const centerCane = centers.reduce((a, b) => a + n(b.cane), 0);
    const sumField = (rows, key) => (rows || []).reduce((a, b) => a + n(b[key]), 0);
    return {
      totalCane: gateCane + centerCane,
      centerVeh,
      avgYardWait: n(prior?.kpis?.yardWaiting),
      yardDev: sumField(prior?.gateYard, 'devOver8H'),
      millDev: sumField(prior?.gateMill, 'devOver05H'),
    };
  }, [prior]);

  const bg=dm?"bg-slate-950 text-slate-100":"bg-slate-50 text-slate-800";
  const hdr=dm?"bg-slate-900 border-slate-800":"bg-white border-slate-200/80";

  return(
    <div className={`min-h-screen ${bg} transition-colors duration-200`}>
      <div className="mb-2 flex shrink-0 flex-col gap-2 p-2 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BiDashboardHeader
            title="Cane Performance Analytics"
            subtitle="Procurement · Gate · Transit · Holding"
            icon={Activity}
            iconColor="#10b981"
            isDarkMode={dm}
          />
          <div className="flex items-center gap-4">
            <BiKeyMetricBox
              value={liveData?.dbRows?.length ?? 0}
              title="Operating Days"
              subtitle={rangePreset}
              isDarkMode={dm}
            />
          </div>
        </div>

        <BiFilterBarLayout isDarkMode={dm} setIsDarkMode={setDm}>
          <div className={`flex min-w-0 w-full basis-full flex-wrap items-center gap-0.5 rounded-xl border p-0.5 sm:w-auto sm:basis-auto sm:flex-nowrap ${dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            {TABS.map(t => {
              const I = t.icon;
              return (
                <button key={t.id} onClick={() => setTab(t.id)}
                  className={`shrink-0 whitespace-nowrap flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                    tab === t.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : `text-slate-500 hover:text-slate-700 ${dm ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                  }`}>
                  <I className="w-3.5 h-3.5"/>{t.label}
                </button>
              );
            })}
          </div>

          <div className={`mx-0.5 hidden h-6 w-px shrink-0 sm:block ${dm ? 'bg-slate-600' : 'bg-slate-200'}`} />

          <div className={`flex shrink-0 flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            {['WTD', 'MTD', 'STD'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => handleQuickDate(type)}
                aria-pressed={rangePreset === type}
                className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                  rangePreset === type
                    ? 'bg-blue-600 text-white shadow-md'
                    : `text-slate-500 hover:text-slate-700 ${dm ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                }`}
              >
                {type}
              </button>
            ))}
            <button
              type="button"
              onClick={() => handleQuickDate('Custom')}
              aria-pressed={rangePreset === 'Custom'}
              className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                rangePreset === 'Custom'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                  : `text-slate-500 hover:text-slate-700 ${dm ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
              }`}
            >
              Custom
            </button>
          </div>

          <div className="flex min-w-0 shrink-0 flex-wrap items-end gap-1.5 sm:gap-2">
            {showModeFilter && (
              <div className="flex shrink-0 flex-col gap-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Mode</span>
                <select value={modeFilter} onChange={e => setModeFilter(e.target.value)}
                  className={`w-[6rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[7rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                    dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                  }`}>
                  <option value="All">All</option>
                  {modeOptions.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            )}
            {showCenterFilter && (
              <div className="flex shrink-0 flex-col gap-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Center</span>
                <select value={centerFilter} onChange={e => setCenterFilter(e.target.value)}
                  className={`w-[7rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[8rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                    dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                  }`}>
                  <option value="All">All</option>
                  {centerOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            )}
            {showChallanFilter && (
              <div className="flex shrink-0 flex-col gap-0.5">
                <span className={`text-[9px] font-bold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>Challan No.</span>
                <input type="text" placeholder="All" value={challanFilter}
                  onChange={e => setChallanFilter(e.target.value)}
                  className={`w-[6rem] min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:w-[6rem] sm:px-2 sm:py-1.5 sm:text-[11px] ${
                    dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                  }`} />
              </div>
            )}

            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>From</span>
              <input
                type="date"
                value={fromDate}
                min={dbMinDateStr || undefined}
                max={toDate || dbMaxDateStr || undefined}
                onChange={e => {
                  setRangePreset("Custom");
                  setFromDate(clampToDb(e.target.value));
                }}
                className={`bi-date-input min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                }`}
              />
            </div>
            <div className="flex shrink-0 flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${dm ? 'text-slate-500' : 'text-slate-400'}`}>To</span>
              <input
                type="date"
                value={toDate}
                min={fromDate || dbMinDateStr || undefined}
                max={dbMaxDateStr || undefined}
                onChange={e => {
                  setRangePreset("Custom");
                  setToDate(clampToDb(e.target.value));
                }}
                className={`bi-date-input min-w-0 rounded-lg border px-1.5 py-1 text-[10px] font-semibold shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 sm:px-2 sm:py-1.5 sm:text-[11px] ${
                  dm ? 'border-slate-600 bg-slate-900 text-slate-100' : 'border-slate-200 bg-white text-slate-800'
                }`}
              />
            </div>
          </div>

          <div className={`flex min-w-0 shrink-0 flex-wrap items-center gap-1.5 rounded-xl border p-1 sm:gap-2 sm:p-1.5 ${dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'}`}>
            <span className={`ml-0.5 shrink-0 text-[9px] font-bold uppercase tracking-wide sm:ml-1 sm:text-[10px] ${dm ? 'text-slate-500' : 'text-slate-400'}`}>
              Compare
            </span>
            <div className="flex min-w-0 flex-wrap gap-0.5 sm:gap-1">
              {comparisonOptions.map((comp) => (
                <button
                  key={comp.id}
                  type="button"
                  onClick={() => onCompareSelect(comp.id)}
                  className={`shrink-0 whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-black transition-all sm:px-2.5 sm:py-1.5 sm:text-[11px] ${
                    comparisonType === comp.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                      : `text-slate-500 hover:text-slate-700 ${dm ? 'hover:bg-slate-700' : 'hover:bg-slate-50'}`
                  }`}
                >
                  {comp.label}
                </button>
              ))}
            </div>
          </div>
        </BiFilterBarLayout>
      </div>

      <main className="relative min-h-[60vh] w-full px-2 py-3 sm:px-3">
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className={`text-sm font-bold ${dm ? "text-slate-300" : "text-slate-600"}`}>Loading data...</p>
            </div>
          </div>
        )}

        {tab==="procurement"&&(() => {
          const gateRows = proc?.gateVehicles || [];
          const centerVehRows = proc?.centerVehicles || [];
          const holdRows = (proc?.centerHolding || []).filter((r) => r.mode !== "Total");
          const yardRows = proc?.yardGate || [];
          const millRows = proc?.mill || [];
          const summaryKpis = [
            {
              title: "Total Cane (Q)",
              value: proc ? n(flowStats.totalCane).toLocaleString("en-IN", { maximumFractionDigits: 0 }) : "—",
              delta: priorFlowStats ? pctChange(flowStats.totalCane, priorFlowStats.totalCane) : null,
              icon: Sprout, color: "#16a34a",
            },
            {
              title: "Total Trips",
              value: proc ? n(flowStats.centerVeh || proc.centerTrips).toLocaleString("en-IN") : "—",
              delta: priorFlowStats ? pctChange(flowStats.centerVeh || proc.centerTrips, priorFlowStats.centerVeh) : null,
              icon: Truck, color: "#2563eb",
            },
            {
              title: "Avg Waiting Time (Hrs)",
              value: proc ? fmt(proc.avgYardWait) : "—",
              delta: priorFlowStats ? pctChange(proc.avgYardWait, priorFlowStats.avgYardWait) : null,
              lowerBetter: true,
              icon: Clock, color: "#7c3aed",
            },
            {
              title: "Yard Dev. (>8H)",
              value: proc && flowStats.yardDev != null ? n(flowStats.yardDev).toLocaleString("en-IN") : "—",
              delta: (priorFlowStats && flowStats.yardDev != null) ? pctChange(flowStats.yardDev, priorFlowStats.yardDev) : null,
              lowerBetter: true,
              icon: BarChart2, color: "#ea580c",
            },
            {
              title: "Mill Dev. (>0.5H)",
              value: proc && flowStats.millDev != null ? n(flowStats.millDev).toLocaleString("en-IN") : "—",
              delta: (priorFlowStats && flowStats.millDev != null) ? pctChange(flowStats.millDev, priorFlowStats.millDev) : null,
              lowerBetter: true,
              icon: Cog, color: "#6d28d9",
            },
          ];

          return (
          <div className="w-full h-[calc(100vh-10.5rem)] min-h-[480px]">
            <ProcurementCutToCrushScene
              key="procurement-cut-to-crush"
              fromDate={fromDate}
              toDate={toDate}
              gateRows={gateRows}
              centerVehRows={centerVehRows}
              holdRows={holdRows}
              centerTrips={proc?.centerTrips}
              avgCenterWait={proc?.avgCenterWait}
              truckHolding={actualProcurementCards.truckHolding ?? proc?.truckHolding}
              yardRows={yardRows}
              avgYardWait={proc?.avgYardWait}
              caneHolding={proc?.caneHolding}
              avgDongaWait={proc?.avgDongaWait}
              millRows={millRows}
              summaryKpis={summaryKpis}
            />
          </div>
          );
        })()}

        {tab==="gate1"&&(() => {
          const sb = liveData?.sidebar;
          const avgOverrun = (() => {
            const list = liveData?.overruns || [];
            if (!list.length) return null;
            return list.reduce((a, o) => a + n(o.avgOverrun), 0) / list.length;
          })();
          const priorAvgOverrun = (() => {
            const list = prior?.overruns || [];
            if (!list.length) return null;
            return list.reduce((a, o) => a + n(o.avgOverrun), 0) / list.length;
          })();
          const modePieRows = (liveData?.modeData || []).map((m) => ({
            name: m.mode,
            value: n(m.caneQty),
            color: gate1ModeColor(m.mode),
          }));
          const overrunSeries = (() => {
            const raw = liveData?.overrunTrend || [];
            const byDate = {};
            raw.forEach((r) => {
              const d = String(r.date).substring(5, 10);
              if (!byDate[d]) byDate[d] = { date: d };
              if (r.mode?.includes("18")) byDate[d].c18 = n(r.avgOverrun);
              else if (r.mode?.includes("36")) byDate[d].c36 = n(r.avgOverrun);
              else if (r.mode?.includes("45")) byDate[d].c45 = n(r.avgOverrun);
              else if (r.mode?.includes("63")) byDate[d].c63 = n(r.avgOverrun);
              else if (r.mode?.includes("99")) byDate[d].c99 = n(r.avgOverrun);
            });
            return Object.values(byDate);
          })();
          const rangeLabel = (() => {
            if (!fromDate || !toDate) return undefined;
            const opts = { day: "2-digit", month: "short" };
            const fromLbl = new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            const toLbl = new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            return fromLbl === toLbl ? fromLbl : `${fromLbl} - ${toLbl}`;
          })();
          const softTick = { fill: dm ? "#94a3b8" : "#94a3b8", fontSize: 10, fontWeight: 600 };
          const softGrid = dm ? "#1e293b" : "#f1f5f9";

          return (
          <div className="flex flex-col gap-4">
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Gate1KpiCard
                dm={dm}
                title="Total Cane Purchased (Qtls)"
                value={sb ? compact(sb.totalCanePurchased) : "—"}
                delta={pctChange(sb?.totalCanePurchased, prior?.sidebar?.totalCanePurchased)}
                icon={Sprout}
                iconBg="#ccfbf1"
                iconColor="#0d9488"
              />
              <Gate1KpiCard
                dm={dm}
                title="No. of Parchy"
                value={sb ? n(sb.noOfPurchy).toLocaleString("en-IN") : "—"}
                delta={pctChange(sb?.noOfPurchy, prior?.sidebar?.noOfPurchy)}
                icon={FileText}
                iconBg="#e0e7ff"
                iconColor="#4f46e5"
              />
              <Gate1KpiCard
                dm={dm}
                title="Avg Parchy Size (Qtls)"
                value={sb ? fmt(sb.avgPurchySize) : "—"}
                delta={pctChange(sb?.avgPurchySize, prior?.sidebar?.avgPurchySize)}
                icon={Scale}
                iconBg="#ede9fe"
                iconColor="#7c3aed"
              />
              <Gate1KpiCard
                dm={dm}
                title="Avg Parchy Overrun (Qtls)"
                value={avgOverrun != null ? fmt(avgOverrun) : "—"}
                delta={pctChange(avgOverrun, priorAvgOverrun)}
                lowerBetter
                icon={AlertTriangle}
                iconBg="#ffedd5"
                iconColor="#ea580c"
              />
            </div>

            {/* Middle: full-height donut (left) + stacked purchase/overrun trends (right) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              <Gate1Panel title="Purchase Split - Modewise" dm={dm} accent className="xl:col-span-5 min-h-[440px]">
                <Gate1ModeDonut data={modePieRows} dm={dm} />
              </Gate1Panel>

              <div className="xl:col-span-7 flex flex-col gap-4">
                <Gate1Panel title="Cane Purchase Trend" dm={dm} className="min-h-[260px]" bodyClassName="px-2 pb-3 pt-1">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={actualGate1Daily}>
                      <defs>
                        <linearGradient id="gQty" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={softTick} dy={8} interval="preserveStartEnd" />
                      <YAxis tickFormatter={(v) => (v / 1000).toFixed(1) + "k"} tickLine={false} axisLine={false} tick={softTick} width={42} />
                      <Tooltip formatter={(v) => n(v).toLocaleString("en-IN") + " Qtls"} {...TT(dm)} />
                      <Area type="monotone" dataKey="qty" name="Cane Purchased" stroke="#14b8a6" fill="url(#gQty)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Gate1Panel>

                <Gate1Panel title="Parchi Overrun Trend (Qtls)" subtitle={rangeLabel} dm={dm} className="min-h-[220px]" bodyClassName="px-2 pb-3 pt-1">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={overrunSeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={softTick} dy={8} interval="preserveStartEnd" />
                      <YAxis tickLine={false} axisLine={false} tick={softTick} width={36} />
                      <Tooltip formatter={(v) => fmt(v) + " Qtls"} {...TT(dm)} />
                      <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="c18" name="18 QCART" stroke="#14b8a6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="c36" name="36 QTROLLY" stroke="#6366f1" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="c45" name="45 QTROLLY" stroke="#a78bfa" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="c63" name="63 QTROLLY" stroke="#fb923c" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="c99" name="99 QTRUCK" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Gate1Panel>
              </div>
            </div>
          </div>
          );
        })()}

        {tab==="gate2"&&(() => {
          const g2 = proc?.gate2;
          const modes = [
            {
              key: "18",
              title: "18 QCART",
              color: "#14b8a6",
              iconBg: "#ccfbf1",
              rows: [
                { label: "No. of Carts", value: g2 ? n(g2.cart18.trips).toLocaleString("en-IN") : "—" },
                { label: "Min Yard Holding (Hrs)", value: g2 ? fmt(g2.cart18.minYardWait) : "—" },
                { label: "Avg Yard Holding (Hrs)", value: g2 ? fmt(g2.cart18.avgYardWait) : "—" },
                { label: "Max Yard Holding (Hrs)", value: g2 ? fmt(g2.cart18.maxYardWait) : "—" },
                { label: "Exceeding Holding Time", value: g2 ? n((g2.cart18.devGateYard || 0) + (g2.cart18.devCenterYard || 0)).toLocaleString("en-IN") : "—" },
              ],
            },
            {
              key: "36",
              title: "36 QTROLLY",
              color: "#3b82f6",
              iconBg: "#dbeafe",
              rows: [
                { label: "No. of Trollies", value: g2 ? n(g2.trolly36.trips).toLocaleString("en-IN") : "—" },
                { label: "Min Yard Holding (Hrs)", value: g2 ? fmt(g2.trolly36.minYardWait) : "—" },
                { label: "Avg Yard Holding (Hrs)", value: g2 ? fmt(g2.trolly36.avgYardWait) : "—" },
                { label: "Max Yard Holding (Hrs)", value: g2 ? fmt(g2.trolly36.maxYardWait) : "—" },
                { label: "Exceeding Holding Time", value: g2 ? n((g2.trolly36.devGateYard || 0) + (g2.trolly36.devCenterYard || 0)).toLocaleString("en-IN") : "—" },
              ],
            },
            {
              key: "63",
              title: "63 QTROLLY",
              color: "#f97316",
              iconBg: "#ffedd5",
              rows: [
                { label: "No. of Trollies", value: g2 ? n(g2.trolly63.trips).toLocaleString("en-IN") : "—" },
                { label: "Min Yard Holding (Hrs)", value: g2 ? fmt(g2.trolly63.minYardWait) : "—" },
                { label: "Avg Yard Holding (Hrs)", value: g2 ? fmt(g2.trolly63.avgYardWait) : "—" },
                { label: "Max Yard Holding (Hrs)", value: g2 ? fmt(g2.trolly63.maxYardWait) : "—" },
                { label: "Exceeding Holding Time", value: g2 ? n((g2.trolly63.devGateYard || 0) + (g2.trolly63.devCenterYard || 0)).toLocaleString("en-IN") : "—" },
              ],
            },
            {
              key: "99",
              title: "99 QTRUCK",
              color: "#8b5cf6",
              iconBg: "#ede9fe",
              rows: [
                { label: "No. of Trucks", value: g2 ? n(g2.truck99.trips).toLocaleString("en-IN") : "—" },
                { label: "Min Yard Holding (Hrs)", value: g2 ? fmt(g2.truck99.minYardWait) : "—" },
                { label: "Avg Yard Holding (Hrs)", value: g2 ? fmt(g2.truck99.avgYardWait) : "—" },
                { label: "Max Yard Holding (Hrs)", value: g2 ? fmt(g2.truck99.maxYardWait) : "—" },
                { label: "Exceeding Holding Time", value: g2 ? n((g2.truck99.devGateYard || 0) + (g2.truck99.devCenterYard || 0)).toLocaleString("en-IN") : "—" },
              ],
            },
          ];

          const totalVeh = g2
            ? n(g2.cart18.trips) + n(g2.trolly36.trips) + n(g2.trolly63.trips) + n(g2.truck99.trips)
            : null;
          const avgHold = g2
            ? (() => {
                const vals = [g2.cart18, g2.trolly36, g2.trolly63, g2.truck99]
                  .map((m) => n(m.avgYardWait))
                  .filter((v) => v > 0);
                return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
              })()
            : null;
          const maxHold = g2
            ? Math.max(n(g2.cart18.maxYardWait), n(g2.trolly36.maxYardWait), n(g2.trolly63.maxYardWait), n(g2.truck99.maxYardWait))
            : null;
          const exceedTotal = g2
            ? [g2.cart18, g2.trolly36, g2.trolly63, g2.truck99]
                .reduce((s, m) => s + n(m.devGateYard) + n(m.devCenterYard), 0)
            : null;

          const holdingSeries = (() => {
            const byDate = {};
            (liveData?.yardHoldingTrend || []).forEach((r) => {
              const d = String(r.date).substring(5, 10);
              if (!byDate[d]) byDate[d] = { date: d };
              if (r.mode?.includes("18")) byDate[d].c18 = n(r.holdingHrs);
              else if (r.mode?.includes("36")) byDate[d].c36 = n(r.holdingHrs);
              else if (r.mode?.includes("45")) byDate[d].c45 = n(r.holdingHrs);
              else if (r.mode?.includes("63")) byDate[d].c63 = n(r.holdingHrs);
              else if (r.mode?.includes("99")) byDate[d].c99 = n(r.holdingHrs);
            });
            return Object.values(byDate);
          })();

          const exceedSeries = (() => {
            const byDate = {};
            (liveData?.yardExceedTrend || []).forEach((r) => {
              const d = String(r.date).substring(5, 10);
              if (!byDate[d]) byDate[d] = { date: d };
              if (r.mode?.includes("18")) byDate[d].c18 = n(r.exceedCount);
              else if (r.mode?.includes("36")) byDate[d].c36 = n(r.exceedCount);
              else if (r.mode?.includes("45")) byDate[d].c45 = n(r.exceedCount);
              else if (r.mode?.includes("63")) byDate[d].c63 = n(r.exceedCount);
              else if (r.mode?.includes("99")) byDate[d].c99 = n(r.exceedCount);
            });
            return Object.values(byDate);
          })();

          const rangeLabel = (() => {
            if (!fromDate || !toDate) return undefined;
            const opts = { day: "2-digit", month: "short" };
            const fromLbl = new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            const toLbl = new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            return fromLbl === toLbl ? fromLbl : `${fromLbl} - ${toLbl}`;
          })();
          const softTick = { fill: "#94a3b8", fontSize: 10, fontWeight: 600 };
          const softGrid = dm ? "#1e293b" : "#f1f5f9";

          return (
          <div className="flex flex-col gap-4">
            {/* Summary KPI row — same language as Gate 1 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Gate1KpiCard
                dm={dm}
                title="Total Vehicles"
                value={totalVeh != null ? totalVeh.toLocaleString("en-IN") : "—"}
                icon={Truck}
                iconBg="#dbeafe"
                iconColor="#2563eb"
              />
              <Gate1KpiCard
                dm={dm}
                title="Avg Yard Holding (Hrs)"
                value={avgHold != null ? fmt(avgHold) : "—"}
                lowerBetter
                icon={Clock}
                iconBg="#ccfbf1"
                iconColor="#0d9488"
              />
              <Gate1KpiCard
                dm={dm}
                title="Max Yard Holding (Hrs)"
                value={maxHold != null ? fmt(maxHold) : "—"}
                lowerBetter
                icon={Activity}
                iconBg="#ffedd5"
                iconColor="#ea580c"
              />
              <Gate1KpiCard
                dm={dm}
                title="Vehicles Exceeding (>8 Hrs)"
                value={exceedTotal != null ? exceedTotal.toLocaleString("en-IN") : "—"}
                lowerBetter
                icon={AlertTriangle}
                iconBg="#fee2e2"
                iconColor="#dc2626"
              />
            </div>

            {/* Mode-wise soft cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {modes.map((m) => (
                <Gate2ModeCard key={m.key} title={m.title} color={m.color} iconBg={m.iconBg} rows={m.rows} dm={dm} />
              ))}
            </div>

            {/* Soft chart panels */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Gate1Panel title="Average Yard Holding Time" subtitle={rangeLabel} dm={dm} className="min-h-[280px]" bodyClassName="px-2 pb-3 pt-1">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={holdingSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={softTick} dy={8} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={softTick} width={36} />
                    <Tooltip formatter={(v) => fmt(v) + " Hrs"} {...TT(dm)} />
                    <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="c18" name="18 QCART" stroke="#14b8a6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="c36" name="36 QTROLLY" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="c63" name="63 QTROLLY" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="c99" name="99 QTRUCK" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </Gate1Panel>

              <Gate1Panel title="Vehicles Exceeding Standard Holding Time" subtitle={rangeLabel} dm={dm} className="min-h-[280px]" bodyClassName="px-2 pb-3 pt-1">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={exceedSeries}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={softTick} dy={8} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={softTick} width={36} />
                    <Tooltip formatter={(v) => n(v).toLocaleString("en-IN")} {...TT(dm)} />
                    <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="c18" name="18 QCART" fill="#14b8a6" radius={[3, 3, 0, 0]} barSize={8} />
                    <Bar dataKey="c36" name="36 QTROLLY" fill="#3b82f6" radius={[3, 3, 0, 0]} barSize={8} />
                    <Bar dataKey="c63" name="63 QTROLLY" fill="#f97316" radius={[3, 3, 0, 0]} barSize={8} />
                    <Bar dataKey="c99" name="99 QTRUCK" fill="#8b5cf6" radius={[3, 3, 0, 0]} barSize={8} />
                  </BarChart>
                </ResponsiveContainer>
              </Gate1Panel>
            </div>
          </div>
          );
        })()}

        {tab==="center-purchase"&&(() => {
          const cs = liveData?.centerSidebar;
          const modePieRows = (liveData?.centerModePie || []).map((m) => ({
            name: m.mode,
            value: n(m.caneQty),
            color: gate1ModeColor(m.mode),
          }));
          const purchaseTrend = (liveData?.centerPurchaseTrend || []).map((t) => ({
            date: String(t.date).substring(5, 10),
            qty: n(t.qty),
          }));
          const overrunSeries = (() => {
            const byDate = {};
            (liveData?.centerOverrunTrend || []).forEach((r) => {
              const d = String(r.date).substring(5, 10);
              if (!byDate[d]) byDate[d] = { date: d };
              if (r.mode?.includes("18")) byDate[d].c18 = n(r.avgOverrun);
              else if (r.mode?.includes("36")) byDate[d].c36 = n(r.avgOverrun);
              else if (r.mode?.includes("45")) byDate[d].c45 = n(r.avgOverrun);
              else if (r.mode?.includes("63")) byDate[d].c63 = n(r.avgOverrun);
              else if (r.mode?.includes("99")) byDate[d].c99 = n(r.avgOverrun);
            });
            return Object.values(byDate);
          })();
          const topCenters = (liveData?.topCenters || []).map((x) => ({
            c: String(x.c || "").substring(0, 12),
            q: n(x.cane),
            a: n(x.avgParchi),
          }));
          const bottomCenters = (liveData?.bottomCenters || []).map((x) => ({
            c: String(x.c || "").substring(0, 12),
            q: n(x.cane),
            a: n(x.avgParchi),
          }));
          const avgOverrun = (() => {
            const list = liveData?.cntOverruns || [];
            if (!list.length) return null;
            return list.reduce((a, o) => a + n(o.avgOverrun), 0) / list.length;
          })();
          const priorAvgOverrun = (() => {
            const list = prior?.cntOverruns || [];
            if (!list.length) return null;
            return list.reduce((a, o) => a + n(o.avgOverrun), 0) / list.length;
          })();
          const rangeLabel = (() => {
            if (!fromDate || !toDate) return undefined;
            const opts = { day: "2-digit", month: "short" };
            const fromLbl = new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            const toLbl = new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            return fromLbl === toLbl ? fromLbl : `${fromLbl} - ${toLbl}`;
          })();
          const softTick = { fill: "#94a3b8", fontSize: 10, fontWeight: 600 };
          const softGrid = dm ? "#1e293b" : "#f1f5f9";

          return (
          <div className="flex flex-col gap-4">
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              <Gate1KpiCard
                dm={dm}
                title="Cane Purchased (Qtls)"
                value={cs ? compact(cs.totalCanePurchased) : "—"}
                delta={pctChange(cs?.totalCanePurchased, prior?.centerSidebar?.totalCanePurchased)}
                icon={Sprout}
                iconBg="#ccfbf1"
                iconColor="#0d9488"
              />
              <Gate1KpiCard
                dm={dm}
                title="No. of Purchy"
                value={cs ? n(cs.noOfPurchy).toLocaleString("en-IN") : "—"}
                delta={pctChange(cs?.noOfPurchy, prior?.centerSidebar?.noOfPurchy)}
                icon={FileText}
                iconBg="#e0e7ff"
                iconColor="#4f46e5"
              />
              <Gate1KpiCard
                dm={dm}
                title="Avg Parchi Size (Qtls)"
                value={cs ? fmt(cs.avgParchiSize) : "—"}
                delta={pctChange(cs?.avgParchiSize, prior?.centerSidebar?.avgParchiSize)}
                icon={Scale}
                iconBg="#ede9fe"
                iconColor="#7c3aed"
              />
              <Gate1KpiCard
                dm={dm}
                title="Trips (C to G)"
                value={cs ? n(cs.trips).toLocaleString("en-IN") : "—"}
                delta={pctChange(cs?.trips, prior?.centerSidebar?.trips)}
                icon={Truck}
                iconBg="#ffedd5"
                iconColor="#ea580c"
              />
              <Gate1KpiCard
                dm={dm}
                title="Avg Parchi Overrun (Qtls)"
                value={avgOverrun != null ? fmt(avgOverrun) : "—"}
                delta={pctChange(avgOverrun, priorAvgOverrun)}
                lowerBetter
                icon={AlertTriangle}
                iconBg="#fee2e2"
                iconColor="#dc2626"
              />
            </div>

            {/* Mode overrun chips */}
            {(liveData?.cntOverruns || []).length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {(liveData?.cntOverruns || []).map((o) => {
                  const color = gate1ModeColor(o.mode);
                  return (
                    <div key={o.mode}
                      className={`relative rounded-2xl border px-3.5 py-3 transition-all duration-200 hover:-translate-y-0.5
                        ${dm ? "bg-slate-900 border-slate-800" : "bg-white border-slate-100"}`}
                      style={{ boxShadow: cardShadow(dm) }}>
                      <div className="absolute top-2 right-2 z-10">
                        <InfoTip text={`Average parchie overrun (Qtls) for mode ${o.mode}: avg cane qty minus the standard mode capacity.`} dm={dm} />
                      </div>
                      <p className={`text-[11px] font-semibold pr-6 ${dm ? "text-slate-400" : "text-slate-500"}`}>{o.mode}</p>
                      <p className="text-xl font-black tabular-nums mt-0.5" style={{ color }}>{fmt(o.avgOverrun)}</p>
                      <p className={`text-[10px] font-medium ${dm ? "text-slate-500" : "text-slate-400"}`}>Avg overrun (Qtls)</p>
                      {priorCntOverrun[o.mode] != null && (
                        <div className="mt-1">
                          <PyBadge curr={o.avgOverrun} prior={priorCntOverrun[o.mode]} lowerBetter dm={dm} label={pyLabel} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Donut + trends — Gate 1 layout */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              <Gate1Panel title="Purchase Split - Modewise" dm={dm} accent className="xl:col-span-5 min-h-[400px]">
                <Gate1ModeDonut data={modePieRows} dm={dm} />
              </Gate1Panel>

              <div className="xl:col-span-7 flex flex-col gap-4">
                <Gate1Panel title="Cane Purchase Trend" subtitle={rangeLabel} dm={dm} className="min-h-[240px]" bodyClassName="px-2 pb-3 pt-1">
                  <ResponsiveContainer width="100%" height={210}>
                    <AreaChart data={purchaseTrend}>
                      <defs>
                        <linearGradient id="gCenterQty" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={softTick} dy={8} interval="preserveStartEnd" />
                      <YAxis tickFormatter={(v) => (v / 1000).toFixed(1) + "k"} tickLine={false} axisLine={false} tick={softTick} width={42} />
                      <Tooltip formatter={(v) => n(v).toLocaleString("en-IN") + " Qtls"} {...TT(dm)} />
                      <Area type="monotone" dataKey="qty" name="Cane Purchased" stroke="#14b8a6" fill="url(#gCenterQty)" strokeWidth={2} dot={{ r: 2.5, strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Gate1Panel>

                <Gate1Panel title="Parchi Overrun Trend (Qtls)" subtitle={rangeLabel} dm={dm} className="min-h-[220px]" bodyClassName="px-2 pb-3 pt-1">
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={overrunSeries}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={softTick} dy={8} interval="preserveStartEnd" />
                      <YAxis tickLine={false} axisLine={false} tick={softTick} width={36} />
                      <Tooltip formatter={(v) => fmt(v) + " Qtls"} {...TT(dm)} />
                      <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                      <Line type="monotone" dataKey="c18" name="18 QCART" stroke="#14b8a6" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="c36" name="36 QTROLLY" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="c45" name="45 QTROLLY" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="c63" name="63 QTROLLY" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="c99" name="99 QTRUCK" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </Gate1Panel>
              </div>
            </div>

            {/* Top / Bottom centers — stacked like reference */}
            <div className="flex flex-col gap-4">
              <Gate1Panel title="Top 10 Centers - Cane Purchase" subtitle={rangeLabel} dm={dm} className="min-h-[300px]" bodyClassName="px-2 pb-3 pt-1">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={topCenters} margin={{ top: 18, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                    <XAxis dataKey="c" tickLine={false} axisLine={false} tick={softTick} dy={8} angle={-25} textAnchor="end" height={54} interval={0} />
                    <YAxis yAxisId="left" tickFormatter={(v) => (v / 1000).toFixed(0) + "K"} tickLine={false} axisLine={false} tick={softTick} width={40} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={softTick} width={36} />
                    <Tooltip {...TT(dm)} />
                    <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="q" name="Cane Purchased (Qtls)" fill="#f4c7c3" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList dataKey="q" position="insideBottom" formatter={(v) => (n(v) >= 1000 ? (n(v) / 1000).toFixed(0) + "K" : n(v))} style={{ fontSize: 9, fontWeight: 700, fill: "#7f1d1d" }} />
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="a" name="Avg Parchi Size" stroke="#000080" strokeWidth={2} dot={{ r: 3.5, fill: "#000080", strokeWidth: 0 }}>
                      <LabelList dataKey="a" position="top" formatter={(v) => Math.round(n(v))} style={{ fontSize: 10, fontWeight: 700, fill: "#000080" }} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </Gate1Panel>

              <Gate1Panel title="Bottom 10 Centers - Cane Purchase" subtitle={rangeLabel} dm={dm} className="min-h-[300px]" bodyClassName="px-2 pb-3 pt-1">
                <ResponsiveContainer width="100%" height={260}>
                  <ComposedChart data={bottomCenters} margin={{ top: 18, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                    <XAxis dataKey="c" tickLine={false} axisLine={false} tick={softTick} dy={8} angle={-25} textAnchor="end" height={54} interval={0} />
                    <YAxis yAxisId="left" tickFormatter={(v) => (v / 1000).toFixed(0) + "K"} tickLine={false} axisLine={false} tick={softTick} width={40} />
                    <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={softTick} width={36} />
                    <Tooltip {...TT(dm)} />
                    <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Bar yAxisId="left" dataKey="q" name="Cane Purchased (Qtls)" fill="#f4c7c3" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList dataKey="q" position="insideBottom" formatter={(v) => (n(v) >= 1000 ? (n(v) / 1000).toFixed(0) + "K" : n(v))} style={{ fontSize: 9, fontWeight: 700, fill: "#7f1d1d" }} />
                    </Bar>
                    <Line yAxisId="right" type="monotone" dataKey="a" name="Avg Parchi Size" stroke="#000080" strokeWidth={2} dot={{ r: 3.5, fill: "#000080", strokeWidth: 0 }}>
                      <LabelList dataKey="a" position="top" formatter={(v) => Math.round(n(v))} style={{ fontSize: 10, fontWeight: 700, fill: "#000080" }} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </Gate1Panel>
            </div>
          </div>
          );
        })()}

        {tab==="vehicle-handling"&&(() => {
          const handled = liveData?.centerSidebar?.noOfPurchy;
          const modeRows = (liveData?.centerVehiclesByMode || []).map((m) => ({
            mode: shortModeLabel(m.mode),
            full: m.mode,
            vehicles: n(m.vehicles),
            fill: gate1ModeColor(m.mode),
          }));
          const handlingTrend = (() => {
            const byDate = {};
            (liveData?.vehicleHandlingTrend || []).forEach((r) => {
              const d = String(r.date).substring(5, 10);
              if (!byDate[d]) byDate[d] = { date: d };
              if (r.mode?.includes("18")) byDate[d].v18 = n(r.vehicles);
              else if (r.mode?.includes("36")) byDate[d].v36 = n(r.vehicles);
              else if (r.mode?.includes("45")) byDate[d].v45 = n(r.vehicles);
              else if (r.mode?.includes("63")) byDate[d].v63 = n(r.vehicles);
              else if (r.mode?.includes("99")) byDate[d].v99 = n(r.vehicles);
            });
            return Object.values(byDate);
          })();
          const rangeLabel = (() => {
            if (!fromDate || !toDate) return undefined;
            const opts = { day: "2-digit", month: "short" };
            const fromLbl = new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            const toLbl = new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            return fromLbl === toLbl ? fromLbl : `${fromLbl} - ${toLbl}`;
          })();
          const softTick = { fill: "#94a3b8", fontSize: 10, fontWeight: 600 };
          const softGrid = dm ? "#1e293b" : "#f1f5f9";
          const topModes = [...modeRows].sort((a, b) => b.vehicles - a.vehicles).slice(0, 3);

          const SoftTable = ({ title, rows }) => (
            <Gate1Panel title={title} subtitle={rangeLabel} dm={dm} className="min-h-[280px]" bodyClassName="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] text-center">
                  <thead className={`uppercase text-[9.5px] tracking-wider ${dm ? "bg-slate-800/50 text-slate-400 border-b border-slate-700" : "bg-slate-50 text-slate-500 border-b border-slate-100"}`}>
                    <tr>
                      <th className="px-3 py-2.5 text-left font-semibold">Center</th>
                      <th className="px-2 py-2.5 font-semibold">18 QCART</th>
                      <th className="px-2 py-2.5 font-semibold">36 QTROLLY</th>
                      <th className="px-2 py-2.5 font-semibold">45 QTROLLY</th>
                      <th className="px-2 py-2.5 font-semibold">63 QTROLLY</th>
                      <th className="px-2 py-2.5 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${dm ? "divide-slate-800" : "divide-slate-100"}`}>
                    {(rows || []).map((r, i) => (
                      <tr key={i} className={`transition-colors ${dm ? "hover:bg-slate-800/40" : "hover:bg-slate-50"}`}>
                        <td className={`px-3 py-2 text-left font-semibold ${dm ? "text-slate-200" : "text-slate-700"}`}>{r.c}</td>
                        <td className="px-2 py-2 tabular-nums">{n(r.m18).toLocaleString("en-IN")}</td>
                        <td className="px-2 py-2 tabular-nums">{n(r.m36).toLocaleString("en-IN")}</td>
                        <td className="px-2 py-2 tabular-nums">{n(r.m45).toLocaleString("en-IN")}</td>
                        <td className="px-2 py-2 tabular-nums">{n(r.m63).toLocaleString("en-IN")}</td>
                        <td className={`px-2 py-2 font-bold tabular-nums ${dm ? "text-slate-100" : "text-slate-900"}`}>{n(r.total).toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                    {!(rows || []).length && (
                      <tr><td colSpan={6} className="px-3 py-8 text-slate-400">No data for selected range</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Gate1Panel>
          );

          return (
          <div className="flex flex-col gap-4">
            {/* KPI row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Gate1KpiCard
                dm={dm}
                title="Vehicles Handled"
                value={handled != null ? (n(handled) >= 1000 ? compact(handled) : n(handled).toLocaleString("en-IN")) : "—"}
                delta={pctChange(handled, prior?.centerSidebar?.noOfPurchy)}
                icon={Truck}
                iconBg="#dbeafe"
                iconColor="#2563eb"
              />
              {topModes.map((m) => (
                <Gate1KpiCard
                  key={m.full}
                  dm={dm}
                  title={m.full}
                  value={m.vehicles.toLocaleString("en-IN")}
                  icon={Truck}
                  iconBg={`${m.fill}22`}
                  iconColor={m.fill}
                />
              ))}
            </div>

            {/* Mode split + trend */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              <Gate1Panel title="Mode wise Split" subtitle={rangeLabel} dm={dm} accent className="xl:col-span-5 min-h-[280px]" bodyClassName="px-2 pb-3 pt-1">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={modeRows} margin={{ top: 12, right: 8, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                    <XAxis dataKey="mode" tickLine={false} axisLine={false} tick={softTick} dy={8} />
                    <YAxis tickFormatter={(v) => (v / 1000).toFixed(1) + "K"} tickLine={false} axisLine={false} tick={softTick} width={42} />
                    <Tooltip formatter={(v) => n(v).toLocaleString("en-IN") + " vehicles"} {...TT(dm)} />
                    <Bar dataKey="vehicles" name="Vehicles" radius={[6, 6, 0, 0]} barSize={36}>
                      {modeRows.map((e, i) => <Cell key={i} fill={e.fill} />)}
                      <LabelList dataKey="vehicles" position="top" formatter={(v) => (n(v) >= 1000 ? (n(v) / 1000).toFixed(1) + "K" : n(v))} style={{ fontSize: 10, fontWeight: 700, fill: dm ? "#e2e8f0" : "#334155" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Gate1Panel>

              <Gate1Panel title="Vehicle Handling Trend (Mode wise)" subtitle={rangeLabel} dm={dm} className="xl:col-span-7 min-h-[280px]" bodyClassName="px-2 pb-3 pt-1">
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={handlingTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={softTick} dy={8} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={softTick} width={40} />
                    <Tooltip formatter={(v) => n(v).toLocaleString("en-IN") + " vehicles"} {...TT(dm)} />
                    <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="v18" name="18 QCART" stroke="#14b8a6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="v36" name="36 QTROLLY" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="v45" name="45 QTROLLY" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="v63" name="63 QTROLLY" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="v99" name="99 QTRUCK" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </Gate1Panel>
            </div>

            {/* Top / Least center tables */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <SoftTable title="Centers with Most Vehicle Handled (Top 10)" rows={liveData?.topCentersVehicles} />
              <SoftTable title="Centers with Least Vehicle Handled (Top 10)" rows={liveData?.bottomCentersVehicles} />
            </div>
          </div>
          );
        })()}

        {tab==="vehicle-holding"&&(() => {
          const holdModes = (proc?.centerHolding || [])
            .filter((h) => h.mode && h.mode !== "Total")
            .map((x) => ({
              mode: x.mode,
              h: n(x.h),
              color: gate1ModeColor(x.mode),
            }));
          const overallAvg = holdModes.length
            ? holdModes.reduce((a, m) => a + m.h, 0) / holdModes.length
            : null;
          const priorOverall = (() => {
            const vals = Object.values(priorHoldByMode).map(n).filter((v) => v > 0);
            return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
          })();
          const holdingTrend = (() => {
            const byDate = {};
            (liveData?.holdingTrend || []).forEach((r) => {
              const d = String(r.date).substring(5, 10);
              if (!byDate[d]) byDate[d] = { date: d };
              if (r.mode?.includes("18")) byDate[d].v18 = n(r.holdingHrs);
              else if (r.mode?.includes("36")) byDate[d].v36 = n(r.holdingHrs);
              else if (r.mode?.includes("45")) byDate[d].v45 = n(r.holdingHrs);
              else if (r.mode?.includes("63")) byDate[d].v63 = n(r.holdingHrs);
              else if (r.mode?.includes("99")) byDate[d].v99 = n(r.holdingHrs);
            });
            return Object.values(byDate);
          })();
          const scatterRaw = liveData?.scatterData || [];
          const scatterModes = [...new Set(scatterRaw.map((r) => r.mode).filter(Boolean))];
          const rangeLabel = (() => {
            if (!fromDate || !toDate) return undefined;
            const opts = { day: "2-digit", month: "short" };
            const fromLbl = new Date(fromDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            const toLbl = new Date(toDate + "T00:00:00").toLocaleDateString("en-IN", opts);
            return fromLbl === toLbl ? fromLbl : `${fromLbl} - ${toLbl}`;
          })();
          const softTick = { fill: "#94a3b8", fontSize: 10, fontWeight: 600 };
          const softGrid = dm ? "#1e293b" : "#f1f5f9";

          return (
          <div className="flex flex-col gap-4">
            {/* Overall + mode holding KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
              <Gate1KpiCard
                dm={dm}
                title="Avg Holding Time (Hrs)"
                value={overallAvg != null ? fmt(overallAvg) : "—"}
                delta={pctChange(overallAvg, priorOverall)}
                lowerBetter
                icon={Clock}
                iconBg="#ccfbf1"
                iconColor="#0d9488"
              />
              {holdModes.map((m) => (
                <Gate1KpiCard
                  key={m.mode}
                  dm={dm}
                  title={m.mode}
                  value={fmt(m.h)}
                  delta={pctChange(m.h, priorHoldByMode[m.mode])}
                  lowerBetter
                  icon={Clock}
                  iconBg={`${m.color}22`}
                  iconColor={m.color}
                />
              ))}
            </div>

            {/* Trend + scatter */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
              <Gate1Panel title="Avg Holding Time at Centers - Trend" subtitle={rangeLabel} dm={dm} className="xl:col-span-7 min-h-[300px]" bodyClassName="px-2 pb-3 pt-1">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={holdingTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={softGrid} />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={softTick} dy={8} interval="preserveStartEnd" />
                    <YAxis tickLine={false} axisLine={false} tick={softTick} width={36} />
                    <Tooltip formatter={(v) => fmt(v) + " Hrs"} {...TT(dm)} />
                    <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    <Line type="monotone" dataKey="v18" name="18 QCART" stroke="#14b8a6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="v36" name="36 QTROLLY" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="v45" name="45 QTROLLY" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="v63" name="63 QTROLLY" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="v99" name="99 QTRUCK" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </Gate1Panel>

              <Gate1Panel title="Vehicle vs Center Holding Time" subtitle={rangeLabel} dm={dm} accent className="xl:col-span-5 min-h-[300px]" bodyClassName="px-2 pb-3 pt-1">
                <ResponsiveContainer width="100%" height={260}>
                  <ScatterChart margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={softGrid} />
                    <XAxis
                      dataKey="h"
                      name="Holding (Hrs)"
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={softTick}
                      label={{ value: "Holding Hrs", position: "insideBottom", offset: -2, fontSize: 10, fill: "#94a3b8" }}
                    />
                    <YAxis
                      dataKey="v"
                      name="Vehicles"
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tick={softTick}
                      width={40}
                    />
                    <Tooltip cursor={{ strokeDasharray: "3 3" }} {...TT(dm)} />
                    <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 10 }} />
                    {scatterModes.map((m) => (
                      <Scatter
                        key={m}
                        name={m}
                        data={scatterRaw.filter((r) => r.mode === m).map((r) => ({ h: n(r.h), v: n(r.v), center: r.center }))}
                        fill={gate1ModeColor(m)}
                      />
                    ))}
                  </ScatterChart>
                </ResponsiveContainer>
              </Gate1Panel>
            </div>
          </div>
          );
        })()}


        {tab==="vehicle-holding2"&&(
          <LogisticsCommandPanel
            mode="centers"
            dm={dm}
            rows={(liveData?.holdingByCenter || []).map((r) => ({
              name: r.center,
              time: n(r.holdingHrs),
              volume: n(r.vehicles),
            }))}
          />
        )}

        {tab==="truck-transit"&&(
          <LogisticsCommandPanel
            mode="transit"
            dm={dm}
            rows={(liveData?.transitByCenter || []).map((r) => ({
              name: r.center,
              time: n(r.transitHrs),
              volume: Math.round(n(r.challanQty)),
            }))}
          />
        )}

        {tab==="truck-holding"&&(
          <LogisticsCommandPanel
            mode="holding"
            dm={dm}
            rows={(liveData?.truckHoldByCenter || []).map((r) => ({
              name: r.center,
              time: n(r.holdingHrs),
              volume: Math.round(n(r.challanQty)),
            }))}
          />
        )}

      </main>
    </div>
  );
}
