import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const SHIFTS = [
  { key: 'shift8_4',  label: 'Shift 8–4 (Morning)',  range: [0, 8] },
  { key: 'shift4_12', label: 'Shift 4–12 (Evening)', range: [8, 16] },
  { key: 'shift12_8', label: 'Shift 12–8 (Night)',   range: [16, 24] },
];

const TIME_SLOTS = [
  '8 AM - 9 AM','9 AM - 10 AM','10 AM - 11 AM','11 AM - 12 N',
  '12 N - 1 PM','1 PM - 2 PM','2 PM - 3 PM','3 PM - 4 PM',
  '4 PM - 5 PM','5 PM - 6 PM','6 PM - 7 PM','7 PM - 8 PM',
  '8 PM - 9 PM','9 PM - 10 PM','10 PM - 11 PM','11 PM - 12 MN',
  '12 MN - 1 AM','1 AM - 2 AM','2 AM - 3 AM','3 AM - 4 AM',
  '4 AM - 5 AM','5 AM - 6 AM','6 AM - 7 AM','7 AM - 8 AM',
];

const emptyRow = (time) => ({ time_slot: time, st1_mud:'', st1_centrate:'', st1_floc:'', st1_water:'', st1_load:'', st1_torque:'', st1_vib:'', st1_diff_speed:'', st2_mud:'', st2_centrate:'', st2_floc:'', st2_water:'', st2_load:'', st2_torque:'', st2_vib:'', st2_diff_speed:'' });

const makeHours = () => TIME_SLOTS.map(emptyRow);

const INITIAL = { date: '', season: '2025-26', crop_day: '', hours: makeHours() };

const safef = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };

const calcTotals = (hours, range) => {
  const block = hours.slice(range[0], range[1]);
  let s1mud=0,s1cent=0,s1wat=0,s1load=0,s1torq=0,s1vib=0,cnt1=0;
  let s2mud=0,s2cent=0,s2wat=0,s2load=0,s2torq=0,s2vib=0,cnt2=0;
  block.forEach((r) => {
    const add = (v, cb) => { const n=parseFloat(v); if(!isNaN(n)) cb(n); };
    add(r.st1_mud,(v)=>{s1mud+=v;}); add(r.st1_centrate,(v)=>{s1cent+=v;}); add(r.st1_water,(v)=>{s1wat+=v;});
    add(r.st1_load,(v)=>{s1load+=v;cnt1++;}); add(r.st1_torque,(v)=>{s1torq+=v;}); add(r.st1_vib,(v)=>{s1vib+=v;});
    add(r.st2_mud,(v)=>{s2mud+=v;}); add(r.st2_centrate,(v)=>{s2cent+=v;}); add(r.st2_water,(v)=>{s2wat+=v;});
    add(r.st2_load,(v)=>{s2load+=v;cnt2++;}); add(r.st2_torque,(v)=>{s2torq+=v;}); add(r.st2_vib,(v)=>{s2vib+=v;});
  });
  return {
    s1mud:s1mud.toFixed(1), s1cent:s1cent.toFixed(1), s1wat:s1wat.toFixed(1),
    s1load:cnt1?(s1load/cnt1).toFixed(0):'—', s1torq:cnt1?(s1torq/cnt1).toFixed(0):'—', s1vib:cnt1?(s1vib/cnt1).toFixed(1):'—',
    s2mud:s2mud.toFixed(1), s2cent:s2cent.toFixed(1), s2wat:s2wat.toFixed(1),
    s2load:cnt2?(s2load/cnt2).toFixed(0):'—', s2torq:cnt2?(s2torq/cnt2).toFixed(0):'—', s2vib:cnt2?(s2vib/cnt2).toFixed(1):'—',
  };
};

const ProdDecanter = () => {
  const navigate = useNavigate();
  const [form, setForm]        = useState(INITIAL);
  const [activeShift, setShift] = useState('shift8_4');
  const [submitting, setSub]   = useState(false);

  const handleMeta = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleHour = (idx, field, val) =>
    setForm((p) => { const h=[...p.hours]; h[idx]={...h[idx],[field]:val}; return {...p,hours:h}; });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSub(true);
    try {
      const rows = form.hours
        .filter((r) => Object.entries(r).some(([k,v]) => k!=='time_slot' && v!==''))
        .map((r) => ({
          date: form.date, season: form.season, crop_day: form.crop_day,
          time_slot: r.time_slot,
          st1_mud:        safef(r.st1_mud),        st1_centrate:   safef(r.st1_centrate),
          st1_floc:       safef(r.st1_floc),        st1_water:      safef(r.st1_water),
          st1_load:       safef(r.st1_load),        st1_torque:     safef(r.st1_torque),
          st1_vib:        safef(r.st1_vib),         st1_diff_speed: safef(r.st1_diff_speed),
          st2_mud:        safef(r.st2_mud),         st2_centrate:   safef(r.st2_centrate),
          st2_floc:       safef(r.st2_floc),        st2_water:      safef(r.st2_water),
          st2_load:       safef(r.st2_load),        st2_torque:     safef(r.st2_torque),
          st2_vib:        safef(r.st2_vib),         st2_diff_speed: safef(r.st2_diff_speed),
        }));
      if (rows.length === 0) { toast.error('Fill at least one hourly row.'); setSub(false); return; }
      await api.post('/forms/prod_decanter/batch', { rows });
      toast.success('Decanter Log submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSub(false);
    }
  };

  const shiftObj = SHIFTS.find((s) => s.key === activeShift);
  const totals   = calcTotals(form.hours, shiftObj.range);
  const [start, end] = shiftObj.range;

  const cell = (idx, field) => (
    <input type="number" step="any" value={form.hours[idx][field]}
      onChange={(e) => handleHour(idx, field, e.target.value)}
      className="w-full text-center py-1 px-0.5 border rounded bg-transparent focus:bg-white text-xs" />
  );

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-1">Decanter Log Book</h1>
      <p className="text-xs text-gray-500 mb-6 uppercase tracking-wider">Zuari Industries Ltd — Gobind Sugar Mill</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-section grid grid-cols-3 gap-4">
          <div><label className="label">Operation Date <span className="text-red-500">*</span></label><input type="date" name="date" value={form.date} onChange={handleMeta} required className="input" /></div>
          <div><label className="label">Season</label><input type="text" name="season" value={form.season} onChange={handleMeta} className="input" /></div>
          <div><label className="label">Crop Day</label><input type="text" name="crop_day" value={form.crop_day} onChange={handleMeta} placeholder="e.g. 34" className="input" /></div>
        </div>

        <div className="form-section flex items-center justify-between flex-wrap gap-3">
          <span className="text-sm font-semibold text-gray-700">Hourly Shift Segment</span>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {SHIFTS.map((s) => (
              <button key={s.key} type="button" onClick={() => setShift(s.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${activeShift===s.key?'bg-white text-gray-800 shadow':'text-gray-500 hover:text-gray-800'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs min-w-[1100px]">
              <thead>
                <tr className="bg-gray-100 border-b text-center font-bold uppercase text-[10px] text-gray-600">
                  <th className="py-2 px-3 border-r text-left w-28" rowSpan={2}>Time</th>
                  <th className="py-2 border-r" colSpan={8}>Decanter 1st Stage</th>
                  <th className="py-2" colSpan={8}>Decanter 2nd Stage</th>
                </tr>
                <tr className="bg-gray-50 border-b text-center font-semibold text-[9px] text-gray-500">
                  {['Mud (m³/h)','Centrate (m³/h)','Floc (PPM)','Water (m³/h)','Load (A)','Torque (%)','Vib (mm/s)','Diff Spd (rpm)'].map((h) => (
                    <th key={h} className="py-2 px-1 border-r w-[80px]">{h}</th>
                  ))}
                  {['Mud (m³/h)','Centrate (m³/h)','Floc (PPM)','Water (m³/h)','Load (A)','Torque (%)','Vib (mm/s)','Diff Spd (rpm)'].map((h) => (
                    <th key={h+'2'} className="py-2 px-1 border-r w-[80px]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {form.hours.slice(start, end).map((row, i) => {
                  const idx = start + i;
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-1.5 px-3 border-r font-sans font-semibold text-gray-800 bg-gray-50/40 text-xs">{row.time_slot}</td>
                      {['st1_mud','st1_centrate','st1_floc','st1_water','st1_load','st1_torque','st1_vib','st1_diff_speed'].map((f) => (
                        <td key={f} className="p-1 border-r">{cell(idx,f)}</td>
                      ))}
                      {['st2_mud','st2_centrate','st2_floc','st2_water','st2_load','st2_torque','st2_vib','st2_diff_speed'].map((f) => (
                        <td key={f} className="p-1 border-r">{cell(idx,f)}</td>
                      ))}
                    </tr>
                  );
                })}
                <tr className="bg-emerald-50 border-t-2 border-emerald-300 font-bold text-emerald-900 text-xs">
                  <td className="py-2 px-3 border-r font-semibold uppercase text-center">Total/Avg</td>
                  {[totals.s1mud,totals.s1cent,'—',totals.s1wat,totals.s1load,totals.s1torq,totals.s1vib,'—'].map((v,i) => (
                    <td key={i} className="py-2 px-1 border-r text-center">{v}</td>
                  ))}
                  {[totals.s2mud,totals.s2cent,'—',totals.s2wat,totals.s2load,totals.s2torq,totals.s2vib,'—'].map((v,i) => (
                    <td key={i+'b'} className="py-2 px-1 border-r text-center">{v}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => setForm(INITIAL)} className="btn-secondary">Reset</button>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit Decanter Log'}
          </button>
        </div>
      </form>
    </main>
  );
};

export default ProdDecanter;
