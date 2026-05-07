import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';

const SHIFTS = ['A', 'B', 'C', 'G'];

const Section = ({ title, children }) => (
  <div className="form-section">
    <h3 className="section-title">{title}</h3>
    <div className="form-row flex-wrap">{children}</div>
  </div>
);

const INITIAL = {
  date: '', shift: '', samplingTime: '',
  yard_bal: '', crush: '', imb_wtr: '', imb_temp: '',
  mixj_ds: '', mixj_rs: '', mol_ds: '', mol_rs: '', fcake_ds: '', fcake_rs: '',
  qty_dsl: '', mesh_dsl: '', bagtemp_dsl: '',
  qty_dsm: '', mesh_dsm: '', bagtemp_dsm: '',
  qty_dss: '', mesh_dss: '', bagtemp_dss: '',
  qty_rsl: '', mesh_rsl: '', bagtemp_rsl: '',
  qty_rsm: '', mesh_rsm: '', bagtemp_rsm: '',
  qty_rss: '', mesh_rss: '', bagtemp_rss: '',
  qty_p20: '', bagtemp_p20: '',
  qty_p30: '', bagtemp_p30: '',
  qty_p40: '', bagtemp_p40: '',
  FBDInlet_TempDS: '', FBDInlet_MoistDS: '', FBDOutlet_TempDS: '', FBDOutlet_MoistDS: '',
  Hopper_TempDS: '', Hopper_MoistDS: '',
  FBDInlet_TempRS: '', FBDInlet_MoistRS: '', FBDOutlet_TempRS: '', FBDOutlet_MoistRS: '',
  Hopper_TempRS: '', Hopper_MoistRS: '',
  RSDInlet_Temp: '', RSDInlet_Moist: '', RSDOutlet_Temp: '', RSDOutlet_Moist: '',
};

const OpsLogbook = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.shift) { toast.error('Date and Shift are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/ops_logbook', form);
      toast.success('Operations Logbook submitted!');
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
      <h1 className="page-title mb-6">GSMA Logbook - Operations</h1>

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
              <label className="label">Sampling Time:</label>
              <input type="time" name="samplingTime" value={form.samplingTime} onChange={handleChange} className="input" />
            </div>
          </div>
        </div>

        <Section title="Input:">
          <LegacyNumField label="" placeholder="Yard Balance (Qtls)" name="yard_bal" value={form.yard_bal} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Crushing (Qtls)" name="crush" value={form.crush} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Imbibition Water (Qtls)" name="imb_wtr" value={form.imb_wtr} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Imbibition Temperature (deg. C)" name="imb_temp" value={form.imb_temp} onChange={handleChange} />
        </Section>

        <Section title="Output:">
          <LegacyNumField label="" placeholder="Mixed Juice DS (Qtls)" name="mixj_ds" value={form.mixj_ds} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Mixed Juice RS (Qtls)" name="mixj_rs" value={form.mixj_rs} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Molasses Output DS" name="mol_ds" value={form.mol_ds} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Molasses Output RS" name="mol_rs" value={form.mol_rs} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Filter Cake DS" name="fcake_ds" value={form.fcake_ds} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Filter Cake RS" name="fcake_rs" value={form.fcake_rs} onChange={handleChange} />
        </Section>

        <Section title="Sugar Production: DS-L31">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_dsl" value={form.qty_dsl} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Mesh" name="mesh_dsl" value={form.mesh_dsl} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_dsl" value={form.bagtemp_dsl} onChange={handleChange} />
        </Section>
        <Section title="Sugar Production: DS-M31">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_dsm" value={form.qty_dsm} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Mesh" name="mesh_dsm" value={form.mesh_dsm} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_dsm" value={form.bagtemp_dsm} onChange={handleChange} />
        </Section>
        <Section title="Sugar Production: DS-S31">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_dss" value={form.qty_dss} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Mesh" name="mesh_dss" value={form.mesh_dss} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_dss" value={form.bagtemp_dss} onChange={handleChange} />
        </Section>
        <Section title="Sugar Production: RS-L31">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_rsl" value={form.qty_rsl} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Mesh" name="mesh_rsl" value={form.mesh_rsl} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_rsl" value={form.bagtemp_rsl} onChange={handleChange} />
        </Section>
        <Section title="Sugar Production: RS-M31">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_rsm" value={form.qty_rsm} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Mesh" name="mesh_rsm" value={form.mesh_rsm} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_rsm" value={form.bagtemp_rsm} onChange={handleChange} />
        </Section>
        <Section title="Sugar Production: RS-S31">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_rss" value={form.qty_rss} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Mesh" name="mesh_rss" value={form.mesh_rss} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_rss" value={form.bagtemp_rss} onChange={handleChange} />
        </Section>
        <Section title="Sugar Production: Pharma 20/80">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_p20" value={form.qty_p20} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_p20" value={form.bagtemp_p20} onChange={handleChange} />
        </Section>
        <Section title="Sugar Production: Pharma 30/80">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_p30" value={form.qty_p30} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_p30" value={form.bagtemp_p30} onChange={handleChange} />
        </Section>
        <Section title="Sugar Production: Pharma SS">
          <LegacyNumField label="" placeholder="Quantity (Qtls)" name="qty_p40" value={form.qty_p40} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Bagging Temperature" name="bagtemp_p40" value={form.bagtemp_p40} onChange={handleChange} />
        </Section>

        <Section title="Temperature & Moisture Details (DS)">
          <LegacyNumField label="" placeholder="FBD Inlet Temperature (DS)" name="FBDInlet_TempDS" value={form.FBDInlet_TempDS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="FBD Inlet Moisture (DS)" name="FBDInlet_MoistDS" value={form.FBDInlet_MoistDS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="FBD Outlet Temperature (DS)" name="FBDOutlet_TempDS" value={form.FBDOutlet_TempDS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="FBD Outlet Moisture (DS)" name="FBDOutlet_MoistDS" value={form.FBDOutlet_MoistDS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Hopper Temperature (DS)" name="Hopper_TempDS" value={form.Hopper_TempDS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Hopper Moisture (DS)" name="Hopper_MoistDS" value={form.Hopper_MoistDS} onChange={handleChange} />
        </Section>
        <Section title="Temperature & Moisture Details (RS)">
          <LegacyNumField label="" placeholder="FBD Inlet Temperature (RS)" name="FBDInlet_TempRS" value={form.FBDInlet_TempRS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="FBD Inlet Moisture (RS)" name="FBDInlet_MoistRS" value={form.FBDInlet_MoistRS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="FBD Outlet Temperature (RS)" name="FBDOutlet_TempRS" value={form.FBDOutlet_TempRS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="FBD Outlet Moisture (RS)" name="FBDOutlet_MoistRS" value={form.FBDOutlet_MoistRS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Hopper Temperature (RS)" name="Hopper_TempRS" value={form.Hopper_TempRS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Hopper Moisture (RS)" name="Hopper_MoistRS" value={form.Hopper_MoistRS} onChange={handleChange} />
        </Section>
        <Section title="Temperature & Moisture Details (Pharma)">
          <LegacyNumField label="" placeholder="RSD Inlet Temperature (Pharma)" name="RSDInlet_Temp" value={form.RSDInlet_Temp} onChange={handleChange} />
          <LegacyNumField label="" placeholder="RSD Inlet Moisture (Pharma)" name="RSDInlet_Moist" value={form.RSDInlet_Moist} onChange={handleChange} />
          <LegacyNumField label="" placeholder="RSD Outlet Temperature (Pharma)" name="RSDOutlet_Temp" value={form.RSDOutlet_Temp} onChange={handleChange} />
          <LegacyNumField label="" placeholder="RSD Outlet Moisture (Pharma)" name="RSDOutlet_Moist" value={form.RSDOutlet_Moist} onChange={handleChange} />
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

export default OpsLogbook;
