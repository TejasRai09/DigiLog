import { useMemo, useState } from 'react';
import { MdSave } from 'react-icons/md';
import FormPageHeader from '../../../components/FormPageHeader';
import FormReviewModal from '../../../components/FormReviewModal';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';
import ReportDateFields from '../../../components/ReportDateFields';
import { buildShredderOTGReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const SHIFTS = ['A', 'B', 'C', 'G'];

const Section = ({ title, children }) => (
  <div className="form-section">
    <h3 className="section-title">{title}</h3>
    <div>{children}</div>
  </div>
);

/** milling_logbook2.html — shred RHS row */
const RHS_FIELDS = [
  ['shredR_MtrTemp', 'Motor Temp'],
  ['shredR_BearTempSite', 'Bearing Temp (Site)'],
  ['shredR_BearTempDCS', 'Bearing Temp (DCS)'],
  ['shredR_VibH', 'Vibrations-H'],
  ['shredR_VibV', 'Vibrations-V'],
  ['shredR_VibA', 'Vibrations-A'],
];
const LHS_FIELDS = [
  ['shredL_MtrTemp', 'Motor Temp'],
  ['shredL_BearTempSite', 'Bearing Temp (Site)'],
  ['shredL_BearTempDCS', 'Bearing Temp (DCS)'],
  ['shredL_VibH', 'Vibrations-H'],
  ['shredL_VibV', 'Vibrations-V'],
  ['shredL_VibA', 'Vibrations-A'],
];

const OTG_FIELDS = (n) => [
  [`M${n}_InpT`, 'Input-T'],
  [`M${n}_InpM`, 'Input-M'],
  [`M${n}_IntT`, 'Intermediate-T'],
  [`M${n}_IntM`, 'Intermediate-M'],
  [`M${n}_OutT`, 'Output-T'],
  [`M${n}_OutM`, 'Output-M'],
];

const INITIAL = {
  date: '', shift: '', time: '',
  shredR_MtrTemp: '', shredR_BearTempSite: '', shredR_BearTempDCS: '',
  shredR_VibH: '', shredR_VibV: '', shredR_VibA: '',
  shredL_MtrTemp: '', shredL_BearTempSite: '', shredL_BearTempDCS: '',
  shredL_VibH: '', shredL_VibV: '', shredL_VibA: '',
  M1_InpT: '', M1_InpM: '', M1_IntT: '', M1_IntM: '', M1_OutT: '', M1_OutM: '',
  M2_InpT: '', M2_InpM: '', M2_IntT: '', M2_IntM: '', M2_OutT: '', M2_OutM: '',
  M3_InpT: '', M3_InpM: '', M3_IntT: '', M3_IntM: '', M3_OutT: '', M3_OutM: '',
  M4_InpT: '', M4_InpM: '', M4_IntT: '', M4_IntM: '', M4_OutT: '', M4_OutM: '',
};

const ShreddarOTG = () => {
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
        () => api.post('/forms/mill_logbook2', form),
        'Shredder and OTG submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildShredderOTGReview(form) : null),
    [reviewOpen, form],
  );

  const rowInputs = (fields) => (
    <div className="form-row flex-wrap">
      {fields.map(([nameKey, placeholder]) => (
        <LegacyNumField
          key={nameKey}
          label=""
          name={nameKey}
          value={form[nameKey]}
          onChange={handleChange}
          placeholder={placeholder}
        />
      ))}
    </div>
  );

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <FormPageHeader formKey="mill_logbook2" fallbackTitle="Shredder and OTG" />

      <form onSubmit={openReview} className="space-y-4">
        <div className="form-section">
          <div className="form-row flex-wrap gap-6 items-end">
            <ReportDateFields
              dateValue={form.date}
              timeValue={form.time}
              onChange={handleChange}
              dateRequired
            />
            <div>
              <label className="label">Shift:<span className="text-red-500 ml-0.5">*</span></label>
              <select name="shift" value={form.shift} onChange={handleChange} required className="input">
                <option value="">— Select —</option>
                {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <Section title="Shredder ">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Shredder RHS:</p>
              {rowInputs(RHS_FIELDS)}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800 mb-2">Shredder LHS:</p>
              {rowInputs(LHS_FIELDS)}
            </div>
          </div>
        </Section>

        <Section title="OTG Bearing Temperature">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="mb-5 last:mb-0">
              <p className="text-sm font-semibold text-gray-800 mb-2">{`Mill ${n}:`}</p>
              <div className="form-row flex-wrap">
                {OTG_FIELDS(n).map(([nameKey, placeholder]) => (
                  <LegacyNumField
                    key={nameKey}
                    label=""
                    name={nameKey}
                    value={form[nameKey]}
                    onChange={handleChange}
                    placeholder={placeholder}
                  />
                ))}
              </div>
            </div>
          ))}
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

export default ShreddarOTG;
