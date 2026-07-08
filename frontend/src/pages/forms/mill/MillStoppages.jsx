import { useMemo, useState } from 'react';
import { MdPauseCircleOutline } from 'react-icons/md';
import FormReviewModal from '../../../components/FormReviewModal';
import {
  PowerFormCard,
  PowerFormPage,
  PowerMetricField,
  PowerRemarkBlock,
  PowerSelectField,
} from '../../../components/power/PowerLogbookFormUI';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { buildMillStoppageReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';
import {
  MILL_STOPPAGE_MACHINERY_OPTIONS,
  MILL_STOPPAGE_SECTION_OPTIONS,
} from './millStoppageOptions';

const INITIAL = {
  date: '', startTime: '', endTime: '',
  section: '', machinery: '', remarks: '',
};

const MillStoppages = () => {
  const [form, setForm] = useState(INITIAL);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date || !form.startTime || !form.endTime) {
        toast.error('Date, Start Time and End Time are required.');
        return false;
      }
      return true;
    },
    submit: async () => {
      await gsmaSubmitRequest(
        () => api.post('/forms/mill_stoppages', form),
        'Mill Stoppage submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildMillStoppageReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <>
      <PowerFormPage
        formKey="mill_stoppages"
        fallbackTitle="Mill Stoppages"
        title="Mill Stoppages"
        onClear={() => setForm(INITIAL)}
        submitting={submitting}
        formId="mill-stoppages-form"
      >
        <form id="mill-stoppages-form" onSubmit={openReview} className="space-y-0">
          <PowerFormCard icon={MdPauseCircleOutline} title="Stoppage Details:">
            <div className="space-y-5 py-4">
              <PowerMetricField
                label="Report Date:"
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                placeholder=""
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <PowerMetricField
                  label="From:"
                  name="startTime"
                  type="datetime-local"
                  step="60"
                  value={form.startTime}
                  onChange={handleChange}
                  placeholder=""
                />
                <PowerMetricField
                  label="To:"
                  name="endTime"
                  type="datetime-local"
                  step="60"
                  value={form.endTime}
                  onChange={handleChange}
                  placeholder=""
                />
              </div>

              <PowerSelectField
                label="Section:"
                name="section"
                value={form.section}
                onChange={handleChange}
                options={MILL_STOPPAGE_SECTION_OPTIONS}
                required
              />

              <PowerSelectField
                label="Machinery:"
                name="machinery"
                value={form.machinery}
                onChange={handleChange}
                options={MILL_STOPPAGE_MACHINERY_OPTIONS}
                required
              />

              <PowerRemarkBlock
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                required
                label="Remark:"
                showCounter={false}
                placeholder=""
              />
            </div>
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

export default MillStoppages;
