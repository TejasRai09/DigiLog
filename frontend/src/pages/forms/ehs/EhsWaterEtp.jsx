import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const INITIAL = {
  date: '',
  cane_crush_ondate: '', cane_crush_todate: '',
  etp_inlet_meter:   '', etp_inlet_kl:      '',
  etp_outlet_meter:  '', etp_outlet_kl:     '',
  effluent_200ltcd:  '',
  ph_g_shift: '', tss: '', cod: '', bod: '', tds: '', oil_grease: '',
  ondate_kld: '',
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

const EhsWaterEtp = () => {
  const navigate            = useNavigate();
  const [form, setForm]     = useState(INITIAL);
  const [submitting, setSub] = useState(false);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSub(true);
    try {
      await api.post('/forms/ehs_water_etp', form);
      toast.success('ETP report submitted!');
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
      <h1 className="page-title mb-6">Water Dashboard — ETP Working</h1>

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
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">ETP Inlet</h2>
          <div className="grid grid-cols-2 gap-4">
            <Num label="Meter Reading"  name="etp_inlet_meter" value={form.etp_inlet_meter} onChange={handle} />
            <Num label="Extracted (KL)" name="etp_inlet_kl"    value={form.etp_inlet_kl}    onChange={handle} />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">ETP Outlet</h2>
          <div className="grid grid-cols-2 gap-4">
            <Num label="Meter Reading"  name="etp_outlet_meter" value={form.etp_outlet_meter} onChange={handle} />
            <Num label="Extracted (KL)" name="etp_outlet_kl"    value={form.etp_outlet_kl}    onChange={handle} />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Effluent</h2>
          <div className="grid grid-cols-2 gap-4">
            <Num label="Total Effluent 200 L/TCD (On Date)" name="effluent_200ltcd" value={form.effluent_200ltcd} onChange={handle} />
            <Num label="On Date (KLD)"                      name="ondate_kld"       value={form.ondate_kld}       onChange={handle} />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Quality Parameters</h2>
          <div className="grid grid-cols-3 gap-4">
            <Num label="pH (G Shift)"          name="ph_g_shift" value={form.ph_g_shift} onChange={handle} />
            <Num label="TSS &lt;30 ppm"        name="tss"        value={form.tss}        onChange={handle} />
            <Num label="COD &lt;250 ppm"       name="cod"        value={form.cod}        onChange={handle} />
            <Num label="BOD &lt;30 ppm"        name="bod"        value={form.bod}        onChange={handle} />
            <Num label="TDS &lt;2100 mg/L"     name="tds"        value={form.tds}        onChange={handle} />
            <Txt label="Oil &amp; Grease &lt;10 mg/L" name="oil_grease" value={form.oil_grease} onChange={handle} />
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

export default EhsWaterEtp;
