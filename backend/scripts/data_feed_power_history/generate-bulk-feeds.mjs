/**
 * Generate per-equipment JSON feed files from bulk sheet extract.
 * Run: node scripts/data_feed_power_history/generate-bulk-feeds.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FEED_DIR = path.join(__dirname, 'feed-data');

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function parsePipeSpecLines(lines) {
  const specs = [];
  let section = 'mechanical';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('- Sr.No.') || line.startsWith('- Weekly')) continue;
    if (/Mechanical Part Specification/i.test(line)) { section = 'mechanical'; continue; }
    if (/Instrument Part Specification/i.test(line)) { section = 'instrument'; continue; }
    if (/Electricalt? Part Specification/i.test(line)) { section = 'electrical'; continue; }
    if (/Motor Details|VFD and Other|Motor Starter Details/i.test(line)) continue;
    if (line.startsWith('- Pump Outlet Valve') || line.startsWith('- Flow Meter')) {
      section = 'instrument';
      continue;
    }
    const cleaned = line.replace(/^-\s*/, '');
    const parts = cleaned.split('|').map((p) => p.trim()).filter(Boolean);
    for (let i = 0; i + 1 < parts.length; i += 2) {
      specs.push({ lbl: parts[i], val: parts[i + 1], section });
    }
  }
  return specs;
}

function sched(no, comp, actions, intervals = {}) {
  return {
    no,
    comp,
    actions: Array.isArray(actions) ? actions : [actions],
    iv_W: intervals.W ?? null,
    iv_M: intervals.M ?? null,
    iv_Q: intervals.Q ?? null,
    iv_H: intervals.H ?? null,
    iv_Y: intervals.Y ?? null,
    iv_T: intervals.T ?? null,
    iv_3Y: intervals['3Y'] ?? null,
  };
}

const ALL_X_T = { W: 'X', M: 'X', Q: 'X', H: 'X', T: 'X' };
const Y_CHECK = { ...ALL_X_T, Y: '√' };
const W_ONLY = { W: '√' };

function record(meta) {
  return {
    hierarchy_name: meta.hierarchy_name,
    hierarchy_card: meta.hierarchy_card,
    hierarchy_path: meta.hierarchy_path,
    image_name: meta.image_name,
    name: meta.hierarchy_name,
    equip_no: meta.equip_no || '',
    tag_name: '',
    category: meta.category,
    subcategory: meta.subcategory,
    location: 'POWER PLANT',
    commissioned: meta.commissioned || '',
    drive: '',
    specs: meta.specs || [],
    schedule: meta.schedule || [],
    history: meta.history || [],
  };
}

const BFP_MOTOR_SPECS = parsePipeSpecLines([
  'Mechanical Part Specification data :-',
  'Instrument Part Specification data :-',
  'Electricalt Part Specification data :-',
  'Motor Details 1. Clarifier Drive | VFD and Other Details',
  'Make | Siemens | Rating | 555KW | Effic. | 0.966 | Type | Dual Module | Fuse | 1250A(Semi.Cond) | Power Cable | Armoured Al Cable 5RX3CX240 mm2',
  'Frame | 400 | Speed | 2985 RPM | Duty | S1 | Make | ABB | VFD Rating | 602A x 2no | Control Cable | Armoured Copper Cable 4CX1.5 mm2',
  'M/C No. | PLACEHOLDER | Load | 888A | Bearing DE / NDE | DE- 6218C3 / NDE- 6218Ins | Model No. | ACS 800-04M-0400 -3+H356+H360 | Signal Isolator | Make - Masibus , Model - 9000U | Earthing | VFD to Motor Earthing - Copper Wire (35Sqmm) & VFD Earthing 16 Sqmm Copper Wire',
  'Voltage | 415Ac | Insul. Class | F | Earthing | 50X6mm GI | Aux. Contactor | N22E - 8nos | On Load Type Changeover | Make -HPL , Rating-1600 Amp. | SDU | 1600 Amp. , Make - ABB , Model No.- OT1600E03P',
]);

function bfpSpecs(mcNo, extraInstrument = false) {
  const specs = BFP_MOTOR_SPECS.map((s) => ({
    ...s,
    val: s.lbl === 'M/C No.' ? mcNo : s.val,
  }));
  if (extraInstrument) {
    specs.push(
      { lbl: 'Pump Outlet Valve Details', val: '', section: 'instrument' },
      { lbl: 'Flow Meter Details', val: '', section: 'instrument' },
      { lbl: 'RTD Details', val: '', section: 'instrument' },
      { lbl: 'Level Transmitter Details', val: '', section: 'instrument' },
      { lbl: 'SRTC Outlet Valve Details', val: '', section: 'instrument' },
    );
  }
  return specs;
}

const EQUIPMENT = [
  record({
    hierarchy_name: 'Extraction QCNRV-2',
    hierarchy_card: 'Extraction QCNRV-2',
    hierarchy_path: 'Power Plant > 30.85MW STG > Turbine > Extraction QCNRV-2',
    image_name: '30.85 MW Turbine Extraction Condensing Cum Bleed',
    equip_no: 'ZIL/GSM/PP/01',
    category: '30.85MW STG',
    subcategory: 'Turbine',
    commissioned: '05.11.2015',
    specs: [
      { lbl: 'Make', val: 'GE Triveni Ltd', section: 'mechanical' },
      { lbl: 'Inlet Steam Flow', val: '150 TPH', section: 'mechanical' },
      { lbl: 'Rated Power', val: '30850 KW', section: 'mechanical' },
      { lbl: 'Exhaust Pressure', val: '0.098 Bar', section: 'mechanical' },
      { lbl: 'Inlet Steam Pressure', val: '102.97 Bar', section: 'mechanical' },
      { lbl: 'Turbine Overspeed Range', val: '6704-6828', section: 'mechanical' },
      { lbl: 'Turbine Speed', val: '6150 RPM', section: 'mechanical' },
      { lbl: 'Year of Manufacture', val: '2014', section: 'mechanical' },
      { lbl: 'Inlet Steam Temprature', val: '535°C', section: 'mechanical' },
      { lbl: 'Serial No.', val: 'GET-4HE-029', section: 'mechanical' },
    ],
    schedule: [
      sched(1, 'Turbine rotor', [
        'Clean & Checking of moving blades',
        'clean and check of fins',
        'cleaning and checking of general shafts',
        'Checking of Steam path clerance measurement nozzle to blades left and right',
        'Rotor Run out checking',
        'Bump test and axial float active & non-active measurement checking',
      ], ALL_X_T),
      sched(2, 'Nozzle Segment & Diaphragms', [
        'cleaning and checking of top and bottom nozzles',
        'clening and checking of top and bottoms Diaphragms nozzles',
        'Checking of steam path clearance nozzle to blades',
      ], ALL_X_T),
      sched(3, 'Rotor Glands', [
        'Checking and cleaning of HP labyrinth packing gland',
        'Checking of gland drains',
      ], ALL_X_T),
      sched(4, 'Casing', [
        'Cleanig and checking of parting plates with HP holde , BP gland ,GBC .',
        'Checking key guide',
      ], ALL_X_T),
      sched(5, 'Bearing and Coupling', [
        'Checking of both side (front and rear) journal bearing',
        'Checking of Bearings clearance before dismantling and after assembling',
        'checking and cleaning of expension blades',
        'Checking of shear pin of coupling',
      ], Y_CHECK),
      sched(6, 'ESV', [
        'Checking and cleaning of valve seat lapping and blue matching',
        'checking and cleaning of valve spindle, runout',
        'checking and cleaning of Oil piston, spring',
      ], Y_CHECK),
      sched(7, 'Control Valves', [
        'Checking and cleaning of throat valves(4nos)',
        'checking of control valves opening measurement',
        'Checking of gland packing',
        'checking seat Blue matching and spindle runout of valve',
      ], Y_CHECK),
    ],
  }),

  record({
    hierarchy_name: '30.85MW Generator Set',
    hierarchy_card: 'Alternator',
    hierarchy_path: 'Power Plant > 30.85MW STG > Turbine > Alternator',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: 'ZIL/GSM/PP/02',
    category: '30.85MW STG',
    subcategory: 'Turbine',
    commissioned: '05.11.2015',
    specs: [
      { lbl: 'Make', val: 'Andritz Pvt Ltd. Bhopal', section: 'mechanical' },
      { lbl: 'Machine Sr. No.', val: 'C- 422/327', section: 'mechanical' },
      { lbl: 'Rated Power', val: '30.85MW', section: 'mechanical' },
      { lbl: 'Year of Manufacture', val: '2014', section: 'mechanical' },
      { lbl: 'Rated Voltage', val: '11 ±10% KV', section: 'mechanical' },
      { lbl: 'Rated Current', val: '2024 Amp.', section: 'mechanical' },
      { lbl: 'Protection', val: 'IP54', section: 'mechanical' },
      { lbl: 'Winding Insulation Class', val: 'F - Class', section: 'mechanical' },
    ],
    schedule: [
      sched(1, 'Stator', [
        'Clean & Check of winding , Supports & Bandages',
        'Checking of Busbar terminal & Joints.',
        'Cleaning of Stator winding and Connection',
        'Measure IR of Stator winding.',
      ], Y_CHECK),
      sched(2, 'Rotor', [
        'Measure IR of Field winding.',
        'Check whether all fastening elements are tight.',
        'Visual Inspection of Rotor.',
      ], Y_CHECK),
      sched(3, 'Generator Bearing', [
        'Check Quality of bearing oil.',
        'Extended visual inspection of end shields.',
      ], Y_CHECK),
      sched(4, 'Brushless Exciter', [
        'Measure IR of Rotor winding.',
        'Measure IR of Stator winding.',
        'Functional Test of Diode.',
        'Check whether all fastening elements are tight.',
        'Visual Inspection of Exciter.',
      ], Y_CHECK),
      sched(5, 'Oil System', ['Visual inspection on all oil - conveying pipes'], Y_CHECK),
      sched(6, 'Cooling System', [
        'Visual inspection of Air - Water Cooler .',
        'Hydraulic Test of Air - Water Cooler .',
      ], Y_CHECK),
      sched(7, 'Heating system', ['Check function of heating system'], Y_CHECK),
      sched(8, 'Monitoring Instruments', [
        'Inspection of Monitoring Instrument',
        'Check slip ring brushes Condition for the ground fault detection',
      ], W_ONLY),
    ],
    history: [
      { year: '2016', obs: 'NO', act: 'NO', resp: 'Mr. Dileep Kumar', rem: 'Generator Healthy' },
      { year: '2017', obs: 'NO', act: 'NO', resp: 'Mr. Dileep Kumar', rem: 'Generator Healthy' },
      { season: 'Off-Season', year: '2018', obs: 'During OFF Season - 2018 Inspection of 30.85MW Alternator Rotor & found Dislocation of Rotor bandages of Alternator ,observed in some area at both end rotor.', act: 'Rotor sent to M/s Andritz workshop Bhopal for repairing of Rotor bandages and testing on dated 24.09.2018.', cost: '57 Lakh', svc: 'External', provider: 'External Agency', resp: 'Mr. Dileep Kumar', rem: 'Rotor sent to OEM for repairing & testing' },
      { year: '2019', obs: 'NO', act: 'NO', resp: 'Mr. Dileep Kumar', rem: 'Rotor bandages gap measured & Recorded after Closing of Season' },
      { year: '2020', obs: 'NO', act: 'NO', resp: 'Mr. Dileep Kumar', rem: 'Rotor bandages gap measured & Recorded after Closing of Season' },
      { year: '2021', obs: 'NO', act: 'NO', resp: 'Mr. Dileep Kumar', rem: 'Rotor bandages gap measured & Recorded after Closing of Season' },
      { year: '2022', obs: 'NO', act: 'NO', resp: 'Mr. Dileep Kumar', rem: 'Rotor bandages gap measured & Recorded after Closing of Season' },
      { season: 'Off-Season', year: '2023', obs: '30.85 MW Alternator Schedule Maintenance as per OEM Recommendation during OFF Season -23', act: '30.85 MW Alternator dismantled at GSMA Site for Overhauling & Testing in presence of Triveni Engineer', cost: '13 Lakh', svc: 'External', provider: 'External Agency', resp: 'Mr. Dileep Kumar', rem: 'Alternator Dismantled for Overhauling & Testing at Site' },
      { season: 'Off-Season', year: '2024', obs: 'NO', act: 'NO', resp: 'Mr. Dileep Kumar', rem: 'Rotor bandages gap measured & Recorded after Closing of Season' },
    ],
  }),

  record({ hierarchy_name: 'HP Heater -1', hierarchy_card: 'HP-01', hierarchy_path: 'Power Plant > 150TPH BLR > Auxiliary Equipment > HP-01', image_name: 'HP Heater No.-1', equip_no: 'ZIL/GSM/PP/04', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' }),
  record({ hierarchy_name: 'HP Heater -2', hierarchy_card: 'HP-02', hierarchy_path: 'Power Plant > 150TPH BLR > Auxiliary Equipment > HP-02', image_name: 'HP Heater No.- 2', equip_no: 'ZIL/GSM/PP/05', category: '150TPH BLR', subcategory: 'Auxiliary Equipment' }),

  record({ hierarchy_name: '150TPH Boiler', hierarchy_card: 'Steam Drum', hierarchy_path: 'Power Plant > 150TPH BLR > Pressure Parts > Steam Drum', image_name: '150TPH High Pressure Boiler', equip_no: 'ZIL/GSM/PP/03', category: '150TPH BLR', subcategory: 'Pressure Parts' }),

  ...['1', '2', '3', '4'].map((n, i) => record({
    hierarchy_name: `BFP-${n}`,
    hierarchy_card: `BFP -0${n}`,
    hierarchy_path: `Power Plant > 150TPH BLR > Auxiliary Equipment > BFP -0${n}`,
    image_name: '30.85 MW GENERATOR SET',
    equip_no: `ZIL/GSM/PP/0${6 + i}`,
    category: '150TPH BLR',
    subcategory: 'Auxiliary Equipment',
    commissioned: '05.11.2015',
    specs: bfpSpecs(['N8/64710647', 'N8/64710976', 'N8/6471485', 'N8/64713311'][i], n === '3'),
    history: n === '1' ? [{
      season: 'Off-Season', year: '2023', date_start: '2023-08-16', date_finish: '2023-08-17',
      obs: 'Preventive maintenance', act: 'Internal', svc: 'Internal', resp: 'Mr. Dileep Kumar',
    }] : [],
  })),

  ...[
    { name: 'ID Fan -1', card: 'ID Fan -01', equip: '10', mc: 'N8/64680315', rating: '500KW', speed: '993 RPM', load: '848A', bearing: 'DE- 6326C3 / NDE- 6326 M', model: 'ACS 800-04M-0400 -3+H356+H360', insul: 'H' },
    { name: 'ID Fan-2', card: 'ID Fan -02', equip: '11', mc: 'N8/64681620', rating: '500KW', speed: '993 RPM', load: '848A', bearing: 'DE- 6326C3 / NDE- 6326 M', model: 'ACS 880-04-650A-3+B051+E208', insul: 'H' },
    { name: 'FD Fan-1', card: 'FD Fan -01', equip: '12', mc: '', rating: '110KW', speed: '1487 RPM', load: '191 A', bearing: 'DE- 6319C3 / NDE-6319 Ins', model: 'ACS850-04-225A-5', insul: 'F', frame: '315S' },
    { name: 'FD Fan-2', card: 'FD Fan -02', equip: '13', mc: 'N8/64696995', rating: '110KW', speed: '1487 RPM', load: '191 A', bearing: 'DE- 6319C3 / NDE-6319 Ins', model: 'ACS850-04-225A-5', insul: 'F', frame: '315S' },
    { name: 'SA Fan -1', card: 'SA Fan -01', equip: '14', mc: 'N8/64696243', rating: '132KW', speed: '1487 RPM', load: '223 A', bearing: 'DE- 6319C3 / NDE-6319 Ins', model: 'ACS850-04-260A-5', insul: 'F', frame: '315M' },
    { name: 'SA Fan -2', card: 'SA Fan -02', equip: '', mc: 'N8/64696244', rating: '132KW', speed: '1487 RPM', load: '223 A', bearing: 'DE- 6319C3 / NDE-6319 Ins', model: 'ACS850-04-260A-5', insul: 'F', frame: '315M' },
  ].map((f) => record({
    hierarchy_name: f.name,
    hierarchy_card: f.card,
    hierarchy_path: `Power Plant > 150TPH BLR > Auxiliary Equipment > ${f.card}`,
    image_name: '30.85 MW GENERATOR SET',
    equip_no: f.equip ? `ZIL/GSM/PP/${f.equip}` : '',
    category: '150TPH BLR',
    subcategory: 'Auxiliary Equipment',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | VFD and Other Details',
      `Make | Siemens | Rating | ${f.rating} | Effic. | 0.965 | Type | Dual Module | Fuse | 1250A(Semi.Cond) | Power Cable | Armoured Al Cable 5RX3CX240 mm2`,
      `Frame | ${f.frame || '400'} | Speed | ${f.speed} | Duty | S1 | Make | ABB | VFD Rating | 602A x 2no | Control Cable | Armoured Copper Cable 4CX1.5 mm2`,
      `M/C No. | ${f.mc} | Load | ${f.load} | Bearing DE / NDE | ${f.bearing} | Model No. | ${f.model} | Signal Isolator | Make - Masibus , Model - 9000U | Earthing | VFD to Motor Earthing - Copper Wire (35Sqmm) & VFD Earthing 16 Sqmm Copper Wire`,
      `Voltage | 415AC | Insul. Class | ${f.insul} | Earthing | 50X6mm GI | Aux. Contactor | N22E - 8nos | On Load Type Changeover | Make -HPL , Rating-1600 Amp. | SDU | 1600 Amp. , Make - ABB , Model No.- OT1600E03P`,
    ]),
  })),

  ...[
    { n: '1', equip: '15', mc: '100730120', rating: '30KW', load: '51 A', make: 'Baldor Reliance', frame: 'D200L', speed: '1465 RPM', bearing: 'DE- 6311C3 / NDE-6311c3', contactor: 'A95-30', mpcb: '45-63A', setting: '60A', cable: '70mm2' },
    { n: '2', equip: '16', mc: '131026001', rating: '18.5KW', load: '34.25 A', make: 'Baldor Reliance', frame: 'TCI180M', speed: '1470 RPM', bearing: 'DE- 6311C3 / NDE-6311c3', contactor: 'A75-30', mpcb: '28-40A', setting: '28A', cable: '35mm2' },
    { n: '3', equip: '17', mc: '137542', rating: '11KW', load: '22 A', make: 'ABB', frame: 'HXI160M', speed: '1455 RPM', bearing: 'DE- 6309ZZC3 / NDE-6308ZZC3', contactor: 'A50-30', mpcb: '20-25A', setting: '21A', cable: '25mm2' },
    { n: '4', equip: '18', mc: '131031186', rating: '15KW', load: '24.63 A', make: 'Baldor Reliance', frame: 'T3C160L', speed: '1445 RPM', bearing: 'DE- 6309ZZC3 / NDE-6308ZZC3', contactor: 'A63-30', mpcb: '25-32A', setting: '29A', cable: '70mm2' },
    { n: '5', equip: '19', mc: '130904088', rating: '18.5KW', load: '32.32 A', make: 'Baldor Reliance', frame: 'T3CI180M', speed: '1445 RPM', bearing: 'DE- 6309ZZC3 / NDE-6308ZZC3', contactor: 'A63-30', mpcb: '28-40A', setting: '28A', cable: '70mm2' },
    { n: '6', equip: '20', mc: '838668', rating: '18.5KW', load: '28.50 A', make: 'ABB', frame: 'HX180M', speed: '1460 RPM', bearing: 'DE- 6311ZZC3 / NDE-6311ZZC3', contactor: 'A63-30', mpcb: '28-40A', setting: '28A', cable: '35mm2' },
    { n: '7', equip: '21', mc: '101026016', rating: '11KW', load: '18.90 A', make: 'Baldor Reliance', frame: 'T3CI160M', speed: '1460 RPM', bearing: 'DE- 6309ZZC3 / NDE-6309ZZC3', contactor: 'A63-30', mpcb: '28-40A', setting: '28A', cable: '70mm2' },
    { n: '8', equip: '22', mc: 'K586595', rating: '15KW', load: '27.6 A', make: 'Bharat Bijlee', frame: '160L', speed: '1450 RPM', bearing: 'DE- 6309ZZC3 / NDE-6309ZZC3', contactor: 'A50-30', mpcb: '25-32A', setting: '26A', cable: '35mm2' },
  ].map((b) => record({
    hierarchy_name: `BC-${b.n}`,
    hierarchy_card: `Belt Conveyor -0${b.n}`,
    hierarchy_path: `Power Plant > 150TPH BLR > Fuel Handling System (Phase-1) > Belt Conveyor -0${b.n}`,
    image_name: '30.85 MW GENERATOR SET',
    equip_no: `ZIL/GSM/PP/${b.equip}`,
    category: '150TPH BLR',
    subcategory: 'Fuel Handling System (Phase-1)',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | Motor Starter Details',
      `Make | ${b.make} | Rating | ${b.rating} | Effic. | 0.955 | Type | DOL Starter | MPCB Make | ABB | Power Cable | Armoured Al Cable 1RX3CX${b.cable}`,
      `Frame | ${b.frame} | Speed | ${b.speed} | Duty | S1 | Contactor Make | ABB | MPCB Rating | ${b.mpcb} | Control Cable | Armoured Copper Cable 4CX1.5mm2`,
      `M/C No. | ${b.mc} | Load | ${b.load} | Bearing DE / NDE | ${b.bearing} | Power Contactor Rating | ${b.contactor} | MPCB Setting | ${b.setting} | Earthing | Copper Wire ( 4Sqmm)`,
      'Voltage | 415AC | Insul. Class | F | Earthing | 25X6mm GI | Aux. Contactor | NX22E-2Nos | Control MCB | 2P 6A - 1 Nos 1P 6A- 1Nos | Voltage | 415 AC',
    ]),
  })),

  record({
    hierarchy_name: 'Bagasse Elevator',
    hierarchy_card: 'Bagasse Elevator',
    hierarchy_path: 'Power Plant > 150TPH BLR > Fuel Handling System (Phase-1) > Bagasse Elevator',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: 'ZIL/GSM/PP/23',
    category: '150TPH BLR',
    subcategory: 'Fuel Handling System (Phase-1)',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | Motor Starter Details',
      'Make | Baldor Reliance | Rating | 37KW | Effic. | 0.902 | Type | Y-D Starter | MCCB Rating | 125A | Power Cable | Armoured Al Cable 2RX3CX70mm2',
      'Frame | D225MDM | Speed | 1470PM | Duty | S1 | Contactor Make | ABB | MPR Rating | 2 - 5.5A | Control Cable | Armoured Cu Cable 4CX1.5mm2',
      'M/C No. | C0701110103 | Load | 76A | Bearing DE / NDE | DE- 6313C3 / NDE-6312C3 | Power Contactor Rating | A75-30 -2Nos A50-10 - 1nos | MPR Setting | 2.5A | Earthing | Copper Wire ( 4.0Sqmm)',
      'Voltage | 415AC | Insul. Class | F | Earthing | 25X6mm GI | Aux. Contactor | NX22E-2Nos. | Control MCB | 2P 6A - 1 Nos 1P 6A- 1Nos | Voltage | 415 AC',
    ]),
  }),

  record({
    hierarchy_name: 'Slat Chain',
    hierarchy_card: 'Slat Chain Carrier',
    hierarchy_path: 'Power Plant > 150TPH BLR > Fuel Handling System (Phase-1) > Slat Chain Carrier',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: 'ZIL/GSM/PP/24',
    category: '150TPH BLR',
    subcategory: 'Fuel Handling System (Phase-1)',
    commissioned: '05.11.2012015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | Motor Starter Details',
      'Make | Baldor Reliance | Rating | 37KW | Effic. | 0.902 | Type | Y-D Starter | MCCB Rating | 125A | Power Cable | Armoured Al Cable 2RX3CX35mm2',
      'Frame | D225MDM | Speed | 1470 RPM | Duty | S1 | Contactor Make | ABB | MPR Rating | 2 - 5.5A | Control Cable | Armoured Cu Cable 4CX1.5mm2',
      'M/C No. | C0701110109 | Load | 76 A | Bearing DE / NDE | DE- 6313C3 / NDE-6312C3 | Power Contactor Rating | A75-30 -2Nos A50-10 - 1nos | MPR Setting | 2.5A | Earthing | Copper Wire ( 4.0Sqmm)',
      'Voltage | 415AC | Insul. Class | F | Earthing | 25X6mm GI | Aux. Contactor | NX22E-2Nos. | Control MCB | 2P 6A - 1 Nos 1P 6A- 1Nos | Voltage | 415 AC',
    ]),
  }),

  record({
    hierarchy_name: 'MCW Pump-1',
    hierarchy_card: 'Pumps',
    hierarchy_path: 'Power Plant > 30.85MW STG > Condenser > Pumps',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: 'ZIL/GSM/PP/25',
    category: '30.85MW STG',
    subcategory: 'Condenser',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | VFD and Other Details',
      'Make | Siemens | Rating | 315 | Effic. | 0.96 | Type | Single Module | Fuse | 1600A(Semi.Cond.) | Power Cable | Armoured Al Cable 3RX3CX 240 mm2',
      'Frame | 355 | Speed | 992 | Duty | S1 | Make | ABB | VFD Rating | 807A | Control Cable | Armoured Copper Cable 4CX1.5 mm2',
      'M/C No. | 64728342 | Load | 550 | Bearing DE / NDE | NU220/6322C3 Ins. | Model No. | ACS850-04-807A-5 | Signal Isolator | Make - Masibus , Model - 9000U | Earthing | VFD to Motor Earthing - Al.Cable -35Sqmm & VFD Earthing 16 Sqmm Cu Wire',
      'Voltage | 415AC | Insul. Class | F | Earthing | 50X6mm GI | Aux. Contactor | N22E- 06Nos. | On Load Type Changeover | Make -HPL , Rating- 1250 Amp. | SDU | 1250 Amp. , Make - ABB , Model No.- OT1250E03P',
    ]),
  }),

  record({
    hierarchy_name: 'MOP',
    hierarchy_card: 'Oil Cooler',
    hierarchy_path: 'Power Plant > 30.85MW STG > Turbine > Oil Cooler',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: '',
    category: '30.85MW STG',
    subcategory: 'Turbine',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | Motor Starter Details',
      'Make | Seimens | Rating | 37 KW | Effic. | 0.939 | Type | DOL Starter | MPCB Make | ABB | Power Cable | Armoured Al Cable 1RX3CX35mm2',
      'Frame | 225S | Speed | 1475RPM | Duty | S1 | Contactor Make | ABB | MCCB Rating | 250A | Control Cable | Armoured Copper Cable 4CX1.5mm2',
      'M/C No. | 64715655 | Load | 64A | Bearing DE / NDE | 6313ZC3/ 6313ZC3 | Power Contactor Rating | A95-30 | MPR Setting | 2.0 to 5.5 A | Earthing | Copper Wire ( 4Sqmm)',
      'Voltage | 415 AC | Insul. Class | F | Earthing | 25X6mm GI | Aux. Contactor | NX22E-2Nos | Control MCB | 2P 6A - 1 Nos 1P 6A- 1Nos | Voltage | 415 AC',
    ]),
  }),

  record({
    hierarchy_name: 'CEP No.-1',
    hierarchy_card: 'Pumps',
    hierarchy_path: 'Power Plant > 30.85MW STG > Turbine > Pumps',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: '',
    category: '30.85MW STG',
    subcategory: 'Turbine',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | VFD and Other Details',
      'Make | Baldor Reliance | Rating | 37KW | Effic. | 0.922 | Type | Single Module | Fuse | 250A(Semi.Cond.) | Power Cable | Armoured Al Cable 1RX3CX 70 mm2',
      'Frame | D200L | Speed | 2930 RPM | Duty | S1 | Make | ABB | VFD Rating | 125A | Control Cable | Armoured Copper Cable 4CX1.5 mm2',
      'M/C No. |  | Load | 67 A | Bearing DE / NDE | DE- 6312C3 / NDE-6312C3 | Model No. | ACS550-01-125A-4 | Signal Isolator | Make - Masibus , Model - 9000U | Earthing | VFD to Motor Earthing - Al.Cable -35Sqmm & VFD Earthing 16 Sqmm Cu Wire',
      'Voltage | 415AC | Insul. Class | F | Earthing | 25X6mm GI | Aux. Contactor | N22E- 06Nos. | On Load Type Changeover | Make -ABB , Rating- 250 Amp. | MCCB | 250 Amp. , Make - ABB',
    ]),
  }),

  record({
    hierarchy_name: 'CT Fan No.-1',
    hierarchy_card: 'Cooling Tower',
    hierarchy_path: 'Power Plant > 30.85MW STG > Turbine > Cooling Tower',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: 'ZIL/GSM/PP/30',
    category: '30.85MW STG',
    subcategory: 'Turbine',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | VFD and Other Details',
      'Make | Baldor Reliance | Rating | 75 | Effic. | 0.95 | Type | Single Module | Fuse | 550A(Semi.Cond.) | Power Cable | Armoured Al Cable 1RX3CX120 mm2',
      'Frame | 280S | Speed | 1486 | Duty | S1 | Make | ABB | VFD Rating | 260A | Control Cable | Armoured Copper Cable 4CX1.5 mm2',
      'M/C No. | 140129121 | Load | 120.69 | Bearing DE / NDE | 6316C3/ 6316C3 Ins. | Model No. | ACS850-04-260A-5 | Signal Isolator | Make - Masibus , Model - 9000U | Earthing | VFD to Motor Earthing - Al.Cable -35Sqmm & VFD Earthing 16 Sqmm Cu Wire',
      'Voltage | 415AC | Insul. Class | F | Earthing | 50X6mm GI | Aux. Contactor | N22E- 06Nos. | On Load Type Changeover | Make -HPL , Rating- 250 Amp. | SDU | 315 Amp. , Make - ABB , Model No.- OT315E03P',
    ]),
  }),

  record({
    hierarchy_name: 'Inst.Air Comp.-1',
    hierarchy_card: 'Service Air Compressor',
    hierarchy_path: 'Power Plant > 150TPH BLR > Ash Handling System > Service Air Compressor',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: '',
    category: '150TPH BLR',
    subcategory: 'Ash Handling System',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | VFD and Other Details',
      'Make | Siemens | Rating | 75 | Effic. | 0.95 | Type | Single Module | Fuse | 550A(Semi.Cond.) | Power Cable | Armoured Al Cable 1RX3CX 120 mm2',
      'Frame | 280S | Speed | 1475 | Duty | S1 | Make | ABB | VFD Rating | 260A | Control Cable | Armoured Copper Cable 4CX1.5 mm2',
      'M/C No. | 64704454 | Load | 129 | Bearing DE / NDE | NU317/ 6317C3 Ins. | Model No. | ACS850-04-260A-5 | Signal Isolator | Make - Masibus , Model - 9000U | Earthing | VFD to Motor Earthing - Al.Cable -35Sqmm & VFD Earthing 16 Sqmm Cu Wire',
      'Voltage | 415AC | Insul. Class | F | Earthing | 50X6mm GI | Aux. Contactor | N22E- 06Nos. | On Load Type Changeover | Make -HPL , Rating- 315 Amp. | SDU | 315 Amp. , Make - ABB , Model No.- OT315E03P',
    ]),
  }),

  record({
    hierarchy_name: 'CEP No.-2',
    hierarchy_card: 'Exhaust Condensate Drain Pump-2',
    hierarchy_path: 'Power Plant > 70TPH BLR > Auxiliary Equipment > Exhaust Condensate Drain Pump-2',
    image_name: '30.85 MW GENERATOR SET',
    equip_no: '',
    category: '70TPH BLR',
    subcategory: 'Auxiliary Equipment',
    commissioned: '05.11.2015',
    specs: parsePipeSpecLines([
      'Electricalt Part Specification data :-',
      'Motor Details 1. Clarifier Drive | Motor Starter Details',
      'Make | Baldor Reliance | Rating | 37KW | Effic. | 0.922 | Type | Y-D Starter | MCCB Rating | 125A | Power Cable | Armoured Al Cable 2RX3CX25mm2',
      'Frame | D200L | Speed | 2930 RPM | Duty | S1 | Contactor Make | ABB | MPR Rating | 2 - 5.5A | Control Cable | Armoured Cu Cable 4CX1.5mm2',
      'M/C No. |  | Load | 67 A | Bearing DE / NDE | DE- 6312C3 / NDE-6312C3 | Power Contactor Rating | A75-30 -2Nos A50-10 - 1nos | MPR Setting | 3.0A | Earthing | Copper Wire ( 4.0Sqmm)',
      'Voltage | 415AC | Insul. Class | F | Earthing | 25X6mm GI | Aux. Contactor | NX22E-2Nos. | Control MCB | 2P 6A - 1 Nos 1P 6A- 1Nos | Voltage | 415 AC',
    ]),
  }),

];

// Fix typo in slat chain commissioned
const slat = EQUIPMENT.find((e) => e.hierarchy_name === 'Slat Chain');
if (slat) slat.commissioned = '05.11.2015';

if (!fs.existsSync(FEED_DIR)) fs.mkdirSync(FEED_DIR, { recursive: true });

const written = [];
for (const eq of EQUIPMENT) {
  const zil = (eq.equip_no || '').replace(/\//g, '-').toLowerCase() || 'no-zil';
  const file = `${slugify(eq.hierarchy_name)}-${zil}.json`;
  const outPath = path.join(FEED_DIR, file);
  fs.writeFileSync(outPath, `${JSON.stringify({ equipment: [eq] }, null, 2)}\n`, 'utf8');
  written.push(file);
}

console.log(`Wrote ${written.length} feed files:`);
for (const f of written) console.log(`  ${f}`);
