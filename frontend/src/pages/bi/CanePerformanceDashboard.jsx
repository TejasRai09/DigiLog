import React, { useState, useMemo } from "react";
import {
  LineChart, Line, BarChart, Bar, AreaChart, Area,
  ComposedChart, ScatterChart, Scatter, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import {
  TrendingUp, TrendingDown, Activity, Truck, MapPin, Clock,
  Database, BarChart2, GitMerge, ArrowRightLeft, Sun, Moon, Filter, Loader2,
  Sprout, DoorOpen, Warehouse, Scale, Factory, Cog, ArrowRight, Award,
  Search, Trophy, Building2, ShieldCheck, Eye, List, LayoutGrid,
  ChevronLeft, ChevronRight, Target, CheckCircle2, AlertCircle, Package
} from "lucide-react";
import api from "../../api/axios";

const CENTERS = ["Aatipat","Bandholi","Chaudharia","Dhangaon","Eklauta","Fatehpur","Gursarai"];
const TRANSPORT_MODES = ["Tractor","Truck","Bullock Cart"];
const DATES = ["01-Jul","02-Jul","03-Jul","04-Jul","05-Jul","06-Jul","07-Jul","08-Jul","09-Jul","10-Jul"];
const COLORS = ["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4","#f97316"];

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

const KPICard = ({label,value,unit="",icon:Icon,color="blue",darkMode})=>{
  const bg=darkMode?"bg-slate-900":"bg-white";
  const bdr=darkMode?"border-slate-800":"border-slate-200/80";
  const cols={blue:"text-blue-500",green:"text-emerald-500",amber:"text-amber-500",red:"text-red-500",violet:"text-violet-500"};
  return(
    <div className={`${bg} rounded-2xl border ${bdr} p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col gap-2 transition-transform hover:-translate-y-0.5`}>
      <div className="flex items-center justify-between">
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

const ChartCard=({title,children,darkMode,className=""})=>(
  <div className={`${darkMode?"bg-slate-900 border-slate-800":"bg-white border-slate-200/80"} rounded-2xl border p-4 shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] ${className}`}>
    {title&&<p className={`text-[10px] font-bold uppercase tracking-wider mb-3 ${darkMode?"text-slate-400":"text-slate-500"}`}>{title}</p>}
    {children}
  </div>
);

const DTable=({cols,rows,darkMode})=>(
  <div className={`rounded-2xl border overflow-hidden ${darkMode?"border-slate-800":"border-slate-200/80"}`}>
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead className={`${darkMode?"bg-slate-800/60 text-slate-400":"bg-slate-50 text-slate-500"} uppercase text-[10px]`}>
          <tr>{cols.map(c=><th key={c.key} className="px-3 py-2.5 font-bold whitespace-nowrap">{c.label}</th>)}</tr>
        </thead>
        <tbody className={`divide-y ${darkMode?"divide-slate-800 text-slate-300":"divide-slate-100 text-slate-700"}`}>
          {rows.map((row,i)=>(
            <tr key={i} className={darkMode?"hover:bg-slate-800/40":"hover:bg-slate-50"}>
              {cols.map(c=>(
                <td key={c.key} className={`px-3 py-2 whitespace-nowrap ${c.bold?"font-semibold":""} ${c.cls||""}`}>
                  {c.fmt?c.fmt(row[c.key]):row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
  ? "0 10px 26px -18px rgba(0,0,0,.95), 0 2px 6px -4px rgba(0,0,0,.6)"
  : "0 10px 26px -18px rgba(15,23,42,.45), 0 2px 6px -4px rgba(15,23,42,.08)");

const StageCard = ({ icon:Icon, toneName="blue", step, title, caption, stats=[], dm, width="w-[188px]" }) => {
  const t = tone(toneName);
  return (
    <div className={`group relative ${width} shrink-0 rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-1
      ${dm ? "bg-slate-900/90 border-slate-800" : "bg-white border-slate-200/70"}`}
      style={{ boxShadow: cardShadow(dm) }}>
      <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: t.grad }} />
      <span className="pointer-events-none absolute -right-9 -top-9 w-24 h-24 rounded-full blur-2xl opacity-[.16] transition-opacity duration-300 group-hover:opacity-40"
        style={{ background: t.line }} />

      {step != null && (
        <span className="absolute top-2.5 right-2.5 w-[18px] h-[18px] rounded-full text-[9px] font-black flex items-center justify-center text-white"
          style={{ background: t.grad, boxShadow: `0 2px 8px ${t.line}66` }}>{step}</span>
      )}

      <div className="relative p-3">
        <div className="flex items-center gap-2.5 pr-4">
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

const PanelCard = ({ icon:Icon, toneName="blue", title, caption, dm, children }) => {
  const t = tone(toneName);
  return (
    <div className={`rounded-2xl border overflow-hidden ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"}`}
      style={{ boxShadow: cardShadow(dm) }}>
      <div className="relative flex items-center gap-2.5 px-3.5 py-3">
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
  <div className={`flex items-start gap-2.5 rounded-xl px-2.5 py-2 ${dm ? "bg-slate-800/50" : "bg-slate-50"}`}>
    <span className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0"
      style={{ background: `linear-gradient(135deg,${tint}b3,${tint})` }}>
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
        <div className={`p-4 rounded-2xl border shadow-sm ${cardCls}`}>
          <div className="flex items-center justify-between">
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

        <div className={`p-4 rounded-2xl border shadow-sm ${cardCls}`}>
          <div className="flex items-center justify-between">
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

        <div className={`p-4 rounded-2xl border shadow-sm ${cardCls}`}>
          <div className="flex items-center justify-between">
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

        <div className={`p-4 rounded-2xl border shadow-sm ${cardCls}`}>
          <div className="flex items-center justify-between">
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
              className={`text-left relative overflow-hidden bg-gradient-to-br ${medals[idx]} to-transparent border rounded-2xl p-4 shadow-sm hover:shadow-md transition ${dm ? "via-slate-900" : "via-white"}`}
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
      <div className={`rounded-2xl border shadow-sm overflow-hidden ${cardCls}`}>
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

/** Per-vehicle-mode stat card with an accent header, used on the Gate 2 tab. */
const ModeStatCard = ({ title, dm, from, to, rows = [] }) => (
  <div className={`rounded-2xl border overflow-hidden flex flex-col shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)]
    ${dm ? "border-slate-800 bg-slate-900" : "border-slate-200/70 bg-white"}`}>
    <div className="px-3 py-2 flex items-center gap-2 text-white" style={{ background: `linear-gradient(135deg,${from},${to})` }}>
      <span className="w-6 h-6 rounded-lg bg-white/25 flex items-center justify-center shrink-0">
        <Truck className="w-3.5 h-3.5" />
      </span>
      <span className="text-[12px] font-black tracking-wide truncate">{title}</span>
    </div>
    <div className="flex-1 p-2.5 flex flex-col gap-1.5 justify-center">
      {rows.map((r, i) => (
        <div key={i} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 ${dm ? "bg-slate-800/60" : "bg-slate-50"}`}>
          <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: `linear-gradient(180deg,${from},${to})` }} />
          <div className="min-w-0">
            <p className="text-base font-black leading-none tabular-nums" style={{ color: dm ? from : to }}>{r.value}</p>
            <p className={`text-[9px] font-bold mt-1 leading-tight ${dm ? "text-slate-400" : "text-slate-500"}`}>{r.label}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
);

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

/** Shift YYYY-MM-DD by −years (same month/day). */
function shiftYearIso(iso, years = -1) {
  if (!iso || String(iso).length < 10) return iso;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

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
  "challanQty","h","v","caneQty","holding","truckH"
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
    centerPurchaseTrend: arr(data.centerPurchaseTrend),
    centerModePie: arr(data.centerModePie),
    centerOverrunTrend: arr(data.centerOverrunTrend),
    vehicleHandlingTrend: arr(data.vehicleHandlingTrend),
    holdingByCenter: arr(data.holdingByCenter),
    holdingTrend: arr(data.holdingTrend),
    scatterData: arr(data.scatterData),
    transitByCenter: arr(data.transitByCenter),
    truckHoldByCenter: arr(data.truckHoldByCenter),
    centerSidebar: data.centerSidebar ? normalizeRow(data.centerSidebar) : data.centerSidebar,
    topCentersVehicles: arr(data.topCentersVehicles),
    bottomCentersVehicles: arr(data.bottomCentersVehicles),
    centerVehiclesByMode: arr(data.centerVehiclesByMode),
    filterOptions: data.filterOptions || { modes: [], centers: [] },
    prior: data.prior
      ? {
          ...data.prior,
          kpis: data.prior.kpis ? normalizeRow(data.prior.kpis) : data.prior.kpis,
          sidebar: data.prior.sidebar ? normalizeRow(data.prior.sidebar) : data.prior.sidebar,
          centerSidebar: data.prior.centerSidebar ? normalizeRow(data.prior.centerSidebar) : data.prior.centerSidebar,
          overruns: arr(data.prior.overruns),
          cntOverruns: arr(data.prior.cntOverruns),
          procurementFlow: arr(data.prior.procurementFlow),
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
  {id:"database",label:"Database",icon:Database},
];

export default function CanePerformanceDashboard(){
  const[tab,setTab]=useState("procurement");
  const[dm,setDm]=useState(false);
  const[cf,setCf]=useState("All");
  const[liveData, setLiveData] = useState(null);
  const[loading, setLoading] = useState(true);
  
  const[fromDate, setFromDate] = useState("2025-10-24");
  const[toDate, setToDate] = useState("2026-04-06");
  const[modeFilter, setModeFilter] = useState("All");
  const[centerFilter, setCenterFilter] = useState("All");
  const[challanFilter, setChallanFilter] = useState("");
  const[rangePreset, setRangePreset] = useState("Custom"); // MTD | STD | YTD | Custom

  const centerTabs = ["center-purchase","vehicle-handling","vehicle-holding","vehicle-holding2","truck-transit","database"];

  const pyRange = useMemo(() => {
    if (rangePreset !== "MTD" && rangePreset !== "STD" && rangePreset !== "YTD") return null;
    return { from: shiftYearIso(fromDate, -1), to: shiftYearIso(toDate, -1) };
  }, [rangePreset, fromDate, toDate]);

  // Refetch when filters change OR when tab needs different data packs
  const filterKey = useMemo(() => {
    const params = new URLSearchParams({ from: fromDate, to: toDate });
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
    const params = new URLSearchParams({ from: fromDate, to: toDate, tab: tab || "procurement" });
    if (modeFilter && modeFilter !== "All") params.set("mode", modeFilter);
    if (centerTabs.includes(tab) && centerFilter && centerFilter !== "All") params.set("center", centerFilter);
    if (tab === "truck-holding" && challanFilter.trim()) params.set("challan", challanFilter.trim());
    if (pyRange) {
      params.set("pyFrom", pyRange.from);
      params.set("pyTo", pyRange.to);
    }
    return params.toString();
  }, [fromDate, toDate, modeFilter, centerFilter, challanFilter, tab, pyRange]);

  const hasDataRef = React.useRef(false);
  const prevFilterKeyRef = React.useRef(filterKey);

  React.useEffect(() => {
    let cancelled = false;
    const filtersChanged = prevFilterKeyRef.current !== filterKey;
    prevFilterKeyRef.current = filterKey;
    // Spinner on first load and whenever date/mode/center/challan changes (not tab-only)
    if (!hasDataRef.current || filtersChanged) setLoading(true);
    api.get(`/bi/cane-performance/procurement?${queryKey}`)
      .then(res => {
        if (cancelled || res.data.error) return;
        setLiveData(prev => {
          const next = normalizeLiveData(res.data);
          hasDataRef.current = true;
          if (!prev || filtersChanged) return next;
          return {
            ...prev,
            ...next,
            filterOptions: next.filterOptions?.modes?.length ? next.filterOptions : prev.filterOptions,
            modeData: next.modeData?.length ? next.modeData : prev.modeData,
            trendData: next.trendData?.length ? next.trendData : prev.trendData,
            overrunTrend: next.overrunTrend?.length ? next.overrunTrend : prev.overrunTrend,
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
  }, [queryKey, filterKey]);

  // Determine actual data to render based on toggle state
  const handleQuickDate = (type) => {
    // Season end aligns with PBI slicer max (2026-04-06)
    const today = new Date("2026-04-06");
    const year = today.getFullYear();
    const month = today.getMonth();
    
    // STD: Starts from season start (Oct 1st)
    let stdYear = year;
    if (month < 9) stdYear -= 1; 
    const stdStart = new Date(stdYear, 9, 1);
    
    // YTD: Starts from Jan 1st of the current calendar year
    const ytdStart = new Date(year, 0, 1);
    
    // MTD: Starts 1st of current month
    const mtdStart = new Date(year, month, 1);

    const formatDate = (d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    setRangePreset(type);
    setToDate(formatDate(today));
    if (type === 'YTD') setFromDate(formatDate(ytdStart));
    if (type === 'STD') setFromDate(formatDate(stdStart));
    if (type === 'MTD') setFromDate(formatDate(mtdStart));
  };

  const showCompare = rangePreset === "MTD" || rangePreset === "STD" || rangePreset === "YTD";
  const prior = showCompare ? liveData?.prior : null;
  const pyLabel = rangePreset ? `vs PY ${rangePreset}` : "vs PY";
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

  const actualGate1Daily = liveData?.trendData
    ? liveData.trendData.map(t => ({ date: String(t.date).substring(5,10), qty: t.qty }))
    : gate1Daily;

  const proc = React.useMemo(() => {
    if (!liveData?.procurementFlow) return null;
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
      gateVehicles: mapTbl(gateYard),
      centerVehicles: mapTbl(center),
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

  const bg=dm?"bg-slate-950 text-slate-100":"bg-slate-50 text-slate-800";
  const hdr=dm?"bg-slate-900 border-slate-800":"bg-white border-slate-200/80";

  return(
    <div className={`min-h-screen ${bg} transition-colors duration-200`}>
      <header className={`sticky top-0 z-20 ${hdr} border-b shadow-sm px-4 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-green-600 to-emerald-700 flex items-center justify-center shadow">
            <Activity className="w-4 h-4 text-white"/>
          </div>
          <div>
            <h1 className={`text-base font-black ${dm?"text-slate-100":"text-slate-900"}`}>Cane Performance Analytics</h1>
            <p className={`text-[10px] font-bold ${dm?"text-slate-500":"text-slate-400"}`}>
              Procurement · Gate · Transit · Holding
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 mr-1">
            {['MTD', 'STD', 'YTD'].map(type => (
              <button
                key={type}
                type="button"
                onClick={() => handleQuickDate(type)}
                aria-pressed={rangePreset === type}
                className={`px-2.5 py-1 text-[10px] font-extrabold tracking-wide rounded-md transition-all
                  ${rangePreset === type
                    ? 'bg-blue-600 text-white border border-blue-600 shadow-sm ring-2 ring-blue-300/70'
                    : dm
                    ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                    : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 shadow-sm'}`}
              >
                {type}
              </button>
            ))}
          </div>
          {showModeFilter && (
            <label className="flex flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${labelCls}`}>Transport Mode</span>
              <select value={modeFilter} onChange={e => setModeFilter(e.target.value)}
                className={`text-xs px-2 py-1 rounded border outline-none min-w-[120px] ${selectCls}`}>
                <option value="All">All</option>
                {modeOptions.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          )}
          {showCenterFilter && (
            <label className="flex flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${labelCls}`}>Center</span>
              <select value={centerFilter} onChange={e => setCenterFilter(e.target.value)}
                className={`text-xs px-2 py-1 rounded border outline-none min-w-[140px] max-w-[180px] ${selectCls}`}>
                <option value="All">All</option>
                {centerOptions.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          )}
          {showChallanFilter && (
            <label className="flex flex-col gap-0.5">
              <span className={`text-[9px] font-bold uppercase tracking-wide ${labelCls}`}>Challan No.</span>
              <input type="text" placeholder="All" value={challanFilter}
                onChange={e => setChallanFilter(e.target.value)}
                className={`text-xs px-2 py-1 rounded border outline-none w-[110px] ${selectCls}`} />
            </label>
          )}
          <label className="flex flex-col gap-0.5">
            <span className={`text-[9px] font-bold uppercase tracking-wide ${labelCls}`}>Date Range</span>
            <div className="flex items-center gap-1.5">
              <input type="date" value={fromDate} onChange={e => { setRangePreset("Custom"); setFromDate(e.target.value); }} className={`text-xs px-2 py-1 rounded border outline-none ${selectCls}`} />
              <span className={`text-xs font-bold ${labelCls}`}>to</span>
              <input type="date" value={toDate} onChange={e => { setRangePreset("Custom"); setToDate(e.target.value); }} className={`text-xs px-2 py-1 rounded border outline-none ${selectCls}`} />
            </div>
          </label>
          <button onClick={()=>setDm(!dm)} className={`p-2 rounded-xl border self-end ${dm?"border-slate-700 bg-slate-800 text-yellow-400":"border-slate-200 bg-slate-100 text-slate-600"}`}>
            {dm?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}
          </button>
        </div>
      </header>

      <div className={`sticky top-[57px] z-10 ${hdr} border-b px-4 overflow-x-auto`}>
        <div className="flex gap-1 py-2 min-w-max">
          {TABS.map(t=>{const I=t.icon;return(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${tab===t.id?"bg-gradient-to-r from-blue-600 to-sky-500 text-white shadow-md shadow-blue-500/30":(dm?"text-slate-400 hover:bg-slate-800":"text-slate-600 hover:bg-slate-100")}`}>
              <I className="w-3.5 h-3.5"/>{t.label}
            </button>
          );})}
        </div>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 py-5 relative min-h-[60vh]">
        {loading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/60 dark:bg-slate-950/60 backdrop-blur-sm rounded-2xl">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              <p className={`text-sm font-bold ${dm ? "text-slate-300" : "text-slate-600"}`}>Loading data...</p>
            </div>
          </div>
        )}

        {tab==="procurement"&&(
          <div className="space-y-4">
            <style>{`
              @keyframes caneDot { 0%{left:-8%;opacity:0} 18%{opacity:1} 82%{opacity:1} 100%{left:100%;opacity:0} }
              .cane-dot{animation:caneDot 1.9s linear infinite}
              @keyframes dashFlow { to{stroke-dashoffset:-36} }
              .dash-flow{animation:dashFlow 1.1s linear infinite}
              @keyframes beltMove { to{background-position:24px 0} }
              .belt{background-color:${dm ? "#334155" : "#cbd5e1"};background-image:repeating-linear-gradient(115deg,${dm ? "#64748b" : "#94a3b8"} 0 6px,transparent 6px 24px);animation:beltMove .8s linear infinite}
              @keyframes caneRide { 0%{left:-12%;opacity:0} 15%{opacity:1} 85%{opacity:1} 100%{left:100%;opacity:0} }
              .cane-ride{animation:caneRide 2.2s linear infinite}
              @keyframes spinSlow { to{transform:rotate(360deg)} }
              .spin-slow{animation:spinSlow 4s linear infinite}
              @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.45;transform:scale(.75)} }
              .pulse-dot{animation:pulseDot 1.6s ease-in-out infinite}
              @media (prefers-reduced-motion:reduce){
                .cane-dot,.dash-flow,.belt,.cane-ride,.spin-slow,.pulse-dot{animation:none}
              }
            `}</style>

            {/* ─── Process flow ribbon ──────────────────────────────── */}
            <div className={`relative rounded-3xl border overflow-hidden ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"}`}
              style={{ boxShadow: cardShadow(dm) }}>
              <div className="relative flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                style={{ background: dm
                  ? "linear-gradient(120deg,#0f172a 0%,#152447 55%,#0f172a 100%)"
                  : "linear-gradient(120deg,#1e3a8a 0%,#2563eb 55%,#0ea5e9 100%)" }}>
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/25">
                    <GitMerge className="w-[18px] h-[18px] text-white" />
                  </span>
                  <div>
                    <p className="text-[13px] font-black text-white leading-tight">Cane Movement Flow</p>
                    <p className="text-[10px] font-semibold text-white/70">
                      Farm → Centres &amp; Gate → Yard → Weighbridge → Mill House → 5 Mills
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-bold">
                  {[["Centre route","bg-cyan-400"],["Gate route","bg-amber-400"],["Crushing","bg-emerald-400"]].map(([txt,dot])=>(
                    <span key={txt} className="flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/20 px-2.5 py-1 text-white/90">
                      <span className={`w-2 h-2 rounded-full ${dot}`} /> {txt}
                    </span>
                  ))}
                </div>
              </div>

              <div className="relative overflow-x-auto p-5">
                <span className="pointer-events-none absolute inset-0" style={{
                  backgroundImage: `radial-gradient(${dm ? "#1e293b" : "#e2e8f0"} 1px, transparent 1px)`,
                  backgroundSize: "18px 18px" }} />
                <span className="pointer-events-none absolute inset-0" style={{
                  background: dm
                    ? "linear-gradient(180deg, rgba(30,58,138,.16), transparent 60%)"
                    : "linear-gradient(180deg, rgba(59,130,246,.07), transparent 55%)" }} />
                <div className="relative flex items-stretch min-w-[1300px]">
                  <StageCard dm={dm} step={1} icon={Sprout} toneName="emerald"
                    title="Sugar Cane" caption="Harvest from farms"
                    stats={[
                      {label:"Cane (Qtl)", value: proc ? compact(flowStats.totalCane) : "—"},
                      {label:"Vehicles", value: proc ? compact(flowStats.totalVeh) : "—"},
                    ]} />

                  <FlowBranch color={dm ? "#334155" : "#e2e8f0"} accent="#10b981" />

                  <div className="flex flex-col justify-center gap-3">
                    <StageCard dm={dm} step={2} icon={MapPin} toneName="cyan"
                      title="Purchase Centres" caption="Village collection points"
                      stats={[
                        {label:"Cane (Qtl)", value: proc ? compact(flowStats.centerCane) : "—"},
                        {label:"Trips", value: proc ? compact(proc.centerTrips) : "—"},
                        {label:"Hold (H)", value: proc ? fmt(proc.avgCenterWait) : "—"},
                      ]} />
                    <StageCard dm={dm} step={2} icon={DoorOpen} toneName="amber"
                      title="Factory Gate" caption="Direct grower supply"
                      stats={[
                        {label:"Cane (Qtl)", value: proc ? compact(flowStats.gateCane) : "—"},
                        {label:"Vehicles", value: proc ? compact(flowStats.gateVeh) : "—"},
                      ]} />
                  </div>

                  <FlowBranch color={dm ? "#334155" : "#e2e8f0"} accent="#8b5cf6" merge />

                  <StageCard dm={dm} step={3} icon={Warehouse} toneName="violet"
                    title="Yard" caption="Vehicle queue before weighment"
                    stats={[
                      {label:"Wait (H)", value: proc ? fmt(proc.avgYardWait) : "—"},
                      {label:"Dev >8H", value: proc && flowStats.yardDev != null ? compact(flowStats.yardDev) : "—"},
                    ]} />

                  <FlowArrow color="#8b5cf6" label="Weigh in" />

                  <StageCard dm={dm} step={4} icon={Scale} toneName="blue"
                    title="Weighbridge" caption="Entry gate weighment"
                    stats={[
                      {label:"Cane Hold (H)", value: proc ? fmt(proc.caneHolding) : "—"},
                      {label:"Challans", value: proc ? compact(actualProcurementCards.totalChallan) : "—"},
                    ]} />

                  <FlowArrow color="#3b82f6" label="Unload" />

                  <StageCard dm={dm} step={5} icon={Factory} toneName="rose"
                    title="Mill House" caption="Donga / feeder table"
                    stats={[
                      {label:"Donga (H)", value: proc ? fmt(proc.avgDongaWait) : "—"},
                      {label:"Dev >0.5H", value: proc && flowStats.millDev != null ? compact(flowStats.millDev) : "—"},
                    ]} />

                  <Conveyor dm={dm} />

                  <MillBank dm={dm} count={5} />
                </div>
              </div>
            </div>

            {/* ─── Stage detail panels ──────────────────────────────── */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">

              <PanelCard dm={dm} icon={Truck} toneName="cyan"
                title="Step 1–2 · Sourcing" caption="Cane leaving the farm via Gate and Centres">
                <div>
                  <SubLabel color="#f59e0b">Gate vehicles · direct supply</SubLabel>
                  <DTable darkMode={dm} cols={[
                    {key:"mode",label:"Mode",bold:true},{key:"veh",label:"Vehicles",cls:"text-right"},{key:"cane",label:"Cane (Q)",cls:"text-right"},{key:"time",label:"Time (Hrs)",cls:"text-right"}
                  ]} rows={proc ? proc.gateVehicles : [
                    {mode:"63 QTROLLY",veh:"10,596",cane:"7,60,907.00",time:"-"},
                    {mode:"18 QCART",veh:"4,606",cane:"97,886.00",time:"-"},
                    {mode:"99 QTROLLY",veh:"699",cane:"74,057.00",time:"-"},
                    {mode:"36 QTROLLY",veh:"1,366",cane:"53,449.00",time:"-"},
                    {mode:"Total",veh:"17,272",cane:"9,86,557.00",time:"-",cls:"font-black"}
                  ]}/>
                </div>
                <div>
                  <SubLabel color="#06b6d4">Centre vehicles · collection feed</SubLabel>
                  <DTable darkMode={dm} cols={[
                    {key:"mode",label:"Mode",bold:true},{key:"veh",label:"Vehicles",cls:"text-right"},{key:"cane",label:"Cane (Q)",cls:"text-right"},{key:"time",label:"Time (Hrs)",cls:"text-right"}
                  ]} rows={proc ? proc.centerVehicles : [
                    {mode:"45 QTROLLY",veh:"18,254",cane:"9,59,139.00",time:"-"},
                    {mode:"18 QCART",veh:"26,906",cane:"5,74,364.00",time:"-"},
                    {mode:"63 QTROLLY",veh:"277",cane:"18,937.00",time:"-"},
                    {mode:"36 QTROLLY",veh:"63",cane:"2,656.00",time:"-"},
                    {mode:"Total",veh:"45,500",cane:"15,55,096.00",time:"-",cls:"font-black"}
                  ]}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile dm={dm} toneName="cyan" label="Centre Trips"
                    value={proc ? n(proc.centerTrips).toLocaleString("en-IN") : "6,472"} />
                  <StatTile dm={dm} toneName="cyan" label="Centre Holding" unit="H"
                    value={proc ? fmt(proc.avgCenterWait) : "3.04"} />
                </div>
              </PanelCard>

              <PanelCard dm={dm} icon={Warehouse} toneName="violet"
                title="Step 3 · Yard" caption="Waiting inside the yard before weighment">
                <div>
                  <SubLabel color="#8b5cf6">Yard waiting by mode</SubLabel>
                  <DTable darkMode={dm} cols={[
                    {key:"mode",label:"Mode",bold:true},{key:"avg",label:"Avg Time",cls:"text-right"},{key:"dev",label:"Dev. (>8H)",cls:"text-right"}
                  ]} rows={proc ? proc.yardGate : [
                    {mode:"18 QCART",avg:"9.25",dev:"1671"},
                    {mode:"36 QTROLLY",avg:"7.18",dev:"368"},
                    {mode:"45 QTROLLY",avg:"14.78",dev:"3"},
                    {mode:"63 QTROLLY",avg:"8.58",dev:"3596"},
                    {mode:"99 QTROLLY",avg:"11.40",dev:"319"},
                    {mode:"Total",avg:"8.77",dev:"5957",cls:"font-black"}
                  ]}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile dm={dm} toneName="violet" label="Yard Waiting" unit="H"
                    value={proc ? fmt(proc.avgYardWait) : "7.93"}>
                    {prior?.kpis && (
                      <PyBadge curr={proc?.avgYardWait} prior={prior.kpis.yardWaiting} lowerBetter dm={dm} label={pyLabel} />
                    )}
                  </StatTile>
                  <StatTile dm={dm} toneName="amber" label="Truck Holding" unit="H"
                    value={proc ? fmt(actualProcurementCards.truckHolding) : "4.02"}>
                    {prior?.kpis && (
                      <PyBadge curr={actualProcurementCards.truckHolding} prior={prior.kpis.truckHolding} lowerBetter dm={dm} label={pyLabel} />
                    )}
                  </StatTile>
                </div>
                <div>
                  <SubLabel color="#06b6d4">Centre holding time by mode</SubLabel>
                  <DTable darkMode={dm} cols={[
                    {key:"mode",label:"Mode",bold:true},{key:"h",label:"Holding Time (H)",cls:"text-right"}
                  ]} rows={proc ? proc.centerHolding : [
                    {mode:"18 QCART",h:"3.08"},{mode:"36 QTROLLY",h:"2.69"},
                    {mode:"45 QTROLLY",h:"2.78"},{mode:"63 QTROLLY",h:"2.04"},
                    {mode:"Total",h:"2.95",cls:"font-black"}
                  ]}/>
                </div>
              </PanelCard>

              <PanelCard dm={dm} icon={Factory} toneName="rose"
                title="Step 4–5 · Mill Premise" caption="Weighbridge → Donga → conveyor → 5 mills">
                <div className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 overflow-hidden
                  ${dm?"border-slate-800 bg-slate-800/40":"border-blue-100 bg-blue-50/70"}`}>
                  <span className="absolute inset-y-0 left-0 w-1" style={{background:"linear-gradient(180deg,#60a5fa,#2563eb)"}} />
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{background:"linear-gradient(135deg,#60a5fa,#2563eb)"}}>
                    <Scale className="w-4 h-4" />
                  </span>
                  <span className={`text-[10px] font-bold ${dm?"text-slate-300":"text-blue-800"}`}>Factory entry gate weighbridge</span>
                </div>
                <div>
                  <SubLabel color="#f43f5e">Unloading at donga by mode</SubLabel>
                  <DTable darkMode={dm} cols={[
                    {key:"mode",label:"Mode",bold:true},{key:"avg",label:"Avg Time",cls:"text-right"},{key:"dev",label:"Dev (>0.5H)",cls:"text-right"}
                  ]} rows={proc ? proc.mill : [
                    {mode:"18 QCART",avg:"0.37",dev:"727"},
                    {mode:"36 QTROLLY",avg:"0.42",dev:"384"},
                    {mode:"45 QTROLLY",avg:"0.59",dev:"3"},
                    {mode:"63 QTROLLY",avg:"0.60",dev:"5988"},
                    {mode:"99 QTROLLY",avg:"0.60",dev:"366"},
                    {mode:"Total",avg:"0.52",dev:"7468",cls:"font-black"}
                  ]}/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <StatTile dm={dm} toneName="blue" label="Cane Holding" unit="H"
                    value={proc ? fmt(proc.caneHolding) : "15.19"}>
                    {prior?.kpis && (
                      <PyBadge curr={proc?.caneHolding} prior={prior.kpis.caneHolding} lowerBetter dm={dm} label={pyLabel} />
                    )}
                  </StatTile>
                  <StatTile dm={dm} toneName="rose" label="Time at Donga" unit="H"
                    value={proc ? fmt(proc.avgDongaWait) : "1.12"}>
                    {prior?.kpis && (
                      <PyBadge curr={proc?.avgDongaWait} prior={prior.kpis.waCane} lowerBetter dm={dm} label={pyLabel} />
                    )}
                  </StatTile>
                </div>
                <div className={`relative flex items-center gap-2.5 rounded-xl border px-3 py-2.5 overflow-hidden
                  ${dm?"border-emerald-500/30 bg-emerald-500/10":"border-emerald-200 bg-emerald-50/70"}`}>
                  <span className="absolute inset-y-0 left-0 w-1" style={{background:"linear-gradient(180deg,#34d399,#059669)"}} />
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-white shrink-0"
                    style={{background:"linear-gradient(135deg,#34d399,#059669)"}}>
                    <Cog className="w-4 h-4 spin-slow" />
                  </span>
                  <span className={`text-[10px] font-bold leading-tight ${dm?"text-emerald-400":"text-emerald-800"}`}>
                    Cane fed to Mill 1 → Mill 5 via conveyor
                  </span>
                  <span className="ml-auto flex items-center gap-1.5 shrink-0">
                    <span className="pulse-dot w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Live</span>
                  </span>
                </div>
              </PanelCard>
            </div>
          </div>
        )}

        {tab==="gate1"&&(
          <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Sidebar KPIs */}
            <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-4">
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden text-center shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)]`}>
                <div className={`py-1.5 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}><span className="flex items-center justify-center gap-1.5"><Sprout className="w-3.5 h-3.5"/>Cane Purchased</span></div>
                <div className="py-6 flex flex-col items-center">
                  <p className={`text-4xl font-black ${dm?"text-slate-100":"text-slate-800"}`}>{liveData?.sidebar ? (n(liveData.sidebar.totalCanePurchased) >= 1e6 ? (n(liveData.sidebar.totalCanePurchased)/1e6).toFixed(2)+"M" : (n(liveData.sidebar.totalCanePurchased)/1e3).toFixed(2)+"K") : "—"}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Quintals</p>
                  {prior?.sidebar && (
                    <PyBadge curr={liveData?.sidebar?.totalCanePurchased} prior={prior.sidebar.totalCanePurchased} dm={dm} label={pyLabel} />
                  )}
                </div>
              </div>
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden text-center shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)]`}>
                <div className={`py-1.5 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}><span className="flex items-center justify-center gap-1.5"><BarChart2 className="w-3.5 h-3.5"/>No. of Purchy</span></div>
                <div className="py-6 flex flex-col items-center">
                  <p className={`text-4xl font-black ${dm?"text-slate-100":"text-slate-800"}`}>{liveData?.sidebar ? (n(liveData.sidebar.noOfPurchy) >= 1e3 ? (n(liveData.sidebar.noOfPurchy)/1e3).toFixed(2)+"K" : String(n(liveData.sidebar.noOfPurchy))) : "—"}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Purchies</p>
                  {prior?.sidebar && (
                    <PyBadge curr={liveData?.sidebar?.noOfPurchy} prior={prior.sidebar.noOfPurchy} dm={dm} label={pyLabel} />
                  )}
                </div>
              </div>
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden text-center shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)]`}>
                <div className={`py-1.5 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}><span className="flex items-center justify-center gap-1.5"><Scale className="w-3.5 h-3.5"/>Avg Purchy Size</span></div>
                <div className="py-6 flex flex-col items-center">
                  <p className={`text-5xl font-black ${dm?"text-slate-100":"text-slate-800"}`}>{liveData?.sidebar ? fmt(liveData.sidebar.avgPurchySize) : "—"}</p>
                  <p className="text-[11px] text-slate-500 mt-2">Quintals</p>
                  {prior?.sidebar && (
                    <PyBadge curr={liveData?.sidebar?.avgPurchySize} prior={prior.sidebar.avgPurchySize} dm={dm} label={pyLabel} />
                  )}
                </div>
              </div>
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden text-center shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex-1`}>
                <div className={`py-1.5 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}><span className="flex items-center justify-center gap-1.5"><ArrowRightLeft className="w-3.5 h-3.5"/>Avg Purchi Overrun (Qtls)</span></div>
                <div className="py-4 px-2 grid grid-cols-2 gap-y-6 gap-x-2">
                  {(liveData?.overruns || []).map((o, i) => (
                    <div key={i} className="flex flex-col items-center">
                      <p className="text-xl font-black bg-gradient-to-br from-[#60a5fa] to-[#2563eb] bg-clip-text text-transparent">{fmt(o.avgOverrun)}</p>
                      <p className={`text-[10px] font-bold ${dm?"text-slate-400":"text-slate-600"}`}>{o.mode.toUpperCase()}</p>
                      {prior && priorOverrun[o.mode] != null && (
                        <PyBadge curr={o.avgOverrun} prior={priorOverrun[o.mode]} lowerBetter dm={dm} label={pyLabel} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Area Charts */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}>Purchase Split - Mode wise</div>
                <div className="flex-1 min-h-[260px]">
                  <ModeDonut dm={dm} unit="Qtls" title="Cane"
                    data={actualModePie.map(m => ({ name: m.mode, value: m.qty, color: m.color }))} />
                </div>
              </div>

              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}>Cane Purchase Trend</div>
                <div className="flex-1 p-4 min-h-[220px]">
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={actualGate1Daily}>
                      <defs>
                        <linearGradient id="colorQty" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={T(dm)} dy={10}/>
                      <YAxis tickFormatter={v=>(v/1000).toFixed(1)+"k"} tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                      <Tooltip formatter={v=>v.toLocaleString()+" Qtls"} {...TT(dm)}/>
                      <Area type="monotone" dataKey="qty" stroke="#3b82f6" fill="url(#colorQty)" strokeWidth={2}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}>Purchi Overrun Trend (Qtls)</div>
                <div className="flex-1 p-2 min-h-[220px]">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={(() => {
                      const raw = liveData?.overrunTrend || [];
                      const byDate = {};
                      raw.forEach(r => {
                        const d = String(r.date).substring(5,10);
                        if (!byDate[d]) byDate[d] = { date: d };
                        if (r.mode?.includes('18')) byDate[d].c18 = r.avgOverrun;
                        else if (r.mode?.includes('36')) byDate[d].c36 = r.avgOverrun;
                        else if (r.mode?.includes('63')) byDate[d].c63 = r.avgOverrun;
                        else if (r.mode?.includes('99')) byDate[d].c99 = r.avgOverrun;
                      });
                      return Object.values(byDate).slice(-15);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={T(dm)} dy={10}/>
                      <YAxis tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                      <Tooltip {...TT(dm)}/>
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize:10}}/>
                      <Line type="linear" dataKey="c18" name="18 QCART" stroke="#1e88e5" strokeWidth={2.5} dot={false}/>
                      <Line type="linear" dataKey="c36" name="36 QTROLLY" stroke="#0d47a1" strokeWidth={2.5} dot={false}/>
                      <Line type="linear" dataKey="c63" name="63 QTROLLY" stroke="#f57c00" strokeWidth={2.5} dot={false}/>
                      <Line type="linear" dataKey="c99" name="99 QTRUCK" stroke="#6a1b9a" strokeWidth={2.5} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}>No. of Vehicles</div>
                <div className="flex-1 p-4 min-h-[220px]">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={(liveData?.vehiclesByMode || []).map(m => ({ mode: m.mode, v: +(m.vehicles / 1000).toFixed(1) }))}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                      <XAxis dataKey="mode" tickLine={false} axisLine={false} tick={T(dm)} dy={10}/>
                      <YAxis tickFormatter={v=>v+"K"} tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                      <Tooltip formatter={v=>v+"K"} {...TT(dm)}/>
                      <Bar dataKey="v" fill="#2196f3" barSize={40}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab==="gate2"&&(
          <div className="h-full flex flex-col gap-3">
            <div className="grid grid-cols-4 gap-3 flex-1 min-h-[300px]">
              <ModeStatCard title="18 QCART" dm={dm} from="#60a5fa" to="#1e88e5" rows={[
                { label: "No. of Carts", value: proc ? proc.gate2.cart18.trips || 0 : 4606 },
                { label: "Min Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.cart18.minYardWait) : 0.03 },
                { label: "Avg Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.cart18.avgYardWait) : 9.25 },
                { label: "Max Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.cart18.maxYardWait) : 39.47 },
                { label: "Vehicles exceeding Holding Time", value: proc ? ((proc.gate2.cart18.devGateYard || 0) + (proc.gate2.cart18.devCenterYard || 0)) : 1671 },
              ]} />
              <ModeStatCard title="36 QTROLLY" dm={dm} from="#5c8ee6" to="#0d47a1" rows={[
                { label: "No. of Trollies", value: proc ? proc.gate2.trolly36.trips || 0 : 1366 },
                { label: "Min Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.trolly36.minYardWait) : 0.03 },
                { label: "Avg Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.trolly36.avgYardWait) : 7.18 },
                { label: "Max Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.trolly36.maxYardWait) : 32.67 },
                { label: "Vehicles exceeding Holding Time", value: proc ? ((proc.gate2.trolly36.devGateYard || 0) + (proc.gate2.trolly36.devCenterYard || 0)) : 368 },
              ]} />
              {/* Average Yard Holding Time */}
              <div className={`col-span-2 rounded-2xl border overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} flex flex-col`}>
                <div className={`py-1.5 px-2 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}>Average Yard Holding Time</div>
                <div className="flex-1 p-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={(() => {
                      const raw = liveData?.holdingTrend || [];
                      const byDate = {};
                      raw.forEach(r => {
                        const d = String(r.date).substring(5,10);
                        if (!byDate[d]) byDate[d] = { date: d };
                        if (r.mode?.includes('18')) byDate[d].c18 = r.holdingHrs;
                        else if (r.mode?.includes('36')) byDate[d].c36 = r.holdingHrs;
                        else if (r.mode?.includes('63')) byDate[d].c63 = r.holdingHrs;
                        else if (r.mode?.includes('99')) byDate[d].c99 = r.holdingHrs;
                      });
                      return Object.values(byDate).slice(-20);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={T(dm)} dy={5}/>
                      <YAxis tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                      <Tooltip {...TT(dm)}/>
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize:10}}/>
                      <Line type="linear" dataKey="c18" name="18 QCART" stroke="#1e88e5" strokeWidth={2} dot={false}/>
                      <Line type="linear" dataKey="c36" name="36 QTROLLY" stroke="#0d47a1" strokeWidth={2} dot={false}/>
                      <Line type="linear" dataKey="c63" name="63 QTROLLY" stroke="#f57c00" strokeWidth={2} dot={false}/>
                      <Line type="linear" dataKey="c99" name="99 QTRUCK" stroke="#6a1b9a" strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 flex-1 min-h-[300px]">
              <ModeStatCard title="63 QTROLLY" dm={dm} from="#fbbf24" to="#f57c00" rows={[
                { label: "No. of Trollies", value: proc ? proc.gate2.trolly63.trips || 0 : 10596 },
                { label: "Min Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.trolly63.minYardWait) : 0.02 },
                { label: "Avg Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.trolly63.avgYardWait) : 8.58 },
                { label: "Max Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.trolly63.maxYardWait) : 28.97 },
                { label: "Vehicles exceeding Holding Time", value: proc ? ((proc.gate2.trolly63.devGateYard || 0) + (proc.gate2.trolly63.devCenterYard || 0)) : 3596 },
              ]} />
              <ModeStatCard title="99 QTRUCK" dm={dm} from="#c084fc" to="#6a1b9a" rows={[
                { label: "No. of Trucks", value: proc ? proc.gate2.truck99.trips || 0 : 699 },
                { label: "Min Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.truck99.minYardWait) : 0.05 },
                { label: "Avg Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.truck99.avgYardWait) : 11.40 },
                { label: "Max Yard Holding Time (Hrs)", value: proc ? fmt(proc.gate2.truck99.maxYardWait) : 26.48 },
                { label: "Vehicles exceeding Holding Time", value: proc ? ((proc.gate2.truck99.devGateYard || 0) + (proc.gate2.truck99.devCenterYard || 0)) : 319 },
              ]} />
              {/* Vehicles exceeding the Standard Holding Time */}
              <div className={`col-span-2 rounded-2xl border overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} flex flex-col`}>
                <div className={`py-1.5 px-2 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-[#0f3f7a] via-[#1d63c4] to-[#2f8fe0] text-white"}`}>Vehicles exceeding the Standard Holding Time</div>
                <div className="flex-1 p-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={(() => {
                      const raw = liveData?.overrunTrend || [];
                      const byDate = {};
                      raw.forEach(r => {
                        const d = String(r.date).substring(5,10);
                        if (!byDate[d]) byDate[d] = { date: d };
                        if (r.mode?.includes('18')) byDate[d].c18 = Math.abs(r.avgOverrun || 0);
                        else if (r.mode?.includes('36')) byDate[d].c36 = Math.abs(r.avgOverrun || 0);
                        else if (r.mode?.includes('63')) byDate[d].c63 = Math.abs(r.avgOverrun || 0);
                        else if (r.mode?.includes('99')) byDate[d].c99 = Math.abs(r.avgOverrun || 0);
                      });
                      return Object.values(byDate).slice(-15);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={T(dm)} dy={5}/>
                      <YAxis tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                      <Tooltip {...TT(dm)}/>
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize:10}}/>
                      <Bar dataKey="c18" name="18 QCART" fill="#1e88e5" barSize={8}/>
                      <Bar dataKey="c36" name="36 QTROLLY" fill="#0d47a1" barSize={8}/>
                      <Bar dataKey="c63" name="63 QTROLLY" fill="#f57c00" barSize={8}/>
                      <Bar dataKey="c99" name="99 QTRUCK" fill="#6a1b9a" barSize={8}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab==="center-purchase"&&(
          <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Sidebar KPIs */}
            <div className="w-full lg:w-[280px] shrink-0 flex flex-col gap-4">
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)]`}>
                <div className="p-3 flex flex-col gap-2.5">
                  <SideStat dm={dm} icon={Sprout} tint="#16a34a" label="Cane Purchased (Qtls)"
                    value={liveData?.centerSidebar ? n(liveData.centerSidebar.totalCanePurchased).toLocaleString("en-IN",{maximumFractionDigits:2}) : "—"}>
                    {prior?.centerSidebar && (
                      <PyBadge curr={liveData?.centerSidebar?.totalCanePurchased} prior={prior.centerSidebar.totalCanePurchased} dm={dm} label={pyLabel} />
                    )}
                  </SideStat>
                  <SideStat dm={dm} icon={BarChart2} tint="#2563eb" label="No. of Purchy"
                    value={liveData?.centerSidebar ? n(liveData.centerSidebar.noOfPurchy).toLocaleString("en-IN") : "—"}>
                    {prior?.centerSidebar && (
                      <PyBadge curr={liveData?.centerSidebar?.noOfPurchy} prior={prior.centerSidebar.noOfPurchy} dm={dm} label={pyLabel} />
                    )}
                  </SideStat>
                  <SideStat dm={dm} icon={Scale} tint="#7c3aed" label="Avg Parchi Size (Qtls)"
                    value={liveData?.centerSidebar ? fmt(liveData.centerSidebar.avgParchiSize) : "—"}>
                    {prior?.centerSidebar && (
                      <PyBadge curr={liveData?.centerSidebar?.avgParchiSize} prior={prior.centerSidebar.avgParchiSize} dm={dm} label={pyLabel} />
                    )}
                  </SideStat>
                  <SideStat dm={dm} icon={Truck} tint="#ea580c" label="Trips (C to G)"
                    value={liveData?.centerSidebar ? n(liveData.centerSidebar.trips).toLocaleString("en-IN") : "—"}>
                    {prior?.centerSidebar && (
                      <PyBadge curr={liveData?.centerSidebar?.trips} prior={prior.centerSidebar.trips} dm={dm} label={pyLabel} />
                    )}
                  </SideStat>
                </div>
              </div>
              
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex-1`}>
                <div className={`py-1.5 font-bold px-3 text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Avg Parchi Overrun (Qtls)</div>
                <div className="p-4 flex flex-col gap-4">
                  {(liveData?.cntOverruns || []).map((o, i) => (
                    <div key={i}>
                      <p className="text-2xl font-black bg-gradient-to-br from-[#60a5fa] to-[#2563eb] bg-clip-text text-transparent">{fmt(o.avgOverrun)}</p>
                      <p className={`text-[10px] font-bold ${dm?"text-slate-400":"text-slate-600"}`}>{o.mode.toUpperCase()}</p>
                      {prior && priorCntOverrun[o.mode] != null && (
                        <PyBadge curr={o.avgOverrun} prior={priorCntOverrun[o.mode]} lowerBetter dm={dm} label={pyLabel} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Area Charts */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 flex flex-col gap-4">
                <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col h-[200px]`}>
                  <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Cane Purchase Trend</div>
                  <div className="flex-1 p-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={(liveData?.centerPurchaseTrend || []).map(t => ({ date: String(t.date).substring(5,10), qty: t.qty }))}>
                        <defs><linearGradient id="colorCPT" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#e67c32" stopOpacity={0.3}/><stop offset="95%" stopColor="#e67c32" stopOpacity={0}/></linearGradient></defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={T(dm)} dy={5}/>
                        <YAxis tickFormatter={v=>(v/1000).toFixed(1)+"k"} tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                        <Tooltip formatter={v=>v.toLocaleString()+" Qtls"} {...TT(dm)}/>
                        <Area type="monotone" dataKey="qty" stroke="#e67c32" fill="url(#colorCPT)" strokeWidth={2}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col h-[240px]`}>
                  <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Top 10 Centers - Cane Purchase Q)</div>
                  <div className="flex-1 p-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={(liveData?.topCenters || []).map(x => ({
                        c: String(x.c || "").substring(0, 10),
                        q: n(x.cane),
                        a: n(x.avgParchi)
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                        <XAxis dataKey="c" tickLine={false} axisLine={false} tick={T(dm)} dy={5} angle={-30} textAnchor="end"/>
                        <YAxis yAxisId="left" tickFormatter={v=>v/1000+"K"} tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                        <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={T(dm)} dx={10}/>
                        <Tooltip {...TT(dm)}/>
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize:10}}/>
                        <Bar yAxisId="left" dataKey="q" name="Cane Purchased (Qtls)" fill="#f4c7c3" barSize={30}/>
                        <Line yAxisId="right" type="linear" dataKey="a" name="Avg Parchi Size" stroke="#000080" strokeWidth={2}/>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col h-[240px]`}>
                  <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Bottom 10 Centers - Cane Purchase (Q)</div>
                  <div className="flex-1 p-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <ComposedChart data={(liveData?.bottomCenters || []).map(x => ({
                        c: String(x.c || "").substring(0, 10),
                        q: n(x.cane),
                        a: n(x.avgParchi)
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                        <XAxis dataKey="c" tickLine={false} axisLine={false} tick={T(dm)} dy={5} angle={-30} textAnchor="end"/>
                        <YAxis yAxisId="left" tickFormatter={v=>v/1000+"K"} tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                        <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={T(dm)} dx={10}/>
                        <Tooltip {...TT(dm)}/>
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize:10}}/>
                        <Bar yAxisId="left" dataKey="q" name="Cane Purchased (Qtls)" fill="#f4c7c3" barSize={30}/>
                        <Line yAxisId="right" type="linear" dataKey="a" name="Avg Parchi Size" stroke="#000080" strokeWidth={2}/>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              <div className="md:col-span-1 flex flex-col gap-4">
                <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col h-[320px]`}>
                  <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Purchase Split - Modewise</div>
                  <div className="flex-1 min-h-0">
                    <ModeDonut dm={dm} unit="Qtls" title="Cane"
                      data={(liveData?.centerModePie || []).map(m => ({
                        name: m.mode, value: m.caneQty, color: modeColor(m.mode)
                      }))} />
                  </div>
                </div>
                <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col h-[240px]`}>
                  <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Parchi Overrun Trend (Qtls)</div>
                  <div className="flex-1 p-2">
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={(() => {
                        const raw = liveData?.centerOverrunTrend || [];
                        const byDate = {};
                        raw.forEach(r => {
                          const d = String(r.date).substring(5,10);
                          if (!byDate[d]) byDate[d] = { date: d };
                          if (r.mode?.includes('18')) byDate[d].c18 = r.avgOverrun;
                          else if (r.mode?.includes('36')) byDate[d].c36 = r.avgOverrun;
                          else if (r.mode?.includes('45')) byDate[d].c45 = r.avgOverrun;
                          else if (r.mode?.includes('63')) byDate[d].c63 = r.avgOverrun;
                        });
                        return Object.values(byDate).slice(-15);
                      })()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                        <XAxis dataKey="date" tickLine={false} axisLine={false} tick={T(dm)} dy={5}/>
                        <YAxis tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                        <Tooltip {...TT(dm)}/>
                        <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize:10}}/>
                        <Line type="linear" dataKey="c18" name="18 QCART" stroke="#2196f3" strokeWidth={2} dot={false}/>
                        <Line type="linear" dataKey="c36" name="36 QTROLLY" stroke="#1a237e" strokeWidth={2} dot={false}/>
                        <Line type="linear" dataKey="c45" name="45 QTROLLY" stroke="#e67c32" strokeWidth={2} dot={false}/>
                        <Line type="linear" dataKey="c63" name="63 QTROLLY" stroke="#6a1b9a" strokeWidth={2} dot={false}/>
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab==="vehicle-handling"&&(
          <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Left Area Charts */}
            <div className="w-full lg:w-[45%] shrink-0 flex flex-col gap-4">
              <div className="flex gap-4">
                <div className={`relative rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col items-center justify-center p-6 w-[200px]`}>
                  <span className="absolute inset-x-0 top-0 h-1" style={{background:"linear-gradient(90deg,#60a5fa,#2563eb)"}} />
                  <span className="w-11 h-11 rounded-2xl flex items-center justify-center text-white mb-3 shadow-lg shadow-blue-500/25"
                    style={{background:"linear-gradient(135deg,#60a5fa,#2563eb)"}}>
                    <Truck className="w-5 h-5" />
                  </span>
                  <p className={`text-4xl font-black ${dm?"text-slate-100":"text-slate-800"}`}>
                    {liveData?.centerSidebar
                      ? (n(liveData.centerSidebar.noOfPurchy) >= 1000
                          ? (n(liveData.centerSidebar.noOfPurchy) / 1000).toFixed(1) + "K"
                          : n(liveData.centerSidebar.noOfPurchy).toLocaleString("en-IN"))
                      : "—"}
                  </p>
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mt-1.5">Vehicle Handled</p>
                  {prior?.centerSidebar && (
                    <PyBadge curr={liveData?.centerSidebar?.noOfPurchy} prior={prior.centerSidebar.noOfPurchy} dm={dm} label={pyLabel} />
                  )}
                </div>
                <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col flex-1`}>
                  <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Mode wise Split</div>
                  <div className="flex-1 p-2 h-[180px]">
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={liveData?.centerVehiclesByMode || []}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                        <XAxis dataKey="mode" tickLine={false} axisLine={false} tick={T(dm)} dy={5}/>
                        <YAxis tickFormatter={v=>(v/1000).toFixed(1)+"K"} tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                        <Tooltip {...TT(dm)}/>
                        <Bar dataKey="vehicles" fill="#2196f3" barSize={35}/>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col h-[280px]`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Vehicle Handling Trend (Mode wise)</div>
                <div className="flex-1 p-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={(() => {
                      const raw = liveData?.vehicleHandlingTrend || [];
                      const byDate = {};
                      raw.forEach(r => {
                        const d = String(r.date).substring(5, 10);
                        if (!byDate[d]) byDate[d] = { date: d };
                        if (r.mode?.includes("18")) byDate[d].v18 = n(r.vehicles);
                        else if (r.mode?.includes("36")) byDate[d].v36 = n(r.vehicles);
                        else if (r.mode?.includes("45")) byDate[d].v45 = n(r.vehicles);
                        else if (r.mode?.includes("63")) byDate[d].v63 = n(r.vehicles);
                      });
                      return Object.values(byDate);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                      <XAxis dataKey="date" tickLine={false} axisLine={false} tick={T(dm)} dy={5}/>
                      <YAxis tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                      <Tooltip formatter={v=>n(v).toLocaleString()+" vehicles"} {...TT(dm)}/>
                      <Legend verticalAlign="top" height={28} iconType="circle" wrapperStyle={{fontSize:10}}/>
                      <Line type="monotone" dataKey="v18" name="18 QCART" stroke="#1a237e" strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="v36" name="36 QTROLLY" stroke="#6a1b9a" strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="v45" name="45 QTROLLY" stroke="#64b5f6" strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="v63" name="63 QTROLLY" stroke="#e67c32" strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Area Tables */}
            <div className="flex-1 flex flex-col gap-4">
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col flex-1`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Centers with Most Vehicle Handled (Top 10)</div>
                <div className="flex-1 p-0 overflow-x-auto">
                  <table className="w-full text-[11px] text-center">
                    <thead className={`uppercase text-[9.5px] tracking-wider ${dm?"bg-slate-800/70 text-slate-400 border-b border-slate-700":"bg-slate-50 text-slate-500 border-b border-slate-200"}`}>
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold">Center</th>
                        <th className="px-2 py-2 font-semibold">18 QCART</th>
                        <th className="px-2 py-2 font-semibold">36 QTROLLY</th>
                        <th className="px-2 py-2 font-semibold">45 QTROLLY</th>
                        <th className="px-2 py-2 font-semibold">63 QTROLLY</th>
                        <th className="px-2 py-2 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${dm?"divide-slate-800":"divide-slate-100"}`}>
                      {(liveData?.topCentersVehicles || []).map((r,i)=>(
                        <tr key={i} className={`transition-colors ${dm?"hover:bg-slate-800/50":"hover:bg-blue-50/60"}`}>
                          <td className={`px-2 py-1.5 text-left font-semibold ${dm?"text-slate-300":"text-slate-700"}`}>{r.c}</td>
                          <td className="px-2 py-1.5">{n(r.m18).toLocaleString()}</td>
                          <td className="px-2 py-1.5">{n(r.m36).toLocaleString()}</td>
                          <td className="px-2 py-1.5">{n(r.m45).toLocaleString()}</td>
                          <td className="px-2 py-1.5">{n(r.m63).toLocaleString()}</td>
                          <td className="px-2 py-1.5 font-semibold">{n(r.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col flex-1`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Centers with Least Vehicle Handled (Top 10)</div>
                <div className="flex-1 p-0 overflow-x-auto">
                  <table className="w-full text-[11px] text-center">
                    <thead className={`uppercase text-[9.5px] tracking-wider ${dm?"bg-slate-800/70 text-slate-400 border-b border-slate-700":"bg-slate-50 text-slate-500 border-b border-slate-200"}`}>
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold">Center</th>
                        <th className="px-2 py-2 font-semibold">18 QCART</th>
                        <th className="px-2 py-2 font-semibold">36 QTROLLY</th>
                        <th className="px-2 py-2 font-semibold">45 QTROLLY</th>
                        <th className="px-2 py-2 font-semibold">63 QTROLLY</th>
                        <th className="px-2 py-2 font-semibold">Total</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${dm?"divide-slate-800":"divide-slate-100"}`}>
                      {(liveData?.bottomCentersVehicles || []).map((r,i)=>(
                        <tr key={i} className={`transition-colors ${dm?"hover:bg-slate-800/50":"hover:bg-blue-50/60"}`}>
                          <td className={`px-2 py-1.5 text-left font-semibold ${dm?"text-slate-300":"text-slate-700"}`}>{r.c}</td>
                          <td className="px-2 py-1.5">{n(r.m18).toLocaleString()}</td>
                          <td className="px-2 py-1.5">{n(r.m36).toLocaleString()}</td>
                          <td className="px-2 py-1.5">{n(r.m45).toLocaleString()}</td>
                          <td className="px-2 py-1.5">{n(r.m63).toLocaleString()}</td>
                          <td className="px-2 py-1.5 font-semibold">{n(r.total).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab==="vehicle-holding"&&(
          <div className="flex flex-col lg:flex-row gap-4 h-full">
            {/* Left Area */}
            <div className="w-full lg:w-[40%] shrink-0 flex flex-col gap-4">
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)]`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Avg. Holding Time (Hrs)</div>
                <div className="p-3 grid grid-cols-4 gap-2 text-center">
                  {(proc ? proc.centerHolding.filter(h=>h.mode!=="Total") : [{mode:"18 QCART",h:"3.08"},{mode:"36 QTROLLY",h:"2.69"},{mode:"45 QTROLLY",h:"2.78"},{mode:"63 QTROLLY",h:"2.04"}]).map((x,i) => (
                    <div key={i} className={`relative rounded-xl px-2 pt-3 pb-2.5 flex flex-col items-center overflow-hidden ${dm?"bg-slate-800/50":"bg-slate-50"}`}>
                      <span className="absolute inset-x-0 top-0 h-1" style={{background:modeColor(x.mode)}} />
                      <p className={`flex items-center gap-1 text-[9.5px] font-black uppercase tracking-wide mb-1.5 ${dm?"text-slate-400":"text-slate-600"}`}>
                        <Clock className="w-3 h-3" style={{color:modeColor(x.mode)}} />
                        {x.mode}
                      </p>
                      <p className="text-3xl font-black tabular-nums" style={{color:modeColor(x.mode)}}>{x.h}</p>
                      {prior && priorHoldByMode[x.mode] != null && (
                        <PyBadge curr={x.h} prior={priorHoldByMode[x.mode]} lowerBetter dm={dm} label={pyLabel} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col flex-1 min-h-[300px]`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Avg Holding Time at Centers - Trend</div>
                <div className="flex-1 p-2">
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={(() => {
                      const raw = liveData?.holdingTrend || [];
                      const byDate = {};
                      raw.forEach(r => {
                        const d = String(r.date).substring(5,10);
                        if (!byDate[d]) byDate[d] = { d };
                        if (r.mode?.includes('18')) byDate[d].v18 = r.holdingHrs;
                        else if (r.mode?.includes('36')) byDate[d].v36 = r.holdingHrs;
                        else if (r.mode?.includes('45')) byDate[d].v45 = r.holdingHrs;
                        else if (r.mode?.includes('63')) byDate[d].v63 = r.holdingHrs;
                      });
                      return Object.values(byDate);
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={G(dm)}/>
                      <XAxis dataKey="d" tickLine={false} axisLine={false} tick={T(dm)} dy={5}/>
                      <YAxis tickLine={false} axisLine={false} tick={T(dm)} dx={-10}/>
                      <Tooltip {...TT(dm)}/>
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize:10}}/>
                      <Line type="monotone" dataKey="v18" name="18 QCART" stroke="#2196f3" strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="v36" name="36 QTROLLY" stroke="#1a237e" strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="v45" name="45 QTROLLY" stroke="#e67c32" strokeWidth={2} dot={false}/>
                      <Line type="monotone" dataKey="v63" name="63 QTROLLY" stroke="#6a1b9a" strokeWidth={2} dot={false}/>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Right Area */}
            <div className="flex-1 flex flex-col gap-4">
              <div className={`rounded-2xl border ${dm?"border-slate-800 bg-slate-900":"border-slate-200/70 bg-white"} overflow-hidden shadow-[0_10px_26px_-18px_rgba(15,23,42,.45)] flex flex-col h-full min-h-[400px]`}>
                <div className={`py-1.5 px-3 font-bold text-sm tracking-wide ${dm?"bg-gradient-to-r from-slate-800 to-slate-900 text-slate-100 border-b border-slate-700":"bg-gradient-to-r from-sky-100 via-blue-50 to-white text-blue-900 border-b border-blue-100"}`}>Vehicle vs Center Holding Time Plot</div>
                <div className="flex-1 p-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <ScatterChart>
                      <CartesianGrid strokeDasharray="3 3" stroke={G(dm)}/>
                      <XAxis dataKey="h" name="Holding Time at Center (Hrs)" type="number" tick={T(dm)}/>
                      <YAxis dataKey="v" name="No of Vehicles" type="number" tick={T(dm)}/>
                      <Tooltip cursor={{strokeDasharray:"3 3"}} {...TT(dm)}/>
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{fontSize:10}}/>
                      {(() => {
                        const raw = liveData?.scatterData || [];
                        const modes = [...new Set(raw.map(r => r.mode))];
                        return modes.map((m, i) => (
                          <Scatter key={m} name={m} data={raw.filter(r => r.mode === m)} fill={modeColor(m)} />
                        ));
                      })()}
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}


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

        {tab==="database"&&(
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${dm?"bg-slate-900 border-slate-800 text-slate-300":"bg-white border-slate-200 text-slate-700"}`}>
                <Filter className="w-3.5 h-3.5 text-slate-400"/>
                <span>Center:</span>
                <select value={cf} onChange={e=>setCf(e.target.value)} className="bg-transparent focus:outline-none font-bold text-blue-600 dark:text-blue-400">
                  <option value="All">All Centers</option>
                  {CENTERS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <DTable darkMode={dm} cols={[
              {key:"purchyNo",label:"Purchy No.",bold:true},
              {key:"center",label:"Center"},
              {key:"grower",label:"Grower"},
              {key:"vehicle",label:"Vehicle"},
              {key:"caneQty",label:"Cane (Qtls)",cls:"text-emerald-600 font-bold"},
              {key:"challanNo",label:"Challan No."},
              {key:"mode",label:"Mode"},
              {key:"arrival",label:"Arrival"},
              {key:"holding",label:"Holding (hrs)",fmt:v=>fmt(v)},
              {key:"truckH",label:"Truck Hold (hrs)",fmt:v=>fmt(v)},
            ]} rows={cf==="All"?(liveData?.dbRows || []):(liveData?.dbRows || []).filter(r=>r.center===cf)}/>
          </div>
        )}

      </main>
    </div>
  );
}
