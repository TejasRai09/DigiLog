/**
 * Power House measures — ported from power plant.SemanticModel DAX.
 * Steam columns use PBI names (StmCons3New70 / StmCons3Old70); API maps DigiLog *35 → *70.
 */

function n(v) {
  if (v == null || v === '') return 0;
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function sum(rows, key) {
  let t = 0;
  for (const r of rows) t += n(r[key]);
  return t;
}

function safeDiv(a, b) {
  if (b == null || b === 0 || !Number.isFinite(b)) return null;
  if (!Number.isFinite(a)) return null;
  return a / b;
}

function countNonZero(rows, key) {
  let c = 0;
  for (const r of rows) {
    if (n(r[key]) !== 0) c += 1;
  }
  return c;
}

/** Aggregate KPIs for a filtered set of power + steam rows (PBI measure equivalents). */
export function computePowerKpis(powerRows, steamRows = []) {
  const p = powerRows || [];
  const s = steamRows || [];

  const PowerGen30 = sum(p, 'PowerGen30');
  const PowerGen3Old = sum(p, 'PowerGen3Old');
  const PowerGen3New = sum(p, 'PowerGen3New');
  const PowerGen4MW = sum(p, 'PowerGen4MW');
  const Hours30 = sum(p, 'Hours30');
  const Hours3Old = sum(p, 'Hours3Old');
  const Hours3New = sum(p, 'Hours3New');
  const Hours4 = sum(p, 'Hours4');

  const PowerCons_Dist_CPU_4MW =
    PowerGen4MW + sum(p, 'ExportDist30') - sum(p, 'Imp_4MW') - sum(p, 'ExportCogen4');

  const Export_Cogen =
    sum(p, 'ExportCogen30') +
    sum(p, 'ExportCogen3New') +
    sum(p, 'ExportCogen3Old') +
    sum(p, 'ExportCogen4');

  const Export_Sugar =
    sum(p, 'ExportSug30') +
    sum(p, 'ExportSug3New') +
    sum(p, 'ExportSug3Old') +
    sum(p, 'ExportSug4');

  const Total_Power_Gen = PowerGen30 + PowerGen3New + PowerGen3Old + PowerGen4MW;

  const Total_Internal_Con = Export_Cogen + Export_Sugar + PowerCons_Dist_CPU_4MW;

  const ExportGrid30 = sum(p, 'ExportGrid30');

  return {
    PowerGen30,
    PowerGen3Old,
    PowerGen3New,
    PowerGen4MW,
    Hours30,
    Hours3Old,
    Hours3New,
    Hours4,
    Crush: sum(p, 'Crush'),
    Baggase: sum(p, 'Baggase'),
    ExportGrid30,
    GenDG30: sum(p, 'GenDG30'),
    GenDG3Old: sum(p, 'GenDG3Old'),
    GenDG3New: sum(p, 'GenDG3New'),
    GenDG4: sum(p, 'GenDG4'),
    Imp_Grid: sum(p, 'Imp_Grid'),
    Imp_4MW: sum(p, 'Imp_4MW'),
    ExportDist30: sum(p, 'ExportDist30'),
    ExportCogen30: sum(p, 'ExportCogen30'),
    ExportCogen4: sum(p, 'ExportCogen4'),
    ExportSug30: sum(p, 'ExportSug30'),

    'PowerCons_Dist+CPU_4MW': PowerCons_Dist_CPU_4MW,
    PowerCons_Dist_CPU_4MW,
    '%Aux_cons30MW': safeDiv(sum(p, 'ExportCogen30'), PowerGen30),
    '%Aux_Cons4MW': safeDiv(sum(p, 'ExportCogen4'), PowerGen4MW),
    PLF_30MW: safeDiv(PowerGen30 * 100, Hours30 * 30000),
    PLF_3Old: safeDiv(PowerGen3Old * 100, Hours3Old * 3000),
    PLF_3New: safeDiv(PowerGen3New * 100, Hours3New * 3000),
    PLF_4MW: safeDiv(PowerGen4MW * 100, Hours4 * 4000),
    'Total Power_Gen': Total_Power_Gen,
    Total_Power_Gen,
    Total_Internal_Con,
    Export_Cogen,
    Export_Sugar,
    Import_Instances: countNonZero(p, 'Imp_Grid'),
    'Int_Cons%': safeDiv(Total_Internal_Con, Total_Power_Gen),
    'Export%': safeDiv(ExportGrid30, Total_Power_Gen),
    Total_Import: sum(p, 'Imp_Grid'),
    OpDays_30MW: countNonZero(p, 'PowerGen30'),
    OpDays_3MW_New: countNonZero(p, 'PowerGen3New'),
    OpDays_3MW_Old: countNonZero(p, 'PowerGen3Old'),
    OpDays_4MW: countNonZero(p, 'PowerGen4MW'),
    SpecSteam30: safeDiv(sum(s, 'SteamCon30MW'), PowerGen30 / 1000),
    SpecSteam3Old: safeDiv(sum(s, 'StmCons3Old70'), PowerGen3Old / 1000),
    SpecSteam3New: safeDiv(sum(s, 'StmCons3New70'), PowerGen3New / 1000),
    SpecSteam4: safeDiv(sum(s, 'StmCons4'), PowerGen4MW / 1000),
    'PowerGen30(Mn)': PowerGen30 / 1e6,
    PowerGen3_New: PowerGen3New / 1e6,
    PowerGen3Old_Mn: PowerGen3Old / 1e6,
    PowerGen4Mn: PowerGen4MW / 1e6,
    AmtSugar: Export_Sugar * 4.85,
    AmtDistill: PowerCons_Dist_CPU_4MW * 4.85,
    AMtGrid: ExportGrid30 * 4.85,
  };
}

export function computeSteamKpis(steamRows) {
  const s = steamRows || [];

  const StmtoDistill35TPH =
    sum(s, 'TotalStmdistil') - sum(s, 'StmDist70') - sum(s, 'StmtoDistil110_45ATAPRDS_o');

  const StmConsMillTB_PRDS =
    sum(s, 'SteamGen70') - sum(s, 'StmCons3New70') - sum(s, 'StmCons3Old70');

  const Totalstmtoprocess =
    sum(s, 'TotalStmtoSug150') +
    sum(s, 'TotalStmtoSug70') +
    sum(s, 'StmtoSugDisti') +
    sum(s, 'StmtoDistil110_45ATAPRDS_o') +
    sum(s, 'StmDist70') +
    StmtoDistill35TPH +
    sum(s, 'StmMillTurbine110_45ATAPRDS') +
    StmConsMillTB_PRDS;

  const sugarToProcess =
    sum(s, 'TotalStmtoSug150') + sum(s, 'TotalStmtoSug70') + sum(s, 'StmtoSugDisti');
  const distToProcess =
    sum(s, 'StmtoDistil110_45ATAPRDS_o') + sum(s, 'StmDist70') + StmtoDistill35TPH;
  const millToProcess = sum(s, 'StmMillTurbine110_45ATAPRDS') + StmConsMillTB_PRDS;

  return {
    SteamGen150: sum(s, 'SteamGen150'),
    SteamGen70: sum(s, 'SteamGen70'),
    SteamGen35: sum(s, 'SteamGen35'),
    Baggase150: sum(s, 'Baggase150'),
    Baggase70: sum(s, 'Baggase70'),
    Baggase35: sum(s, 'Baggase35'),
    SlopCon: sum(s, 'SlopCon'),
    SteamCon30MW: sum(s, 'SteamCon30MW'),
    StmCons3New70: sum(s, 'StmCons3New70'),
    StmCons3Old70: sum(s, 'StmCons3Old70'),
    StmCons4: sum(s, 'StmCons4'),
    Stm4MWTG110_45ATAPRDS: sum(s, 'Stm4MWTG110_45ATAPRDS'),
    Stmto3New110_45ATAPRDS: sum(s, 'Stmto3New110_45ATAPRDS'),
    Stmto3Old110_45ATAPRDS: sum(s, 'Stmto3Old110_45ATAPRDS'),
    Stmto4_70TPH: sum(s, 'Stmto4_70TPH'),
    TotalStmtoSug150: sum(s, 'TotalStmtoSug150'),
    TotalStmtoSug70: sum(s, 'TotalStmtoSug70'),
    StmtoSugDisti: sum(s, 'StmtoSugDisti'),
    StmtoDistil110_45ATAPRDS_o: sum(s, 'StmtoDistil110_45ATAPRDS_o'),
    StmDist70: sum(s, 'StmDist70'),
    StmMillTurbine110_45ATAPRDS: sum(s, 'StmMillTurbine110_45ATAPRDS'),
    Stmtodeareator150: sum(s, 'Stmtodeareator150'),
    Stm35TDeareator: sum(s, 'Stm35TDeareator'),
    StmCons45_55ATAPRDS: sum(s, 'StmCons45_55ATAPRDS'),
    Stm45_55ATADeareatorEjectorPRDS: sum(s, 'Stm45_55ATADeareatorEjectorPRDS'),
    StmtoEjector: sum(s, 'StmtoEjector'),
    ExtractionStm30MW: sum(s, 'ExtractionStm30MW'),
    Bleed1HPH2Stm: sum(s, 'Bleed1HPH2Stm'),
    Bleed2HPH1Stm: sum(s, 'Bleed2HPH1Stm'),
    Extractionstm4: sum(s, 'Extractionstm4'),
    TotalStmdistil: sum(s, 'TotalStmdistil'),

    Stmto30MW_TGCondenser:
      sum(s, 'SteamCon30MW') -
      sum(s, 'ExtractionStm30MW') -
      sum(s, 'Bleed1HPH2Stm') -
      sum(s, 'Bleed2HPH1Stm'),
    'StmConsMillTB&PRDS': StmConsMillTB_PRDS,
    StmConsMillTB_PRDS,
    StmtoTBCondensor: sum(s, 'StmCons4') - sum(s, 'Extractionstm4'),
    StmtoDistill35TPH,
    StmtoSug70TPH: sum(s, 'TotalStmtoSug70') - sum(s, 'StmtoSugDisti'),
    StmtoBaggase150: safeDiv(sum(s, 'SteamGen150'), sum(s, 'Baggase150')),
    StmtoBaggase70: safeDiv(sum(s, 'SteamGen70'), sum(s, 'Baggase70')),
    StmtoBaggase35: safeDiv(sum(s, 'SteamGen35'), sum(s, 'Baggase35') + sum(s, 'SlopCon')),
    TotalSteamgen: sum(s, 'SteamGen150') + sum(s, 'SteamGen70') + sum(s, 'SteamGen35'),
    TotalBaggase: sum(s, 'Baggase150') + sum(s, 'Baggase70') + sum(s, 'Baggase35'),
    Totalstmtoprocess,
    'TotalStmtoSugar(%)': safeDiv(sugarToProcess, Totalstmtoprocess),
    'Totalstmtodist(%)': safeDiv(distToProcess, Totalstmtoprocess),
    'TotalstmtoMill(%)': safeDiv(millToProcess, Totalstmtoprocess),
  };
}

/** Signed duration like Power BI (negative when end < start). */
export function computeOutageKpis(stoppageRows) {
  const rows = stoppageRows || [];
  let totalDuration = 0;
  for (const r of rows) totalDuration += n(r.Duration);
  return {
    totalDuration,
    incidentCount: rows.length,
  };
}

/** Daily series for charts — one point per power Date with joined steam when available. */
export function buildDailySeries(powerRows, steamRows) {
  const steamByDate = new Map();
  for (const r of steamRows || []) {
    if (r.Date) steamByDate.set(r.Date, r);
  }

  return (powerRows || []).map((p) => {
    const s = steamByDate.get(p.Date) || {};
    const powerK = computePowerKpis([p], [s]);
    const steamK = computeSteamKpis([s]);
    const totalGen = powerK.Total_Power_Gen;
    return {
      date: p.Date,
      label: formatDateLabel(p.Date),
      PowerGen30: n(p.PowerGen30),
      PowerGen3Old: n(p.PowerGen3Old),
      PowerGen3New: n(p.PowerGen3New),
      PowerGen4MW: n(p.PowerGen4MW),
      TotalGen: totalGen,
      ExportGrid30: n(p.ExportGrid30),
      Imp_Grid: n(p.Imp_Grid),
      Crush: n(p.Crush),
      Baggase: n(p.Baggase),
      Export_Sugar: powerK.Export_Sugar,
      Export_Cogen: powerK.Export_Cogen,
      PowerCons_Dist_CPU_4MW: powerK.PowerCons_Dist_CPU_4MW,
      Total_Internal_Con: powerK.Total_Internal_Con,
      Int_Cons_pct: powerK['Int_Cons%'] != null ? powerK['Int_Cons%'] * 100 : null,
      Export_pct: powerK['Export%'] != null ? powerK['Export%'] * 100 : null,
      PLF_30MW: powerK.PLF_30MW,
      PLF_3Old: powerK.PLF_3Old,
      PLF_3New: powerK.PLF_3New,
      PLF_4MW: powerK.PLF_4MW,
      SteamGen150: n(s.SteamGen150),
      SteamGen70: n(s.SteamGen70),
      SteamGen35: n(s.SteamGen35),
      Baggase150: n(s.Baggase150),
      Baggase70: n(s.Baggase70),
      Baggase35: n(s.Baggase35),
      SteamCon30MW: n(s.SteamCon30MW),
      StmCons3New70: n(s.StmCons3New70),
      StmCons3Old70: n(s.StmCons3Old70),
      StmCons4: n(s.StmCons4),
      Stm4MWTG110_45ATAPRDS: n(s.Stm4MWTG110_45ATAPRDS),
      Stmto3New110_45ATAPRDS: n(s.Stmto3New110_45ATAPRDS),
      Stmto3Old110_45ATAPRDS: n(s.Stmto3Old110_45ATAPRDS),
      Stmto4_70TPH: n(s.Stmto4_70TPH),
      SteamToSugar150: n(s.TotalStmtoSug150),
      SteamToDist150: n(s.StmtoDistil110_45ATAPRDS_o),
      SteamToMill150: n(s.StmMillTurbine110_45ATAPRDS),
      SteamToSugar70: steamK.StmtoSug70TPH || 0,
      SteamToDist70: n(s.StmDist70),
      SteamToMill70: steamK.StmConsMillTB_PRDS || 0,
      SteamToSugar35: n(s.StmtoSugDisti),
      SteamToDist35: steamK.StmtoDistill35TPH || 0,
      SteamToMill35: 0,
      StmtoBaggase150: safeDiv(n(s.SteamGen150), n(s.Baggase150)),
      StmtoBaggase70: safeDiv(n(s.SteamGen70), n(s.Baggase70)),
      StmtoBaggase35: safeDiv(n(s.SteamGen35), n(s.Baggase35) + n(s.SlopCon)),
      TotalSteamgen: steamK.TotalSteamgen,
      SugarPct: steamK['TotalStmtoSugar(%)'] != null ? steamK['TotalStmtoSugar(%)'] * 100 : null,
      MillPct: steamK['TotalstmtoMill(%)'] != null ? steamK['TotalstmtoMill(%)'] * 100 : null,
      DistPct: steamK['Totalstmtodist(%)'] != null ? steamK['Totalstmtodist(%)'] * 100 : null,
      // Absolute shares for 100% stacked charts (Recharts stackOffset="expand")
      SugarShare:
        n(s.TotalStmtoSug150) + n(s.TotalStmtoSug70) + n(s.StmtoSugDisti),
      MillShare:
        n(s.StmMillTurbine110_45ATAPRDS) + (steamK.StmConsMillTB_PRDS || 0),
      DistShare:
        n(s.StmtoDistil110_45ATAPRDS_o) + n(s.StmDist70) + (steamK.StmtoDistill35TPH || 0),
      remark: p.remark,
    };
  });
}

export function buildOutageDailySeries(stoppageRows) {
  const byDate = new Map();
  for (const r of stoppageRows || []) {
    const d = r.Date;
    if (!d) continue;
    byDate.set(d, (byDate.get(d) || 0) + n(r.Duration));
  }
  return Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, duration]) => ({
      date,
      label: formatDateLabel(date),
      duration,
    }));
}

export function groupOutageBy(stoppageRows, key) {
  const map = new Map();
  for (const r of stoppageRows || []) {
    const k = r[key] || 'Unknown';
    map.set(k, (map.get(k) || 0) + n(r.Duration));
  }
  return Array.from(map.entries())
    .map(([name, duration]) => ({ name, duration }))
    .sort((a, b) => Math.abs(b.duration) - Math.abs(a.duration));
}

export function isBoilerSection(section) {
  return /boiler/i.test(String(section || ''));
}

export function isTurbineSection(section) {
  const s = String(section || '');
  return /turbine|grid/i.test(s) && !/boiler/i.test(s);
}

/** Stacked horizontal bars: rows = sub_section, series = section names. */
export function buildOutageStackedBySubSection(stoppageRows, sectionPredicate) {
  const sections = new Set();
  const bySub = new Map();
  for (const r of stoppageRows || []) {
    const sec = r.section || 'Unknown';
    if (sectionPredicate && !sectionPredicate(sec)) continue;
    sections.add(sec);
    const sub = (r.sub_section && String(r.sub_section).trim()) || 'OTHERS';
    if (!bySub.has(sub)) bySub.set(sub, {});
    const row = bySub.get(sub);
    row[sec] = (row[sec] || 0) + n(r.Duration);
    row._total = (row._total || 0) + n(r.Duration);
  }
  const sectionList = Array.from(sections);
  return Array.from(bySub.entries())
    .map(([name, vals]) => {
      const row = { name };
      for (const s of sectionList) row[s] = vals[s] || 0;
      row._total = vals._total || 0;
      return row;
    })
    .sort((a, b) => Math.abs(b._total) - Math.abs(a._total));
}

export function groupOutageMachinery(stoppageRows, sectionPredicate) {
  const map = new Map();
  for (const r of stoppageRows || []) {
    const sec = r.section || 'Unknown';
    if (sectionPredicate && !sectionPredicate(sec)) continue;
    const mach = r.machinery || 'Others';
    const key = `${mach}||${sec}`;
    const prev = map.get(key) || { machinery: mach, section: sec, Duration: 0 };
    prev.Duration += n(r.Duration);
    map.set(key, prev);
  }
  return Array.from(map.values()).sort((a, b) => Math.abs(b.Duration) - Math.abs(a.Duration));
}

export function formatDateLabel(iso) {
  if (!iso || iso.length < 10) return '';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatCompact(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e6) return `${(v / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(digits)}K`;
  return v.toLocaleString('en-IN', { maximumFractionDigits: digits });
}

export function formatNum(v, digits = 0) {
  if (v == null || !Number.isFinite(v)) return '—';
  return v.toLocaleString('en-IN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatPct(v, digits = 1) {
  if (v == null || !Number.isFinite(v)) return '—';
  // Accept ratio (0–1) or already percent
  const pct = Math.abs(v) <= 1.5 ? v * 100 : v;
  return `${pct.toFixed(digits)}%`;
}

export function formatInr(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return `₹${formatCompact(v, 1)}`;
}
