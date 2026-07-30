import { useMemo, useState } from 'react';
import { MdSave } from 'react-icons/md';
import FormPageHeader from '../../../components/FormPageHeader';
import FormReviewModal from '../../../components/FormReviewModal';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';
import { buildDSLogbookReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const SHIFTS = ['A', 'B', 'C', 'G'];
const MODE_OPTIONS = ['B Heavy', 'C Heavy'];

/** ds_form.html order + row labels */
const polBrixPairs = [
  { key: 'PJ', label: 'Primary Juice:' },
  { key: 'MJ', label: 'Mixed Juice:' },
  { key: 'LMJ', label: 'Last Mill Juice:' },
  { key: 'CJ', label: 'Clear Juice:' },
  { key: 'FJ', label: 'Filterate Juice:' },
  { key: 'USul_Syrp', label: 'Unsulphured Syrup:' },
  { key: 'Sul_Syrp', label: 'Sulphured Syrup:' },
  { key: 'A_Mc', label: 'A M/C:' },
  { key: 'B_Mc', label: 'B M/C:' },
  { key: 'A1_Mc', label: 'A1 M/C:' },
  { key: 'C_Mc', label: 'C M/C:' },
  { key: 'A1_Mol', label: 'A1 Molasses:' },
  { key: 'AH_Mol', label: 'A-Hy Molasses:' },
  { key: 'AL_Mol', label: 'A-Light Molasses:' },
  { key: 'BH_Mol', label: 'B-Hy Molasses:' },
  { key: 'CL_Mol', label: 'C-Light Molasses:' },
  { key: 'FMol', label: 'Final Molasses:' },
];

const Section = ({ title, children }) => (
  <div className="form-section">
    <h3 className="section-title">{title}</h3>
    <div className="form-row">{children}</div>
  </div>
);

const buildInitial = () => {
  const init = { date: '', shift: '', samplingTime: '', op_mode: 'B Heavy' };
  polBrixPairs.forEach(({ key }) => {
    init[`${key}_Pol`] = '';
    init[`${key}_Brix`] = '';
  });
  init.Bag_Pol = '';
  init.Bag_Moisture = '';
  init.FCake_Pol = '';
  init.DecanterMud_Pol = '';
  init.MillDrain_Pol = '';
  init.BoilHouseDrain_Pol = '';
  return init;
};

const INITIAL = buildInitial();

const DSLogbook = () => {
  const [form, setForm] = useState(INITIAL);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date || !form.shift) {
        toast.error('Date and Shift are required.');
        return false;
      }
      return true;
    },
    submit: async () => {
      await gsmaSubmitRequest(
        () => api.post('/forms/ds_logbook', form),
        'DS Logbook submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildDSLogbookReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <FormPageHeader formKey="ds_logbook" fallbackTitle="DS Logbook" />

      <form onSubmit={openReview} className="space-y-4">
        <div className="form-section space-y-4">
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

        {polBrixPairs.map(({ key, label }) => (
          <Section key={key} title={label}>
            <LegacyNumField label="" placeholder="Pol" name={`${key}_Pol`} value={form[`${key}_Pol`]} onChange={handleChange} />
            <LegacyNumField label="" placeholder="Brix" name={`${key}_Brix`} value={form[`${key}_Brix`]} onChange={handleChange} />
          </Section>
        ))}

        <Section title="Bagasse:">
          <LegacyNumField label="" placeholder="Pol" name="Bag_Pol" value={form.Bag_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Moisture" name="Bag_Moisture" value={form.Bag_Moisture} onChange={handleChange} />
        </Section>

        <Section title="Filter Cake:">
          <LegacyNumField label="" placeholder="Pol (To be added at shift end)" name="FCake_Pol" value={form.FCake_Pol} onChange={handleChange} />
        </Section>

        <Section title="Decanter Mud Pol:">
          <LegacyNumField label="" placeholder="Pol" name="DecanterMud_Pol" value={form.DecanterMud_Pol} onChange={handleChange} />
        </Section>

        <Section title="Drain Pol:">
          <LegacyNumField label="" placeholder="Mill House Drain Pol" name="MillDrain_Pol" value={form.MillDrain_Pol} onChange={handleChange} />
          <LegacyNumField label="" placeholder="Boiling House Drain Pol" name="BoilHouseDrain_Pol" value={form.BoilHouseDrain_Pol} onChange={handleChange} />
        </Section>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => setForm(INITIAL)} className="btn-secondary">Reset</button>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>

      {reviewConfig ? (
        <FormReviewModal
          open={reviewOpen}
          onClose={closeReview}
          onConfirm={confirmSubmit}
          confirming={submitting}
          {...reviewConfig}
        />
      ) : null}
    </main>
  );
};

export default DSLogbook;
