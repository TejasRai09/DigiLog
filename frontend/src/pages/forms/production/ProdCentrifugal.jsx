import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const MACHINES = [
  { key: 'm1', name: 'No.1 (1 Ton)' },
  { key: 'm2', name: 'No.2 (1750 Kg/Chg)' },
  { key: 'm3', name: 'No.3 (1750 Kg/Chg) NHEC' },
  { key: 'm4', name: 'No.4 (1750 Kg/Chg) WB' },
];

const makeMachine = (name) => ({ name, basket_cleaning: false, screen_condition: '', from: '', to: '', duration: '', reasons: '', separator: false, remarks: '' });

const INITIAL = {
  date: '', shift: 'shift8_4',
  shw_temp: '', shw_pressure: '', air_pressure: '',
  operator_sign: '', chemist_sign: '', section_head_sign: '',
  op_signed: false, chem_signed: false, sh_signed: false,
  m1: makeMachine('No.1 (1 Ton)'),
  m2: makeMachine('No.2 (1750 Kg/Chg)'),
  m3: makeMachine('No.3 (1750 Kg/Chg) NHEC'),
  m4: makeMachine('No.4 (1750 Kg/Chg) WB'),
};

const ProdCentrifugal = () => {
  const navigate = useNavigate();
  const [form, setForm]      = useState(INITIAL);
  const [submitting, setSub] = useState(false);

  const handleMeta = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleMachine = (key, field, val) =>
    setForm((p) => ({ ...p, [key]: { ...p[key], [field]: val } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSub(true);
    try {
      const body = {
        date: form.date, shift: form.shift,
        shw_temp: form.shw_temp, shw_pressure: form.shw_pressure, air_pressure: form.air_pressure,
        operator_sign: form.operator_sign, chemist_sign: form.chemist_sign, section_head_sign: form.section_head_sign,
      };
      MACHINES.forEach(({ key }) => {
        const m = form[key];
        body[`${key}_basket_cleaning`]  = m.basket_cleaning ? 1 : 0;
        body[`${key}_screen_condition`] = m.screen_condition;
        body[`${key}_from`]             = m.from;
        body[`${key}_to`]               = m.to;
        body[`${key}_duration`]         = m.duration;
        body[`${key}_reasons`]          = m.reasons;
        body[`${key}_separator`]        = m.separator ? 1 : 0;
        body[`${key}_remarks`]          = m.remarks;
      });
      await api.post('/forms/prod_centrifugal', body);
      toast.success('Centrifugal log submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSub(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-1">A-Centrifugal Machine Stoppage Log Book</h1>
      <p className="text-xs text-gray-500 mb-6 uppercase tracking-wider">Zuari Industries Ltd — Gobind Sugar Mill</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-section grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date <span className="text-red-500">*</span></label>
            <input type="date" name="date" value={form.date} onChange={handleMeta} required className="input" />
          </div>
          <div>
            <label className="label">Active Shift</label>
            <select name="shift" value={form.shift} onChange={handleMeta} className="input">
              <option value="shift8_4">Shift 8–4</option>
              <option value="shift4_12">Shift 4–12</option>
              <option value="shift12_8">Shift 12–8</option>
            </select>
          </div>
        </div>

        <div className="form-section space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Machine Run & Stoppage Details</h2>
          <div className="table-wrapper">
            <table className="w-full min-w-[900px] border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <th className="py-2 px-3 text-left w-44">Machine</th>
                  <th className="py-2 px-2 text-center w-28">Basket Cleaning</th>
                  <th className="py-2 px-3 w-36">Screen Condition</th>
                  <th className="py-2 px-2 text-center w-20">From</th>
                  <th className="py-2 px-2 text-center w-20">To</th>
                  <th className="py-2 px-2 text-center w-20">Duration</th>
                  <th className="py-2 px-3 w-48">Reasons for Stoppage</th>
                  <th className="py-2 px-2 text-center w-28">Separator Changing</th>
                  <th className="py-2 px-3">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y text-gray-700">
                {MACHINES.map(({ key }) => {
                  const m = form[key];
                  return (
                    <tr key={key} className="hover:bg-gray-50/50">
                      <td className="py-2 px-3 font-medium bg-gray-50/30">{m.name}</td>
                      <td className="py-2 px-2 text-center">
                        <input type="checkbox" checked={m.basket_cleaning} onChange={(e) => handleMachine(key, 'basket_cleaning', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                      </td>
                      <td className="py-2 px-3"><input type="text" value={m.screen_condition} onChange={(e) => handleMachine(key, 'screen_condition', e.target.value)} placeholder="Satisfactory" className="input py-1 text-xs" /></td>
                      <td className="py-2 px-2"><input type="text" value={m.from} onChange={(e) => handleMachine(key, 'from', e.target.value)} placeholder="00:00" className="input py-1 text-xs text-center" /></td>
                      <td className="py-2 px-2"><input type="text" value={m.to} onChange={(e) => handleMachine(key, 'to', e.target.value)} placeholder="00:00" className="input py-1 text-xs text-center" /></td>
                      <td className="py-2 px-2"><input type="text" value={m.duration} onChange={(e) => handleMachine(key, 'duration', e.target.value)} placeholder="Hrs" className="input py-1 text-xs text-center" /></td>
                      <td className="py-2 px-3"><input type="text" value={m.reasons} onChange={(e) => handleMachine(key, 'reasons', e.target.value)} placeholder="Reason..." className="input py-1 text-xs" /></td>
                      <td className="py-2 px-2 text-center">
                        <input type="checkbox" checked={m.separator} onChange={(e) => handleMachine(key, 'separator', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                      </td>
                      <td className="py-2 px-3"><input type="text" value={m.remarks} onChange={(e) => handleMachine(key, 'remarks', e.target.value)} placeholder="Observations" className="input py-1 text-xs" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Process & Thermodynamic Parameters</h2>
          <div className="grid grid-cols-3 gap-4">
            <div><label className="label">S.H.W. Temp (°C)</label><input type="number" step="any" name="shw_temp" value={form.shw_temp} onChange={handleMeta} className="input" /></div>
            <div><label className="label">S.H.W. Pressure (Kg/cm²)</label><input type="number" step="any" name="shw_pressure" value={form.shw_pressure} onChange={handleMeta} className="input" /></div>
            <div><label className="label">Air Pressure (Kg/cm²)</label><input type="number" step="any" name="air_pressure" value={form.air_pressure} onChange={handleMeta} className="input" /></div>
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Digital Sign-off & Verifications</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Operator Verification', signKey: 'operator_sign', checkedKey: 'op_signed' },
              { label: 'Shift Chemist Verification', signKey: 'chemist_sign', checkedKey: 'chem_signed' },
              { label: 'Section Head Verification', signKey: 'section_head_sign', checkedKey: 'sh_signed' },
            ].map(({ label, signKey, checkedKey }) => (
              <div key={signKey} className="bg-gray-50 border rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">{label}</p>
                  <p className="text-xs font-medium text-gray-800 mt-1">{form[checkedKey] ? `Signed: ${form[signKey]}` : 'Awaiting signature'}</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input type="checkbox" checked={form[checkedKey]}
                    onChange={(e) => setForm((p) => ({ ...p, [checkedKey]: e.target.checked, [signKey]: e.target.checked ? 'Admin' : '' }))}
                    className="w-4 h-4 text-blue-600 rounded" />
                  Verified
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => setForm(INITIAL)} className="btn-secondary">Reset</button>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </main>
  );
};

export default ProdCentrifugal;
