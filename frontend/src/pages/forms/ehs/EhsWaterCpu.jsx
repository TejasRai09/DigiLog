import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const INITIAL = {
  date: '',
  cane_crush_ondate: '', cane_crush_todate: '',
  cpu_inlet_ondate:  '', cpu_inlet_todate:  '',
  cpu_outlet_ondate: '', cpu_outlet_todate: '',
  effluent_200ltcd_ondate: '', effluent_200ltcd_todate: '',
  inlet_ph_a: '', inlet_ph_b: '', inlet_ph_c: '',
  outlet_ph: '', outlet_tss: '', outlet_cod: '', outlet_bod: '',
  outlet_tds: '', oil_grease: '', transmittance: '',
  remarks: '',
};

const Num = ({ label, name, value, onChange }) => (
  <div>
    <label className="label">{label}</label>
    <input type="number" step="any" name={name} value={value} onChange={onChange} className="input" />
  </div>
);

const Txt = ({ label, name, value, onChange }) => (
  <div>
    <label className="label">{label}</label>
    <input type="text" name={name} value={value} onChange={onChange} className="input" />
  </div>
);

const EhsWaterCpu = () => {
  const navigate            = useNavigate();
  const [form, setForm]     = useState(INITIAL);
  const [submitting, setSub] = useState(false);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSub(true);
    try {
      await api.post('/forms/ehs_water_cpu', form);
      toast.success('CPU report submitted!');
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
      <h1 className="page-title mb-6">Water Dashboard — CPU Water Recycle</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        <div className="form-section space-y-4">
          <div>
            <label className="label">Date<span className="text-red-500 ml-0.5">*</span></label>
            <input type="date" name="date" value={form.date} onChange={handle} required className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Num label="Cane Crush — On Date (TCD)" name="cane_crush_ondate" value={form.cane_crush_ondate} onChange={handle} />
            <Num label="Cane Crush — To Date (TCD)" name="cane_crush_todate" value={form.cane_crush_todate} onChange={handle} />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">CPU Inlet</h2>
          <div className="grid grid-cols-2 gap-4">
            <Num label="On Date (KL)"  name="cpu_inlet_ondate" value={form.cpu_inlet_ondate} onChange={handle} />
            <Num label="To Date (KL)"  name="cpu_inlet_todate" value={form.cpu_inlet_todate} onChange={handle} />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">CPU Outlet</h2>
          <div className="grid grid-cols-2 gap-4">
            <Num label="On Date (KL)"  name="cpu_outlet_ondate" value={form.cpu_outlet_ondate} onChange={handle} />
            <Num label="To Date (KL)"  name="cpu_outlet_todate" value={form.cpu_outlet_todate} onChange={handle} />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Effluent 200 L/TCD</h2>
          <div className="grid grid-cols-2 gap-4">
            <Num label="On Date"  name="effluent_200ltcd_ondate" value={form.effluent_200ltcd_ondate} onChange={handle} />
            <Num label="To Date"  name="effluent_200ltcd_todate" value={form.effluent_200ltcd_todate} onChange={handle} />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Inlet pH</h2>
          <div className="grid grid-cols-3 gap-4">
            <Num label="A Shift" name="inlet_ph_a" value={form.inlet_ph_a} onChange={handle} />
            <Num label="B Shift" name="inlet_ph_b" value={form.inlet_ph_b} onChange={handle} />
            <Num label="C Shift" name="inlet_ph_c" value={form.inlet_ph_c} onChange={handle} />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Outlet Quality Parameters</h2>
          <div className="grid grid-cols-3 gap-4">
            <Num label="pH (5.5–8.5)"              name="outlet_ph"    value={form.outlet_ph}    onChange={handle} />
            <Txt label="TSS &lt;30 ppm"            name="outlet_tss"   value={form.outlet_tss}   onChange={handle} />
            <Txt label="COD &lt;250 ppm"           name="outlet_cod"   value={form.outlet_cod}   onChange={handle} />
            <Txt label="BOD &lt;30 ppm"            name="outlet_bod"   value={form.outlet_bod}   onChange={handle} />
            <Txt label="TDS &lt;2100 mg/L"         name="outlet_tds"   value={form.outlet_tds}   onChange={handle} />
            <Txt label="Oil &amp; Grease &lt;10"   name="oil_grease"   value={form.oil_grease}   onChange={handle} />
            <Txt label="Transmittance &gt;85"      name="transmittance" value={form.transmittance} onChange={handle} />
          </div>
        </div>

        <div className="form-section">
          <label className="label">Remarks</label>
          <textarea name="remarks" value={form.remarks} onChange={handle} rows={2} className="input resize-none" />
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

export default EhsWaterCpu;
