import { useMemo, useState } from 'react';
import { MdOilBarrel, MdSpeed } from 'react-icons/md';
import FormReviewModal from '../../../components/FormReviewModal';
import {
  MillDateShiftCard,
  PowerCategoryRow,
  PowerFormCard,
  PowerFormPage,
  PowerMetricField,
  usePowerCollapseAll,
} from '../../../components/power/PowerLogbookFormUI';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { buildLubePressureReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const SHIFTS = ['A', 'B', 'C'];

const LUBE_FIELDS = [
  ['LubePressure_ACC', 'ACC (Kg/Sq.Cm)'],
  ['LubePressure_MCC', 'MCC (Kg/Sq.Cm)'],
  ['LubePressure_Shred', 'Shredder (Kg/Sq.Cm)'],
  ['LubePressure_M0', 'Mill 0 (Kg/Sq.Cm)'],
];

const ROLLER_PLACE = [
  ['gsT', 'Gear Side (T)'],
  ['gsB', 'Gear Side (B)'],
  ['gsUF', 'Gear Side (U/F)'],
  ['psT', 'Pintal Side (T)'],
  ['psB', 'Pintal Side (B)'],
  ['psUF', 'Pintal Side (U/F)'],
];

const INITIAL = {
  date: '', shift: '',
  LubePressure_ACC: '', LubePressure_MCC: '', LubePressure_Shred: '', LubePressure_M0: '',
  M0_gsT: '', M0_gsB: '', M0_gsUF: '', M0_psT: '', M0_psB: '', M0_psUF: '',
  M1_gsT: '', M1_gsB: '', M1_gsUF: '', M1_psT: '', M1_psB: '', M1_psUF: '',
  M2_gsT: '', M2_gsB: '', M2_gsUF: '', M2_psT: '', M2_psB: '', M2_psUF: '',
  M3_gsT: '', M3_gsB: '', M3_gsUF: '', M3_psT: '', M3_psB: '', M3_psUF: '',
  M4_gsT: '', M4_gsB: '', M4_gsUF: '', M4_psT: '', M4_psB: '', M4_psUF: '',
};

const F = PowerMetricField;
const ROLLER_TONES = ['green', 'orange', 'purple', 'amber', 'blue'];

const LubePressure = () => {
  const [form, setForm] = useState(INITIAL);
  const { collapseAll, toggleCollapseAll } = usePowerCollapseAll();

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
        () => api.post('/forms/mill_logbook3', form),
        'Lube Pressure and Roller Temp submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildLubePressureReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <>
      <PowerFormPage
        formKey="mill_logbook3"
        fallbackTitle="Lube Pressure and Roller Temp"
        title="Lube Pressure and Roller Temp"
        onClear={() => setForm(INITIAL)}
        submitting={submitting}
        formId="mill-logbook-form"
      >
        <form id="mill-logbook-form" onSubmit={openReview} className="space-y-0">
          <MillDateShiftCard
            dateValue={form.date}
            shiftValue={form.shift}
            onChange={handleChange}
            shifts={SHIFTS}
          />

          <PowerFormCard icon={MdOilBarrel} title="Lube Pump Pressure:">
            <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
              {LUBE_FIELDS.map(([nameKey, label]) => (
                <F
                  key={nameKey}
                  label={label}
                  name={nameKey}
                  value={form[nameKey]}
                  onChange={handleChange}
                  placeholder={label}
                />
              ))}
            </div>
          </PowerFormCard>

          <PowerFormCard
            icon={MdSpeed}
            title="Mill Roller Temperature:"
            collapseAll={collapseAll}
            onToggleCollapseAll={toggleCollapseAll}
          >
            {['M0', 'M1', 'M2', 'M3', 'M4'].map((m, idx) => (
              <PowerCategoryRow
                key={m}
                icon={MdSpeed}
                tone={ROLLER_TONES[idx]}
                title={`Mill ${m.slice(1)}:`}
                columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
              >
                {ROLLER_PLACE.map(([suf, label]) => (
                  <F
                    key={`${m}_${suf}`}
                    label={label}
                    name={`${m}_${suf}`}
                    value={form[`${m}_${suf}`]}
                    onChange={handleChange}
                    placeholder={label}
                  />
                ))}
              </PowerCategoryRow>
            ))}
          </PowerFormCard>
        </form>
      </PowerFormPage>

      {reviewConfig ? (
        <FormReviewModal
          open={reviewOpen}
          onClose={closeReview}
          onConfirm={confirmSubmit}
          confirming={submitting}
          {...reviewConfig}
        />
      ) : null}
    </>
  );
};

export default LubePressure;
