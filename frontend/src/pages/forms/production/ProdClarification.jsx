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

const emptyRow = (time) => ({ time_slot:time, juice_flow:'', mol_dose:'', mol_set_be:'', mol_std_wt:'', mol_meas_be:'', mol_meas_wt:'', vessel_std_time:'', vessel_meas_time:'', ph_pre:'', ph_shock:'', ph_sulphured:'', sulphur_temp:'', boiler_temp:'', boiler_press:'', op_sign:'', chem_sign:'', remarks:'' });

const makeHours = () => TIME_SLOTS.map(emptyRow);

const INITIAL = { date:'', season:'2025-26', crop_day:'', inst_hod:'', inst_dy_hod:'', inst_sectional_head:'', hours:makeHours() };

const safef = (v) => { const n=parseFloat(v); return isNaN(n)?null:n; };

const ProdClarification = () => {
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
          date:form.date, season:form.season, crop_day:form.crop_day,
          inst_hod:form.inst_hod, inst_dy_hod:form.inst_dy_hod, inst_sectional_head:form.inst_sectional_head,
          time_slot:r.time_slot,
          juice_flow:safef(r.juice_flow), mol_dose:safef(r.mol_dose),
          mol_set_be:safef(r.mol_set_be), mol_std_wt:safef(r.mol_std_wt),
          mol_meas_be:safef(r.mol_meas_be), mol_meas_wt:safef(r.mol_meas_wt),
          vessel_std_time:safef(r.vessel_std_time), vessel_meas_time:safef(r.vessel_meas_time),
          ph_pre:safef(r.ph_pre), ph_shock:safef(r.ph_shock), ph_sulphured:safef(r.ph_sulphured),
          sulphur_temp:safef(r.sulphur_temp), boiler_temp:safef(r.boiler_temp), boiler_press:safef(r.boiler_press),
          op_sign:r.op_sign, chem_sign:r.chem_sign, remarks:r.remarks,
        }));
      if (rows.length===0) { toast.error('Fill at least one hourly row.'); setSub(false); return; }
      await api.post('/forms/prod_clarification/batch', { rows });
      toast.success('Clarification Log submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSub(false);
    }
  };

  const shiftObj = SHIFTS.find((s) => s.key===activeShift);
  const [start, end] = shiftObj.range;

  const cell = (idx, field, type='number') => (
    <input type={type} step="any" value={form.hours[idx][field]}
      onChange={(e) => handleHour(idx, field, e.target.value)}
      className="w-full text-center py-1 px-0.5 border rounded bg-transparent focus:bg-white text-xs" />
  );

  return (
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-1">Clarification Log Book</h1>
      <p className="text-xs text-gray-500 mb-6 uppercase tracking-wider">Zuari Industries Ltd — Gobind Sugar Mill · ISO 9001</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-section grid grid-cols-3 gap-4">
          <div><label className="label">Operation Date <span className="text-red-500">*</span></label><input type="date" name="date" value={form.date} onChange={handleMeta} required className="input" /></div>
          <div><label className="label">Season</label><input type="text" name="season" value={form.season} onChange={handleMeta} className="input" /></div>
          <div><label className="label">Crop Day</label><input type="text" name="crop_day" value={form.crop_day} onChange={handleMeta} placeholder="e.g. 34" className="input" /></div>
        </div>

        <div className="form-section space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Instructions</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">HOD</label><textarea name="inst_hod" value={form.inst_hod} onChange={handleMeta} rows={2} className="input resize-none" /></div>
            <div><label className="label">Dy HOD</label><textarea name="inst_dy_hod" value={form.inst_dy_hod} onChange={handleMeta} rows={2} className="input resize-none" /></div>
            <div><label className="label">Sectional Head</label><textarea name="inst_sectional_head" value={form.inst_sectional_head} onChange={handleMeta} rows={2} className="input resize-none" /></div>
          </div>
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
          <div className="table-wrapper">
            <table className="w-full min-w-[1300px] border-collapse text-left text-xs">
              <thead>
                <tr className="bg-gray-50 border-b text-[9px] font-bold uppercase text-gray-500">
                  <th className="py-2 px-3 border-r w-28">Time</th>
                  <th className="py-2 px-1 border-r w-16">Juice Flow (T/Hr)</th>
                  <th className="py-2 px-1 border-r w-16">MOL Dose (L/Min)</th>
                  <th className="py-2 px-1 border-r w-16">MOL Set Be</th>
                  <th className="py-2 px-1 border-r w-16">MOL Std Wt</th>
                  <th className="py-2 px-1 border-r w-16">MOL Meas Be</th>
                  <th className="py-2 px-1 border-r w-16">MOL Meas Wt</th>
                  <th className="py-2 px-1 border-r w-16">Vessel Std (min)</th>
                  <th className="py-2 px-1 border-r w-16">Vessel Meas (min)</th>
                  <th className="py-2 px-1 border-r w-14">pH Pre</th>
                  <th className="py-2 px-1 border-r w-14">pH Shock</th>
                  <th className="py-2 px-1 border-r w-14">pH Sulph.</th>
                  <th className="py-2 px-1 border-r w-16">Sulphur Temp (°C)</th>
                  <th className="py-2 px-1 border-r w-16">Boiler Temp (°C)</th>
                  <th className="py-2 px-1 border-r w-16">Boiler Press</th>
                  <th className="py-2 px-1 border-r w-16">Op Sign</th>
                  <th className="py-2 px-1 border-r w-16">Chem Sign</th>
                  <th className="py-2 px-1 w-24">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 font-mono">
                {form.hours.slice(start, end).map((row, i) => {
                  const idx = start + i;
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-1 px-3 border-r font-sans font-semibold text-gray-800 bg-gray-50/40 text-xs">{row.time_slot}</td>
                      {['juice_flow','mol_dose','mol_set_be','mol_std_wt','mol_meas_be','mol_meas_wt','vessel_std_time','vessel_meas_time','ph_pre','ph_shock','ph_sulphured','sulphur_temp','boiler_temp','boiler_press'].map((f) => (
                        <td key={f} className="p-1 border-r">{cell(idx,f)}</td>
                      ))}
                      <td className="p-1 border-r">{cell(idx,'op_sign','text')}</td>
                      <td className="p-1 border-r">{cell(idx,'chem_sign','text')}</td>
                      <td className="p-1">{cell(idx,'remarks','text')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => setForm(INITIAL)} className="btn-secondary">Reset</button>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit Clarification Log'}
          </button>
        </div>
      </form>
    </main>
  );
};

export default ProdClarification;
