import { useMemo, useState } from 'react';
import { MdThermostat } from 'react-icons/md';
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
import { buildEquipmentTempReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const SHIFTS = ['A', 'B', 'C'];

const EQUIP_TONES = ['green', 'orange', 'purple', 'amber', 'blue', 'indigo', 'pink', 'teal', 'cyan', 'rose', 'slate', 'green', 'orange'];

const equipList = [
  { key: 'CaneKeig', label: 'Cane Kicker' },
  { key: 'CardDrum1', label: 'Cardian Drum 1' },
  { key: 'CardDrum2', label: 'Cardian Drum 2' },
  { key: 'FeedDrum', label: 'Feeder Drum' },
  { key: 'CaneCar', label: 'Cane Carrier' },
  { key: 'ShredCar', label: 'Shred. Carrier' },
  { key: 'BeltConvy', label: 'Belt Convy' },
  { key: 'IRC1', label: 'IRC 1' },
  { key: 'IRC2', label: 'IRC 2' },
  { key: 'IRC3', label: 'IRC 3' },
  { key: 'IRC4', label: 'IRC 4' },
  { key: 'Mill0', label: 'Mill 0' },
  { key: 'Mill4', label: 'Mill 4' },
];

const TEMP_FIELDS = [
  { suffix: 'MtrTemp', label: 'Motor Temp' },
  { suffix: 'GearTempDE', label: 'Gear Temp (DE)' },
  { suffix: 'GearTempNDE', label: 'Gear Temp (NDE)' },
  { suffix: 'BearTempDE', label: 'Bearing Temp (DE)' },
  { suffix: 'BearTempNDE', label: 'Bearing Temp (NDE)' },
];

const buildInitial = () => {
  const init = { date: '', shift: '' };
  equipList.forEach(({ key }) => {
    TEMP_FIELDS.forEach(({ suffix }) => {
      init[`${key}_${suffix}`] = '';
    });
  });
  return init;
};

const INITIAL = buildInitial();
const F = PowerMetricField;

const EquipmentTemp = () => {
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
        () => api.post('/forms/mill_logbook1', form),
        'Equipment Temperature submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildEquipmentTempReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <>
      <PowerFormPage
        formKey="mill_logbook1"
        fallbackTitle="Equipment Temperature"
        title="Equipment Temperature"
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
            icon={MdThermostat}
            title="Equipments:"
            collapseAll={collapseAll}
            onToggleCollapseAll={toggleCollapseAll}
          >
            {equipList.map(({ key, label }, idx) => (
              <PowerCategoryRow
                key={key}
                icon={MdThermostat}
                tone={EQUIP_TONES[idx % EQUIP_TONES.length]}
                title={`${label}:`}
                columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
              >
                {TEMP_FIELDS.map(({ suffix, label: fieldLabel }) => (
                  <F
                    key={`${key}_${suffix}`}
                    label={fieldLabel}
                    name={`${key}_${suffix}`}
                    value={form[`${key}_${suffix}`]}
                    onChange={handleChange}
                    placeholder={fieldLabel}
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

export default EquipmentTemp;
