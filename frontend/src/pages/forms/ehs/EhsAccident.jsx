import { useMemo, useState } from 'react';
import { MdSave } from 'react-icons/md';
import FormPageHeader from '../../../components/FormPageHeader';
import FormReviewModal from '../../../components/FormReviewModal';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import { buildEhsAccidentReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const ACCIDENT_TYPES = ['', 'Minor', 'Major', 'Fatal'];

const INITIAL = {
  date: '', time: '',
  injured_person: '', department: '', location: '',
  type_of_accident: '', description: '',
};

const EhsAccident = () => {
  const [form, setForm] = useState(INITIAL);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date) { toast.error('Date is required.'); return false; }
      if (!form.injured_person) { toast.error('Injured person is required.'); return false; }
      if (!form.type_of_accident) { toast.error('Accident type is required.'); return false; }
      return true;
    },
    submit: async () => {
      await gsmaSubmitRequest(
        () => api.post('/forms/ehs_accident', form),
        'Accident record submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildEhsAccidentReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <FormPageHeader formKey="ehs_accident" fallbackTitle="Accident Data Register" />

      <form onSubmit={openReview} className="space-y-4">
        <div className="form-section space-y-4">

          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">Date<span className="text-red-500 ml-0.5">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handle} required className="input" />
            </div>
            <div>
              <label className="label">Time</label>
              <input type="time" name="time" value={form.time} onChange={handle} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Injured Person Name<span className="text-red-500 ml-0.5">*</span></label>
            <input type="text" name="injured_person" value={form.injured_person} onChange={handle} required className="input" />
          </div>

          <div className="form-row flex-wrap gap-4">
            <div className="flex-1">
              <label className="label">Department</label>
              <input type="text" name="department" value={form.department} onChange={handle} className="input" />
            </div>
            <div className="flex-1">
              <label className="label">Location</label>
              <input type="text" name="location" value={form.location} onChange={handle} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Type of Accident<span className="text-red-500 ml-0.5">*</span></label>
            <select name="type_of_accident" value={form.type_of_accident} onChange={handle} required className="input">
              {ACCIDENT_TYPES.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Description</label>
            <textarea name="description" value={form.description} onChange={handle} rows={5} className="input resize-none" />
          </div>
        </div>

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

export default EhsAccident;
