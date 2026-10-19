import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

/* ==================================================================
   Cut to Crush Process KPIs — 2D process map (no Three.js).
   Fixed 1400 x 790 canvas, scaled to the host. Live cane data.
   ================================================================== */

const C = {
  navy: "#0b1f5c",
  navy2: "#1c3d91",
  blue: "#2f80ed",
  text: "#1b2540",
  sub: "#5d6a82",
  border: "#d9e0eb",
  stripe: "#f3f6fa",
  over: "#d0392b",
  road: "#e1e7f0",
  amber: "#f4b740",
};
const FONT = "'Inter', 'Segoe UI', system-ui, Arial, sans-serif";
const NUM = { fontVariantNumeric: "tabular-nums" };
const SHADOW = "0 1px 2px rgba(15,30,70,.06), 0 4px 14px rgba(15,30,70,.06)";
const CANVAS_W = 1400;
const CANVAS_H = 790;

function cellStr(value) {
  if (value == null || value === "" || value === "-") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value)
      ? value.toLocaleString("en-IN")
      : value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  return String(value);
}

function hrs(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function intFmt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN");
}

function splitTable(rows, columns, fields) {
  const list = Array.isArray(rows) ? rows : [];
  const body = list.filter((r) => r.mode !== "Total");
  const totalRow = list.find((r) => r.mode === "Total");
  return {
    columns,
    rows: body.map((r) => fields.map((f) => cellStr(r[f]))),
    total: totalRow
      ? fields.map((f) => cellStr(totalRow[f]))
      : [columns[0] === "Mode" ? "Total" : columns[0], ...fields.slice(1).map(() => "")],
  };
}

const Abs = ({ x, y, w, h, style, children, className }) => (
  <div
    className={className}
    style={{ position: "absolute", left: x, top: y, width: w, height: h, boxSizing: "border-box", ...style }}
  >
    {children}
  </div>
);

const Card = (p) => (
  <Abs
    {...p}
    style={{
      background: "#fff",
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      boxShadow: SHADOW,
      overflow: "hidden",
      ...p.style,
    }}
  />
);

function DataTable({ data, colWidths, limit }) {
  const { columns, rows, total } = data;
  const cell = (i) => ({
    width: colWidths[i],
    flex: "none",
    textAlign: i === 0 ? "left" : "right",
    paddingRight: i === 0 ? 0 : 8,
    whiteSpace: "nowrap",
    overflow: "hidden",
    boxSizing: "border-box",
    ...NUM,
  });
  return (
    <div style={{ padding: "4px 10px 0", fontSize: 12.5, color: C.text }}>
      <div
        style={{
          display: "flex",
          height: 30,
          alignItems: "center",
          fontSize: 11.5,
          fontWeight: 600,
          color: C.sub,
          borderBottom: `1.5px solid ${C.blue}`,
        }}
      >
        {columns.map((c, i) => (
          <div key={`${c}-${i}`} style={{ ...cell(i), paddingLeft: i === 0 ? 6 : 0 }}>{c}</div>
        ))}
      </div>
      {rows.length === 0 ? (
        <div style={{ height: 42, display: "flex", alignItems: "center", paddingLeft: 6, color: C.sub, fontSize: 12 }}>
          No data for selected range
        </div>
      ) : rows.map((r, ri) => (
        <div
          key={ri}
          className="ctc-trow"
          style={{
            display: "flex",
            height: 21,
            alignItems: "center",
            background: ri % 2 ? C.stripe : "transparent",
            borderRadius: 4,
          }}
        >
          {r.map((v, i) => {
            const over = limit && i === 1 && parseFloat(String(v).replace(/,/g, "")) > limit;
            return (
              <div
                key={i}
                style={{
                  ...cell(i),
                  paddingLeft: i === 0 ? 6 : 0,
                  color: over ? C.over : undefined,
                  fontWeight: over ? 600 : 400,
                }}
              >
                {v}
              </div>
            );
          })}
        </div>
      ))}
      {total ? (
        <div
          style={{
            display: "flex",
            height: 26,
            alignItems: "center",
            fontWeight: 700,
            borderTop: `1.5px solid ${C.blue}`,
            marginTop: 1,
          }}
        >
          {total.map((v, i) => (
            <div key={i} style={{ ...cell(i), paddingLeft: i === 0 ? 6 : 0 }}>{v}</div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

const Tag = ({ x, y, w, h, children }) => (
  <Abs
    x={x}
    y={y}
    w={w}
    h={h}
    style={{
      background: "linear-gradient(180deg,#fff6d8,#ffe9a8)",
      border: "1px solid #e2b84a",
      borderRadius: 8,
      boxShadow: "0 2px 6px rgba(226,184,74,.35)",
      fontSize: 11,
      fontWeight: 600,
      lineHeight: "13px",
      color: "#6b4e00",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      textAlign: "center",
    }}
  >
    {children}
  </Abs>
);

const ZoneLabel = ({ x, y, w, children, solid = true }) => (
  <Abs
    x={x}
    y={y}
    w={w}
    h={30}
    style={{
      borderRadius: 999,
      fontSize: 13.5,
      fontWeight: 600,
      letterSpacing: ".02em",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: solid ? `linear-gradient(90deg, ${C.navy}, ${C.navy2})` : "#fff",
      color: solid ? "#fff" : C.navy,
      border: solid ? "none" : `1px solid ${C.border}`,
      boxShadow: solid ? "0 4px 10px rgba(11,31,92,.25)" : SHADOW,
    }}
  >
    {children}
  </Abs>
);

const ClockIco = ({ color = C.blue }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
  </svg>
);

const Kpi = ({ x, y, w, h, value, label, size = 44, accent = C.blue }) => (
  <Card
    x={x}
    y={y}
    w={w}
    h={h}
    style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}
  >
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: `linear-gradient(90deg, ${accent}, ${C.navy2})`,
      }}
    />
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: C.sub }}>
      <ClockIco color={accent} />{label}
    </div>
    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
      <span style={{ fontSize: size, fontWeight: 700, color: C.navy, letterSpacing: "-.03em", lineHeight: 1.1, ...NUM }}>
        {value}
      </span>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.sub }}>hrs</span>
    </div>
  </Card>
);

function FarmIcon({ uid }) {
  const stalks = [];
  for (let row = 0; row < 5; row += 1) {
    for (let k = 0; k < 6; k += 1) {
      const x = 24 + k * 11 + row * 8;
      const y = 60 - k * 5 + row * 5.5;
      const h = 34 + ((k * 7 + row * 3) % 9);
      stalks.push(
        <g key={`${row}-${k}`}>
          <path
            d={`M${x} ${y} C${x + 1} ${y - h / 2} ${x - 1} ${y - h * 0.8} ${x + 1} ${y - h}`}
            stroke={`url(#${uid}-stalk)`}
            strokeWidth="2.2"
            fill="none"
            strokeLinecap="round"
          />
          <path d={`M${x} ${y - h * 0.45} q-9 -5 -12 -15`} stroke="#58b947" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d={`M${x} ${y - h * 0.65} q9 -5 11 -14`} stroke="#7ccf5a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d={`M${x} ${y - h * 0.28} q8 -2 11 -9`} stroke="#3f9e36" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </g>,
      );
    }
  }
  return (
    <svg width="116" height="104" viewBox="0 0 116 104">
      <defs>
        <linearGradient id={`${uid}-stalk`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#2f7d2a" /><stop offset="1" stopColor="#9be06c" />
        </linearGradient>
        <linearGradient id={`${uid}-soilTop`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a8683a" /><stop offset="1" stopColor="#7d4521" />
        </linearGradient>
      </defs>
      <ellipse cx="58" cy="96" rx="48" ry="6" fill="#0b1f5c" opacity=".08" />
      <path d="M8 64 58 40 108 64 58 88z" fill={`url(#${uid}-soilTop)`} />
      <path d="M8 64v10l50 24V88z" fill="#6b3818" />
      <path d="M108 64v10L58 98V88z" fill="#4f2911" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${18 + i * 8} ${69 + i * 4.4 - 4} l46 -22`} stroke="#5e3217" strokeWidth="1" opacity=".55" />
      ))}
      {stalks}
    </svg>
  );
}

const CentersIcon = ({ uid }) => (
  <svg width="118" height="104" viewBox="0 0 118 104">
    <defs>
      <linearGradient id={`${uid}-roofL`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#6fd46a" /><stop offset="1" stopColor="#3fae47" />
      </linearGradient>
      <linearGradient id={`${uid}-wallL`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#f1f4f9" /><stop offset="1" stopColor="#d7deea" />
      </linearGradient>
    </defs>
    <ellipse cx="60" cy="96" rx="50" ry="6" fill="#0b1f5c" opacity=".08" />
    <path d="M16 42 56 62v28L16 70z" fill={`url(#${uid}-wallL)`} />
    <path d="M56 62 100 40v28L56 90z" fill="#c6cfdd" />
    <path d="M12 40 54 18 104 38 58 62z" fill={`url(#${uid}-roofL)`} />
    <path d="M12 40 58 62v5L12 45z" fill="#2f8f3a" />
    <path d="M58 62 104 38v5L58 67z" fill="#277a31" />
    <path d="M24 56 42 65v19L24 75z" fill="#8e9bb3" />
    {[0, 1, 2, 3].map((i) => (
      <path key={i} d={`M24 ${59 + i * 4} 42 ${68 + i * 4}`} stroke="#7a879f" strokeWidth=".8" />
    ))}
    <g transform="translate(52 66)">
      <path d="M0 10 34 -6 50 2 16 18z" fill="#e53935" />
      <path d="M0 10v9l16 8v-9z" fill="#b71c1c" />
      <path d="M16 18 50 2v9L16 27z" fill="#d32f2f" />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${3 + i * 6} ${7 - i * 3} l14 7`} stroke="#8bc34a" strokeWidth="2.4" strokeLinecap="round" />
      ))}
      <path d="M38 8 50 2 58 6v9l-12 6z" fill="#f4c430" />
      <path d="M46 14l10-5" stroke="#2c3e50" strokeWidth="2" />
      <circle cx="10" cy="25" r="3.6" fill="#2b2f36" /><circle cx="44" cy="19" r="3.6" fill="#2b2f36" />
    </g>
    <path d="M4 82 18 89 28 84 14 77z" fill="#e9b44c" />
    <path d="M4 82v4l14 7v-4z" fill="#c58c28" />
  </svg>
);

const BoomGate = () => (
  <svg width="70" height="46" viewBox="0 0 70 46">
    <ellipse cx="14" cy="42" rx="12" ry="3" fill="#0b1f5c" opacity=".1" />
    <rect x="6" y="14" width="14" height="28" rx="2" fill="#f4b740" />
    <rect x="6" y="22" width="14" height="5" fill="#2b2f36" />
    <rect x="6" y="32" width="14" height="5" fill="#2b2f36" />
    <rect x="16" y="15" width="52" height="6" rx="3" fill="#fff" stroke="#c9ced8" />
    {[0, 1, 2, 3, 4].map((i) => (
      <rect key={i} x={22 + i * 9} y="15" width="5" height="6" fill="#e53935" />
    ))}
    <circle cx="13" cy="18" r="3" fill="#2b2f36" />
  </svg>
);

const CaneCarrier = ({ uid, h = 372 }) => {
  const slats = Math.floor(h / 18);
  return (
    <svg width="44" height={h} viewBox={`0 0 44 ${h}`}>
      <defs>
        <linearGradient id={`${uid}-rail`} x1="0" x2="1">
          <stop offset="0" stopColor="#8794a8" /><stop offset=".5" stopColor="#d6dce6" /><stop offset="1" stopColor="#7a879c" />
        </linearGradient>
        <linearGradient id={`${uid}-bed`} x1="0" x2="1">
          <stop offset="0" stopColor="#1f2a3a" /><stop offset=".5" stopColor="#2e3b50" /><stop offset="1" stopColor="#1f2a3a" />
        </linearGradient>
      </defs>
      <rect x="6" y="0" width="32" height={h} rx="6" fill={`url(#${uid}-bed)`} />
      <g className="ctc-carrier">
        {Array.from({ length: slats + 2 }).map((_, i) => (
          <g key={i} transform={`translate(0 ${i * 18 - 18})`}>
            <rect x="8" y="0" width="28" height="2" fill="#4b5a72" />
            {i % 2 === 0 && (
              <>
                <path d="M12 7 l20 4" stroke="#9ccc65" strokeWidth="2.6" strokeLinecap="round" />
                <path d="M13 12 l18 3" stroke="#c5e1a5" strokeWidth="2.2" strokeLinecap="round" />
              </>
            )}
          </g>
        ))}
      </g>
      <rect x="2" y="0" width="5" height={h} rx="2.5" fill={`url(#${uid}-rail)`} />
      <rect x="37" y="0" width="5" height={h} rx="2.5" fill={`url(#${uid}-rail)`} />
    </svg>
  );
};

const MillRollers = ({ uid }) => {
  const Roller = ({ cx, cy, r }) => (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-steel)`} stroke="#4b5a72" strokeWidth="1" />
      <g className="ctc-spin" style={{ transformOrigin: `${cx}px ${cy}px` }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <line
            key={i}
            x1={cx}
            y1={cy - r + 2}
            x2={cx}
            y2={cy - r + 6}
            stroke="#5d6b80"
            strokeWidth="1.4"
            transform={`rotate(${i * 36} ${cx} ${cy})`}
          />
        ))}
      </g>
      <circle cx={cx} cy={cy} r={r * 0.3} fill="#2b3648" />
    </g>
  );
  return (
    <svg width="66" height="72" viewBox="0 0 66 72">
      <defs>
        <radialGradient id={`${uid}-steel`} cx=".35" cy=".35" r=".8">
          <stop offset="0" stopColor="#f1f4f8" /><stop offset=".6" stopColor="#a9b4c4" /><stop offset="1" stopColor="#6c7a90" />
        </radialGradient>
      </defs>
      <rect x="4" y="54" width="58" height="10" rx="3" fill={C.navy} />
      <rect x="10" y="64" width="46" height="5" rx="2" fill="#2f80ed" opacity=".6" />
      <Roller cx={33} cy={17} r={14} />
      <Roller cx={17} cy={41} r={13} />
      <Roller cx={49} cy={41} r={13} />
    </svg>
  );
};

const YardParking = () => {
  const bays = 9;
  const parked = [0, 1, 3, 4, 5, 7, 8, 10, 11, 13, 15, 16];
  return (
    <svg width="236" height="150" viewBox="0 0 236 150">
      {[0, 1].map((row) => (
        <g key={row} transform={`translate(4 ${row * 78})`}>
          <line x1="0" y1="0" x2="226" y2="0" stroke="#cdd6e3" strokeWidth="1.5" />
          {Array.from({ length: bays + 1 }).map((_, i) => (
            <line key={i} x1={i * 25.1} y1="0" x2={i * 25.1} y2="54" stroke="#cdd6e3" strokeWidth="1.5" />
          ))}
          {Array.from({ length: bays }).map((_, i) => (
            parked.includes(row * bays + i) ? (
              <g key={i} transform={`translate(${i * 25.1 + 5} 6)`}>
                <rect x="0" y="0" width="15" height="34" rx="3" fill={(i + row) % 3 === 0 ? "#9ccc65" : "#c5d3e6"} />
                <rect x="1.5" y="36" width="12" height="11" rx="3" fill={(i + row) % 4 === 0 ? "#e53935" : "#1c3d91"} />
              </g>
            ) : null
          ))}
        </g>
      ))}
    </svg>
  );
};

const ROADS = [
  "M163 186 H668",
  "M103 277 V553 H290",
  "M397 553 H445",
  "M510 624 V655 H668",
];

function Roads({ uid }) {
  return (
    <svg width="1400" height="790" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <defs>
        <linearGradient id={`${uid}-arrowG`} x1="0" x2="1">
          <stop offset="0" stopColor="#7db4ff" /><stop offset="1" stopColor="#1f6fe0" />
        </linearGradient>
        <filter id={`${uid}-soft`} x="-20%" y="-50%" width="140%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1f6fe0" floodOpacity=".25" />
        </filter>
      </defs>
      {ROADS.map((d, i) => (
        <g key={i}>
          <path d={d} stroke={C.road} strokeWidth="12" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} stroke="#fff" strokeWidth="1.4" fill="none" strokeDasharray="6 7" />
          {[0, 1, 2].map((k) => (
            <g key={k}>
              <rect x="-6" y="-3.5" width="12" height="7" rx="2.5" fill={k === 1 ? "#e53935" : C.navy2} stroke="#fff" strokeWidth="1">
                <animateMotion dur={`${7 + i}s`} repeatCount="indefinite" rotate="auto" begin={`${-k * (7 + i) / 3}s`} path={d} />
              </rect>
            </g>
          ))}
        </g>
      ))}
      <g filter={`url(#${uid}-soft)`}>
        <path d="M958 284h50v-10l22 17-22 17v-10h-50z" fill={`url(#${uid}-arrowG)`} />
        <path d="M968 426h22v-8l16 13-16 13v-8h-22z" fill={`url(#${uid}-arrowG)`} />
        <path d="M940 646h86v-10l24 17-24 17v-10h-86z" fill={`url(#${uid}-arrowG)`} />
      </g>
    </svg>
  );
}

const zoneStyle = {
  background: "linear-gradient(180deg, #ffffff 0%, #f7f9fd 100%)",
  border: `1px solid ${C.border}`,
  borderRadius: 28,
  boxShadow: SHADOW,
};

function Canvas({
  uid,
  gateTable,
  farmTable,
  yardTable,
  millTable,
  holdingTable,
  centerTrips,
  avgCenterWait,
  truckHolding,
  avgYardWait,
  caneHolding,
  avgDongaWait,
}) {
  return (
    <div
      className="ctc-canvas"
      style={{
        position: "relative",
        width: CANVAS_W,
        height: CANVAS_H,
        fontFamily: FONT,
        color: C.text,
        overflow: "hidden",
        backgroundColor: "#f4f6fa",
        backgroundImage: "radial-gradient(#d7deea 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <Abs x={0} y={0} w={1400} h={80} style={{ background: "#fff", borderBottom: `1px solid ${C.border}` }} />
      <Abs
        x={16}
        y={14}
        w={1368}
        h={52}
        style={{
          borderRadius: 14,
          background: `linear-gradient(100deg, ${C.navy} 0%, ${C.navy2} 70%, #2a55b8 100%)`,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: ".01em",
          boxShadow: "0 6px 18px rgba(11,31,92,.25)",
        }}
      >
        Cut to Crush Process KPIs
      </Abs>

      <Abs x={668} y={110} w={292} h={664} style={zoneStyle} />
      <Abs x={1028} y={110} w={362} h={664} style={zoneStyle} />

      <Roads uid={uid} />

      <Abs x={46} y={126}><FarmIcon uid={uid} /></Abs>
      <ZoneLabel x={53} y={246} w={100} solid={false}>Farm</ZoneLabel>

      <Card x={235} y={100} w={333} h={150}>
        <DataTable data={gateTable} colWidths={[86, 64, 84, 76]} />
      </Card>
      <Tag x={612} y={167} w={78} h={38}>Gate<br />Vehicles</Tag>

      <Card x={11} y={322} w={335} h={150}>
        <DataTable data={farmTable} colWidths={[86, 66, 82, 78]} />
      </Card>

      <Abs x={282} y={488}><CentersIcon uid={uid} /></Abs>
      <ZoneLabel x={296} y={590} w={92} solid={false}>Centers</ZoneLabel>
      <Card x={445} y={507} w={123} h={117} style={{ padding: "12px 0 0 16px" }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.navy, ...NUM }}>{centerTrips}</div>
        <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 500 }}>Trips</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: C.navy, marginTop: 6, ...NUM }}>{avgCenterWait}</div>
        <div style={{ fontSize: 11.5, color: C.sub, fontWeight: 500 }}>Avg Time (Hrs)</div>
      </Card>
      <Tag x={612} y={636} w={78} h={38}>Center<br />Vehicles</Tag>

      <Card x={56} y={628} w={209} h={152}>
        <DataTable data={holdingTable} colWidths={[90, 99]} />
      </Card>
      <Kpi x={275} y={628} w={160} h={152} value={truckHolding} label="Truck Holding" size={38} accent={C.amber} />

      <ZoneLabel x={764} y={95} w={100}>Yard</ZoneLabel>
      <Card x={682} y={150} w={264} h={174}>
        <DataTable data={yardTable} colWidths={[86, 66, 88]} limit={8} />
      </Card>
      <Abs x={696} y={356} style={{ opacity: 0.5 }}><YardParking /></Abs>
      <Abs x={700} y={530} w={228} h={1} style={{ background: C.border }} />
      <Kpi x={704} y={582} w={220} h={142} value={avgYardWait} label="Waiting Time" size={50} />
      <Abs x={1002} y={404}><BoomGate /></Abs>

      <ZoneLabel x={1139} y={95} w={140}>Mill Premise</ZoneLabel>
      <Card x={1042} y={150} w={272} h={174}>
        <DataTable data={millTable} colWidths={[86, 64, 102]} limit={0.5} />
      </Card>
      <Abs x={1328} y={150}><CaneCarrier uid={uid} h={520} /></Abs>
      <Abs x={1317} y={668}><MillRollers uid={uid} /></Abs>

      <Kpi x={1060} y={548} w={238} h={106} value={caneHolding} label="Cane Holding Time" size={44} />
      <Kpi x={1060} y={664} w={238} h={106} value={avgDongaWait} label="Time at Donga" size={44} />
    </div>
  );
}

function ProcurementCutToCrushScene({
  gateRows = [],
  centerVehRows = [],
  holdRows = [],
  centerTrips,
  avgCenterWait,
  truckHolding,
  yardRows = [],
  avgYardWait,
  caneHolding,
  avgDongaWait,
  millRows = [],
  className = "",
}) {
  const hostRef = useRef(null);
  const rawId = useId();
  const uid = `ctc${String(rawId).replace(/[^a-zA-Z0-9]/g, "")}`;
  const [scale, setScale] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const gateTable = useMemo(
    () => splitTable(gateRows, ["Mode", "Vehicles", "Cane (Q)", "Time (Hrs)"], ["mode", "veh", "cane", "time"]),
    [gateRows],
  );
  const farmTable = useMemo(
    () => splitTable(centerVehRows, ["Mode", "Vehicles", "Cane (Q)", "Time (Hrs)"], ["mode", "veh", "cane", "time"]),
    [centerVehRows],
  );
  const yardTable = useMemo(
    () => splitTable(yardRows, ["Mode", "Avg Time", "Dev. (>8H)"], ["mode", "avg", "dev"]),
    [yardRows],
  );
  const millTable = useMemo(
    () => splitTable(millRows, ["Mode", "Avg Time", "Dev (>0.5H)"], ["mode", "avg", "dev"]),
    [millRows],
  );
  const holdingTable = useMemo(
    () => splitTable(holdRows, ["Mode", "Holding Time (H)"], ["mode", "h"]),
    [holdRows],
  );

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return undefined;
    const fit = () => {
      const w = el.clientWidth || CANVAS_W;
      const h = el.clientHeight || CANVAS_H;
      setScale(Math.max(0.35, Math.min(w / CANVAS_W, h / CANVAS_H, 2)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement === hostRef.current));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const toggleFullscreen = async () => {
    const el = hostRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen?.();
      else await el.requestFullscreen?.();
    } catch {
      /* ignore */
    }
  };

  return (
    <div
      ref={hostRef}
      className={`relative flex h-full min-h-[420px] w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f6fa] ${className}`}
    >
      <style>{`
        .ctc-canvas .ctc-trow { transition: background .15s; }
        .ctc-canvas .ctc-trow:hover { background: #e7f0ff !important; }
        .ctc-carrier { animation: ctc-carry 2.4s linear infinite; }
        @keyframes ctc-carry { from { transform: translateY(0) } to { transform: translateY(36px) } }
        .ctc-spin { animation: ctc-spin 3s linear infinite; }
        @keyframes ctc-spin { to { transform: rotate(360deg) } }
      `}</style>
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute right-3 top-3 z-20 rounded-xl border border-slate-200 bg-white/90 p-2 text-slate-600 shadow-sm backdrop-blur-md transition-colors hover:border-blue-400 hover:text-blue-700"
        title={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
        aria-label={isFullscreen ? "Exit fullscreen" : "Expand fullscreen"}
      >
        {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <div style={{ width: CANVAS_W * scale, height: CANVAS_H * scale, overflow: "hidden" }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <Canvas
            uid={uid}
            gateTable={gateTable}
            farmTable={farmTable}
            yardTable={yardTable}
            millTable={millTable}
            holdingTable={holdingTable}
            centerTrips={intFmt(centerTrips)}
            avgCenterWait={hrs(avgCenterWait)}
            truckHolding={hrs(truckHolding)}
            avgYardWait={hrs(avgYardWait)}
            caneHolding={hrs(caneHolding)}
            avgDongaWait={hrs(avgDongaWait)}
          />
        </div>
      </div>
    </div>
  );
}

export default React.memo(ProcurementCutToCrushScene);
