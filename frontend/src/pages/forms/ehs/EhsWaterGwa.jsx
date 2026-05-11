import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const INITIAL = {
  date: '',
  gw_pump1_meter:     '', gw_pump1_ext_kl:  '',
  gw_pump2_meter:     '', gw_pump2_ext_kl:  '',
  total_ext_kl:       '',
  dom_colony:         '', dom_fire:           '',
  ind_distillery:     '', ind_power_plant:    '', ind_refinery: '',
  total_industrial:   '',
  cane_crush_ondate:  '', cane_crush_todate:  '',
  sugar_total_lt:     '', industrial_lt:      '', total_ext_sugar_lt: '',
  remarks: '',
};

const NumField = ({ label, name, value, onChange }) => (
  <div>
    <label className="label">{label}</label>
    <input type="number" step="any" name={name} value={value} onChange={onChange} className="input" />
  </div>
);

const EhsWaterGwa = () => {
  const navigate            = useNavigate();
  const [form, setForm]     = useState(INITIAL);
  const [submitting, setSub] = useState(false);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSub(true);
    try {
      await api.post('/forms/ehs_water_gwa', form);
      toast.success('Water report submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSub(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-6">Water Dashboard — Ground Water Abstraction</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Date */}
        <div className="form-section space-y-4">
          <div>
            <label className="label">Date<span className="text-red-500 ml-0.5">*</span></label>
            <input type="date" name="date" value={form.date} onChange={handle} required className="input" />
          </div>
        </div>

        {/* Bore Well Pump Readings */}
        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Ground Water Pumped (KLD)</h2>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Pump 1 — Meter Reading (Truck Yard)" name="gw_pump1_meter"   value={form.gw_pump1_meter}   onChange={handle} />
            <NumField label="Pump 1 — Extracted (KL)"             name="gw_pump1_ext_kl" value={form.gw_pump1_ext_kl} onChange={handle} />
            <NumField label="Pump 2 — Meter Reading (36 Block)"   name="gw_pump2_meter"   value={form.gw_pump2_meter}   onChange={handle} />
            <NumField label="Pump 2 — Extracted (KL)"             name="gw_pump2_ext_kl" value={form.gw_pump2_ext_kl} onChange={handle} />
          </div>
          <NumField label="Total Extracted from Bore Wells (KL)" name="total_ext_kl" value={form.total_ext_kl} onChange={handle} />
        </div>

        {/* Domestic Uses */}
        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Water Uses — Domestic</h2>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Colony (KL)"          name="dom_colony" value={form.dom_colony} onChange={handle} />
            <NumField label="Fire &amp; Labour (KL)" name="dom_fire"   value={form.dom_fire}   onChange={handle} />
          </div>
        </div>

        {/* Industrial Uses */}
        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Water Uses — Industrial</h2>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="Distillery (KL)"             name="ind_distillery"   value={form.ind_distillery}   onChange={handle} />
            <NumField label="Power Plant (KL)"            name="ind_power_plant"  value={form.ind_power_plant}  onChange={handle} />
            <NumField label="Refinery + DS + Mill (KL)"  name="ind_refinery"     value={form.ind_refinery}     onChange={handle} />
            <NumField label="Total Industrial (KL)"      name="total_industrial"  value={form.total_industrial} onChange={handle} />
          </div>
        </div>

        {/* Cane Crushing */}
        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Cane Crushing (TCD)</h2>
          <div className="grid grid-cols-2 gap-4">
            <NumField label="On Date"  name="cane_crush_ondate" value={form.cane_crush_ondate} onChange={handle} />
            <NumField label="To Date"  name="cane_crush_todate" value={form.cane_crush_todate} onChange={handle} />
          </div>
        </div>

        {/* Water per Tonne Cane */}
        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Water per Tonne Cane (L/T)</h2>
          <div className="grid grid-cols-3 gap-4">
            <NumField label="Sugar + Dist (L/T)"        name="sugar_total_lt"     value={form.sugar_total_lt}     onChange={handle} />
            <NumField label="Industrial (L/T)"          name="industrial_lt"      value={form.industrial_lt}      onChange={handle} />
            <NumField label="Total Sugar Ext (L/T)"     name="total_ext_sugar_lt" value={form.total_ext_sugar_lt} onChange={handle} />
          </div>
        </div>

        {/* Remarks */}
        <div className="form-section space-y-4">
          <div>
            <label className="label">Remarks</label>
            <textarea name="remarks" value={form.remarks} onChange={handle} rows={2} className="input resize-none" />
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

export default EhsWaterGwa;
