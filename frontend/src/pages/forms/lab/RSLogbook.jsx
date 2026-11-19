import { useMemo, useState } from 'react';
import { MdSave } from 'react-icons/md';
import FormPageHeader from '../../../components/FormPageHeader';
import AutoNowInput from '../../../components/AutoNowInput';
import FormReviewModal from '../../../components/FormReviewModal';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';
import PurityReadout from '../../../components/PurityReadout';
import { buildRSLogbookReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const SHIFTS = ['A', 'B', 'C'];
const MODE_OPTIONS = ['B Heavy', 'C Heavy'];

const Section = ({ title, children }) => (
  <div className="form-section">
    <h3 className="section-title">{title}</h3>
    <div className="form-row flex-wrap">{children}</div>
  </div>
);

/** Pol + Brix rows. `extra` holds readings that are not part of the purity pair (IU). */
const POL_BRIX_SECTIONS = [
  { title: 'Clear Juice:', pol: 'CJ_Pol', brix: 'CJ_Brix' },
  { title: 'Filterate Juice:', pol: 'FJ_Pol', brix: 'FJ_Brix' },
  { title: 'Untreated Syrup:', pol: 'UtrSyrp_Pol', brix: 'UtrSyrp_Brix' },
  { title: 'Raw M/C:', pol: 'RawMc_Pol', brix: 'RawMc_Brix' },
  { title: 'R1 M/C:', pol: 'R1Mc_Pol', brix: 'R1Mc_Brix', extra: [{ name: 'R1Mc_IU', placeholder: 'IU' }] },
  { title: 'R2 M/C:', pol: 'R2Mc_Pol', brix: 'R2Mc_Brix', extra: [{ name: 'R2Mc_IU', placeholder: 'IU' }] },
  { title: 'B M/C:', pol: 'BMc_Pol', brix: 'BMc_Brix' },
  { title: 'C M/C:', pol: 'CMc_Pol', brix: 'CMc_Brix' },
  { title: 'A-Hy Molasses:', pol: 'AH_Mol_Pol', brix: 'AH_Mol_Brix' },
  { title: 'A-Light Molasses:', pol: 'AL_Mol_Pol', brix: 'AL_Mol_Brix' },
  { title: 'R1-Heavy Molasses:', pol: 'R1_Mol_Pol', brix: 'R1_Mol_Brix', extra: [{ name: 'R1Mol_IU', placeholder: 'IU' }] },
  { title: 'R2-Heavy Molasses:', pol: 'R2_Mol_Pol', brix: 'R2_Mol_Brix', extra: [{ name: 'R2Mol_IU', placeholder: 'IU' }] },
  { title: 'B-Hy Molasses:', pol: 'BH_Mol_Pol', brix: 'BH_Mol_Brix' },
  { title: 'C-Light Molasses:', pol: 'CL_Mol_Pol', brix: 'CL_Mol_Brix' },
  { title: 'Final Molasses:', pol: 'FMol_Pol', brix: 'FMol_Brix' },
  { title: 'Raw Melt:', pol: 'RawMlt_Pol', brix: 'RawMlt_Brix', extra: [{ name: 'RawMlt_IU', placeholder: 'Raw Melt IU' }] },
  { title: 'Clear Melt:', pol: 'ClearMlt_Pol', brix: 'ClearMlt_Brix', extra: [{ name: 'ClearMlt_IU', placeholder: 'Clear Melt IU' }] },
  {
    title: 'Fine Liqour Melt:',
    pol: 'Pol_FineLiqourMelt',
    brix: 'Brix_FineLiqourMelt',
    extra: [{ name: 'IU_FineLiqourMelt', placeholder: 'Fine Liqour Melt IU' }],
  },
];

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
        () => api.post('/forms/rs_logbook', form),
        'RS Logbook submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildRSLogbookReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <FormPageHeader formKey="rs_logbook" fallbackTitle="RS Logbook" />

      <form onSubmit={openReview} className="space-y-4">
        <div className="form-section">
          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">Report Date:<span className="text-red-500 ml-0.5">*</span></label>
              <AutoNowInput type="date" name="date" value={form.date} onChange={handleChange} required className="input" />
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
              <AutoNowInput type="time" name="samplingTime" value={form.samplingTime} onChange={handleChange} className="input" />
            </div>
          </div>
        </div>

        {POL_BRIX_SECTIONS.map(({ title, pol, brix, extra = [] }) => (
          <Section key={title} title={title}>
            <LegacyNumField label="" placeholder="Brix" name={brix} value={form[brix]} onChange={handleChange} />
            <LegacyNumField label="" placeholder="Pol" name={pol} value={form[pol]} onChange={handleChange} />
            <PurityReadout pol={form[pol]} brix={form[brix]} />
            {extra.map((field) => (
              <LegacyNumField
                key={field.name}
                label=""
                placeholder={field.placeholder}
                name={field.name}
                value={form[field.name]}
                onChange={handleChange}
              />
            ))}
          </Section>
        ))}
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

export default RSLogbook;
