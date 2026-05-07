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

const buildInitial = () => {
  const init = { date: '', shift: '', samplingTime: '' };
  const products = ['DSL', 'DSM', 'DSS', 'RSL', 'RSM', 'RSS', 'Pharma20', 'Pharma30', 'Pharma40'];
  products.forEach((p) => {
    init[`retn_${p}`] = '';
    init[`moist_${p}`] = '';
    init[`col_${p}`] = '';
  });
  init.col_ClrJDS = '';
  init.col_RawMeltRS = '';
  init.col_ClrMeltRS = '';
  init.col_FineLqrRS = '';
  return init;
};

const INITIAL = buildInitial();

const SALogbook = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.shift) { toast.error('Date and Shift are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/sa_logbook', form);
      toast.success('Special Analysis Logbook submitted!');
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
      <h1 className="page-title mb-6">GSMA Logbook - Special Analysis</h1>

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

        <Section title="Retention Analysis DS:">
          <LegacyNumField label="" placeholder="L-31" name="retn_DSL" value={form.retn_DSL} onChange={handleChange} />
          <LegacyNumField label="" placeholder="M-31" name="retn_DSM" value={form.retn_DSM} onChange={handleChange} />
          <LegacyNumField label="" placeholder="S-31" name="retn_DSS" value={form.retn_DSS} onChange={handleChange} />
        </Section>
        <Section title="Retention Analysis RS:">
          <LegacyNumField label="" placeholder="L-31" name="retn_RSL" value={form.retn_RSL} onChange={handleChange} />
          <LegacyNumField label="" placeholder="M-31" name="retn_RSM" value={form.retn_RSM} onChange={handleChange} />
          <LegacyNumField label="" placeholder="S-31" name="retn_RSS" value={form.retn_RSS} onChange={handleChange} />
        </Section>
        <Section title="Retention Analysis Pharma:">
          <LegacyNumField label="" placeholder="20/80" name="retn_Pharma20" value={form.retn_Pharma20} onChange={handleChange} />
          <LegacyNumField label="" placeholder="30/80" name="retn_Pharma30" value={form.retn_Pharma30} onChange={handleChange} />
          <LegacyNumField label="" placeholder="SS" name="retn_Pharma40" value={form.retn_Pharma40} onChange={handleChange} />
        </Section>

        <Section title="Moisture Analysis DS:">
          <LegacyNumField label="" placeholder="L-31" name="moist_DSL" value={form.moist_DSL} onChange={handleChange} />
          <LegacyNumField label="" placeholder="M-31" name="moist_DSM" value={form.moist_DSM} onChange={handleChange} />
          <LegacyNumField label="" placeholder="S-31" name="moist_DSS" value={form.moist_DSS} onChange={handleChange} />
        </Section>
        <Section title="Moisture Analysis RS:">
          <LegacyNumField label="" placeholder="L-31" name="moist_RSL" value={form.moist_RSL} onChange={handleChange} />
          <LegacyNumField label="" placeholder="M-31" name="moist_RSM" value={form.moist_RSM} onChange={handleChange} />
          <LegacyNumField label="" placeholder="S-31" name="moist_RSS" value={form.moist_RSS} onChange={handleChange} />
        </Section>
        <Section title="Moisture Analysis Pharma:">
          <LegacyNumField label="" placeholder="20/80" name="moist_Pharma20" value={form.moist_Pharma20} onChange={handleChange} />
          <LegacyNumField label="" placeholder="30/80" name="moist_Pharma30" value={form.moist_Pharma30} onChange={handleChange} />
          <LegacyNumField label="" placeholder="SS" name="moist_Pharma40" value={form.moist_Pharma40} onChange={handleChange} />
        </Section>

        <Section title="Colour Analysis DS:">
          <LegacyNumField label="" placeholder="L-31" name="col_DSL" value={form.col_DSL} onChange={handleChange} />
          <LegacyNumField label="" placeholder="M-31" name="col_DSM" value={form.col_DSM} onChange={handleChange} />
          <LegacyNumField label="" placeholder="S-31" name="col_DSS" value={form.col_DSS} onChange={handleChange} />
        </Section>
        <Section title="Colour Analysis RS:">
          <LegacyNumField label="" placeholder="L-31" name="col_RSL" value={form.col_RSL} onChange={handleChange} />
          <LegacyNumField label="" placeholder="M-31" name="col_RSM" value={form.col_RSM} onChange={handleChange} />
          <LegacyNumField label="" placeholder="S-31" name="col_RSS" value={form.col_RSS} onChange={handleChange} />
        </Section>
        <Section title="Colour Analysis Pharma:">
          <LegacyNumField label="" placeholder="20/80" name="col_Pharma20" value={form.col_Pharma20} onChange={handleChange} />
          <LegacyNumField label="" placeholder="30/80" name="col_Pharma30" value={form.col_Pharma30} onChange={handleChange} />
          <LegacyNumField label="" placeholder="SS" name="col_Pharma40" value={form.col_Pharma40} onChange={handleChange} />
        </Section>
        <Section title="Other Colour Analysis:">
          <LegacyNumField label="" placeholder="Clear Juice DS" name="col_ClrJDS" value={form.col_ClrJDS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Raw Melt RS" name="col_RawMeltRS" value={form.col_RawMeltRS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Clear Melt RS" name="col_ClrMeltRS" value={form.col_ClrMeltRS} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Fine Liquor RS" name="col_FineLqrRS" value={form.col_FineLqrRS} onChange={handleChange} />
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

export default SALogbook;
