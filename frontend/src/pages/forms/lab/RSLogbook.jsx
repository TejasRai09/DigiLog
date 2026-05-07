import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';

const SHIFTS = ['A', 'B', 'C', 'G'];
const MODE_OPTIONS = ['B Heavy', 'C Heavy'];

const Section = ({ title, children }) => (
  <div className="form-section">
    <h3 className="section-title">{title}</h3>
    <div className="form-row flex-wrap">{children}</div>
  </div>
);

const INITIAL = {
  date: '', shift: '', samplingTime: '', op_mode: 'B Heavy',
  CJ_Pol: '', CJ_Brix: '', FJ_Pol: '', FJ_Brix: '',
  UtrSyrp_Pol: '', UtrSyrp_Brix: '',
  RawMc_Pol: '', RawMc_Brix: '', R1Mc_Pol: '', R1Mc_Brix: '', R2Mc_Pol: '', R2Mc_Brix: '',
  BMc_Pol: '', BMc_Brix: '', CMc_Pol: '', CMc_Brix: '',
  AH_Mol_Pol: '', AH_Mol_Brix: '', AL_Mol_Pol: '', AL_Mol_Brix: '',
  R1_Mol_Pol: '', R1_Mol_Brix: '', R2_Mol_Pol: '', R2_Mol_Brix: '',
  BH_Mol_Pol: '', BH_Mol_Brix: '', CL_Mol_Pol: '', CL_Mol_Brix: '',
  FMol_Pol: '', FMol_Brix: '', FCake_Pol: '',
  R1Mc_IU: '', R2Mc_IU: '', R1Mol_IU: '', R2Mol_IU: '',
  RawMlt_Pol: '', RawMlt_Brix: '', RawMlt_IU: '',
  ClearMlt_Pol: '', ClearMlt_Brix: '', ClearMlt_IU: '',
  Pol_FineLiqourMelt: '', Brix_FineLiqourMelt: '', IU_FineLiqourMelt: '',
  IERInlet_IU: '', IERInlet_PH: '', IEROutlet_IU: '', IEROutlet_PH: '',
};

const RSLogbook = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.shift) { toast.error('Date and Shift are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/rs_logbook', form);
      toast.success('RS Logbook submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-6">GSMA Logbook - RS</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-section">
          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">Report Date:<span className="text-red-500 ml-0.5">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required className="input" />
            </div>
            <div>
              <label className="label">Shift:<span className="text-red-500 ml-0.5">*</span></label>
              <select name="shift" value={form.shift} onChange={handleChange} required className="input">
                <option value="">— Select —</option>
                {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Mode of Operation:<span className="text-red-500 ml-0.5">*</span></label>
              <select name="op_mode" value={form.op_mode} onChange={handleChange} required className="input">
                {MODE_OPTIONS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Sampling Time:</label>
              <input type="time" name="samplingTime" value={form.samplingTime} onChange={handleChange} className="input" />
            </div>
          </div>
        </div>

        <Section title="Clear Juice:">
          <LegacyNumField label="" placeholder="Pol" name="CJ_Pol" value={form.CJ_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="CJ_Brix" value={form.CJ_Brix} onChange={handleChange} />
        </Section>
        <Section title="Filterate Juice:">
          <LegacyNumField label="" placeholder="Pol" name="FJ_Pol" value={form.FJ_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="FJ_Brix" value={form.FJ_Brix} onChange={handleChange} />
        </Section>
        <Section title="Untreated Syrup:">
          <LegacyNumField label="" placeholder="Pol" name="UtrSyrp_Pol" value={form.UtrSyrp_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="UtrSyrp_Brix" value={form.UtrSyrp_Brix} onChange={handleChange} />
        </Section>
        <Section title="Raw M/C:">
          <LegacyNumField label="" placeholder="Pol" name="RawMc_Pol" value={form.RawMc_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="RawMc_Brix" value={form.RawMc_Brix} onChange={handleChange} />
        </Section>
        <Section title="R1 M/C:">
          <LegacyNumField label="" placeholder="Pol" name="R1Mc_Pol" value={form.R1Mc_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="R1Mc_Brix" value={form.R1Mc_Brix} onChange={handleChange} />
          <LegacyNumField label="" placeholder="IU" name="R1Mc_IU" value={form.R1Mc_IU} onChange={handleChange} />
        </Section>
        <Section title="R2 M/C:">
          <LegacyNumField label="" placeholder="Pol" name="R2Mc_Pol" value={form.R2Mc_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="R2Mc_Brix" value={form.R2Mc_Brix} onChange={handleChange} />
          <LegacyNumField label="" placeholder="IU" name="R2Mc_IU" value={form.R2Mc_IU} onChange={handleChange} />
        </Section>
        <Section title="B M/C:">
          <LegacyNumField label="" placeholder="Pol" name="BMc_Pol" value={form.BMc_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="BMc_Brix" value={form.BMc_Brix} onChange={handleChange} />
        </Section>
        <Section title="C M/C:">
          <LegacyNumField label="" placeholder="Pol" name="CMc_Pol" value={form.CMc_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="CMc_Brix" value={form.CMc_Brix} onChange={handleChange} />
        </Section>
        <Section title="A-Hy Molasses:">
          <LegacyNumField label="" placeholder="Pol" name="AH_Mol_Pol" value={form.AH_Mol_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="AH_Mol_Brix" value={form.AH_Mol_Brix} onChange={handleChange} />
        </Section>
        <Section title="A-Light Molasses:">
          <LegacyNumField label="" placeholder="Pol" name="AL_Mol_Pol" value={form.AL_Mol_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="AL_Mol_Brix" value={form.AL_Mol_Brix} onChange={handleChange} />
        </Section>
        <Section title="R1-Heavy Molasses:">
          <LegacyNumField label="" placeholder="Pol" name="R1_Mol_Pol" value={form.R1_Mol_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="R1_Mol_Brix" value={form.R1_Mol_Brix} onChange={handleChange} />
          <LegacyNumField label="" placeholder="IU" name="R1Mol_IU" value={form.R1Mol_IU} onChange={handleChange} />
        </Section>
        <Section title="R2-Heavy Molasses:">
          <LegacyNumField label="" placeholder="Pol" name="R2_Mol_Pol" value={form.R2_Mol_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="R2_Mol_Brix" value={form.R2_Mol_Brix} onChange={handleChange} />
          <LegacyNumField label="" placeholder="IU" name="R2Mol_IU" value={form.R2Mol_IU} onChange={handleChange} />
        </Section>
        <Section title="B-Hy Molasses:">
          <LegacyNumField label="" placeholder="Pol" name="BH_Mol_Pol" value={form.BH_Mol_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="BH_Mol_Brix" value={form.BH_Mol_Brix} onChange={handleChange} />
        </Section>
        <Section title="C-Light Molasses:">
          <LegacyNumField label="" placeholder="Pol" name="CL_Mol_Pol" value={form.CL_Mol_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="CL_Mol_Brix" value={form.CL_Mol_Brix} onChange={handleChange} />
        </Section>
        <Section title="Final Molasses:">
          <LegacyNumField label="" placeholder="Pol" name="FMol_Pol" value={form.FMol_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Brix" name="FMol_Brix" value={form.FMol_Brix} onChange={handleChange} />
        </Section>
        <Section title="Raw Melt:">
          <LegacyNumField label="" placeholder="Raw Melt Pol" name="RawMlt_Pol" value={form.RawMlt_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Raw Melt Brix" name="RawMlt_Brix" value={form.RawMlt_Brix} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Raw Melt IU" name="RawMlt_IU" value={form.RawMlt_IU} onChange={handleChange} />
        </Section>
        <Section title="Clear Melt:">
          <LegacyNumField label="" placeholder="Clear Melt Pol" name="ClearMlt_Pol" value={form.ClearMlt_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Clear Melt Brix" name="ClearMlt_Brix" value={form.ClearMlt_Brix} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Clear Melt IU" name="ClearMlt_IU" value={form.ClearMlt_IU} onChange={handleChange} />
        </Section>
        <Section title="Fine Liqour Melt:">
          <LegacyNumField label="" placeholder="Fine Liqour Melt Pol" name="Pol_FineLiqourMelt" value={form.Pol_FineLiqourMelt} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Fine Liqour Melt Brix" name="Brix_FineLiqourMelt" value={form.Brix_FineLiqourMelt} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Fine Liqour Melt IU" name="IU_FineLiqourMelt" value={form.IU_FineLiqourMelt} onChange={handleChange} />
        </Section>
        <Section title="Filter Cake:">
          <LegacyNumField label="" placeholder="Pol (To be added at shift end)" name="FCake_Pol" value={form.FCake_Pol} onChange={handleChange} />
        </Section>
        <Section title="IER Information:">
          <LegacyNumField label="" placeholder="IER Inlet IU" name="IERInlet_IU" value={form.IERInlet_IU} onChange={handleChange} />
          <LegacyNumField label="" placeholder="IER Inlet PH" name="IERInlet_PH" value={form.IERInlet_PH} onChange={handleChange} />
          <LegacyNumField label="" placeholder="IER Outlet IU" name="IEROutlet_IU" value={form.IEROutlet_IU} onChange={handleChange} />
          <LegacyNumField label="" placeholder="IER Outlet PH" name="IEROutlet_PH" value={form.IEROutlet_PH} onChange={handleChange} />
        </Section>

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

export default RSLogbook;
