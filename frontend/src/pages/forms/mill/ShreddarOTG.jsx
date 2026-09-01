import { useMemo, useState } from 'react';
import { MdContentCut, MdSpeed } from 'react-icons/md';
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
import { buildShredderOTGReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const SHIFTS = ['A', 'B', 'C'];

const RHS_FIELDS = [
  ['shredR_MtrTemp', 'Motor BRG Temp [RHS]'],
  ['shredR_BearTempSite', 'Bearing Temp (DCS) [RHS]'],
  ['shredR_BearTempDCS', 'Bearing Temp (Site) [RHS]'],
  ['shredR_VibH', 'Vibrations-H [RHS]'],
  ['shredR_VibV', 'Vibrations-V [RHS]'],
  ['shredR_VibA', 'Vibrations-A [RHS]'],
];
const LHS_FIELDS = [
  ['shredL_MtrTemp', 'Motor BRG Temp [LHS]'],
  ['shredL_BearTempSite', 'Bearing Temp (DCS) [LHS]'],
  ['shredL_BearTempDCS', 'Bearing Temp (Site) [LHS]'],
  ['shredL_VibH', 'Vibrations-H [LHS]'],
  ['shredL_VibV', 'Vibrations-V [LHS]'],
  ['shredL_VibA', 'Vibrations-A [LHS]'],
];

const OTG_FIELDS = (n) => [
  [`M${n}_InpM`, 'Input - Mill Side'],
  [`M${n}_InpT`, 'Input - Turbine Side'],
  [`M${n}_IntM`, 'Intermediate - Mill Side'],
  [`M${n}_IntT`, 'Intermediate - Turbine Side'],
  [`M${n}_OutM`, 'Output - Mill Side'],
  [`M${n}_OutT`, 'Output - Turbine Side'],
];

const INITIAL = {
  date: '', shift: '',
  shredR_MtrTemp: '', shredR_BearTempSite: '', shredR_BearTempDCS: '',
  shredR_VibH: '', shredR_VibV: '', shredR_VibA: '',
  shredL_MtrTemp: '', shredL_BearTempSite: '', shredL_BearTempDCS: '',
  shredL_VibH: '', shredL_VibV: '', shredL_VibA: '',
  M1_InpT: '', M1_InpM: '', M1_IntT: '', M1_IntM: '', M1_OutT: '', M1_OutM: '',
  M2_InpT: '', M2_InpM: '', M2_IntT: '', M2_IntM: '', M2_OutT: '', M2_OutM: '',
  M3_InpT: '', M3_InpM: '', M3_IntT: '', M3_IntM: '', M3_OutT: '', M3_OutM: '',
  M4_InpT: '', M4_InpM: '', M4_IntT: '', M4_IntM: '', M4_OutT: '', M4_OutM: '',
};

const F = PowerMetricField;

const ShreddarOTG = () => {
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

  const metricRow = (fields, columns = 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6') =>
    fields.map(([nameKey, label]) => (
      <F
        key={nameKey}
        label={label}
        name={nameKey}
        value={form[nameKey]}
        onChange={handleChange}
        placeholder={label}
      />
    ));

  return (
    <>
      <PowerFormPage
        formKey="mill_logbook2"
        fallbackTitle="Shredder and OTG"
        title="Shredder and OTG"
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

          <PowerFormCard
            icon={MdContentCut}
            title="Shredder and OTG:"
            collapseAll={collapseAll}
            onToggleCollapseAll={toggleCollapseAll}
          >
            <PowerCategoryRow icon={MdContentCut} tone="orange" title="Shredder RHS:" columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {metricRow(RHS_FIELDS)}
            </PowerCategoryRow>
            <PowerCategoryRow icon={MdContentCut} tone="amber" title="Shredder LHS:" columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {metricRow(LHS_FIELDS)}
            </PowerCategoryRow>
            {[1, 2, 3, 4].map((n) => (
              <PowerCategoryRow
                key={n}
                icon={MdSpeed}
                tone={['blue', 'indigo', 'purple', 'teal'][n - 1]}
                title={`Mill ${n}:`}
                columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
              >
                {metricRow(OTG_FIELDS(n))}
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

export default ShreddarOTG;
