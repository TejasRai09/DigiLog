import { useMemo, useRef, useState } from 'react';
import { MdSave } from 'react-icons/md';
import FormPageHeader from '../../../components/FormPageHeader';
import FormReviewModal from '../../../components/FormReviewModal';
import PhotoUploadGrid from '../../../components/PhotoUploadGrid';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import { buildPhStoppageReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';
import { serializeHistoryPhotos } from '../../../utils/equipmentHistoryModel';
import {
  PH_STOPPAGE_CATEGORY_OPTIONS,
  PH_STOPPAGE_MACHINERY_OPTIONS,
  PH_STOPPAGE_SECTION_OPTIONS,
  PH_STOPPAGE_SUBSECTION_OPTIONS,
} from './phStoppageOptions';

const REMARK_MIN = 20;
const REMARK_MAX = 150;
const MAX_STOPPAGE_PHOTOS = 2;

const INITIAL = {
  date: '', startTime: '', endTime: '',
  section: '', sub_section: '', machinery: '', category: '', remarks: '',
  photos: [],
};

const PhStoppage = () => {
  const [form, setForm] = useState(INITIAL);
  const photoInputRef = useRef(null);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const remarkLength = form.remarks.trim().length;
  const remarkBelowMin = remarkLength < REMARK_MIN;

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date || !form.startTime || !form.endTime) {
        toast.error('Date, Start Time and End Time are required.');
        return false;
      }
      if (!form.section || !form.sub_section || !form.machinery || !form.category) {
        toast.error('Section, Sub-Section, Machinery and Category are required.');
        return false;
      }
      const remarks = form.remarks.trim();
      if (!remarks) {
        toast.error('Remark is required.');
        return false;
      }
      if (remarks.length < REMARK_MIN) {
        toast.error(`Remark must be at least ${REMARK_MIN} characters.`);
        return false;
      }
      if (remarks.length > REMARK_MAX) {
        toast.error(`Remark must be at most ${REMARK_MAX} characters.`);
        return false;
      }
      if (form.photos.length > MAX_STOPPAGE_PHOTOS) {
        toast.error(`Maximum ${MAX_STOPPAGE_PHOTOS} photos allowed.`);
        return false;
      }
      return true;
    },
    submit: async () => {
      const payload = {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        section: form.section,
        sub_section: form.sub_section,
        machinery: form.machinery,
        category: form.category,
        remarks: form.remarks.trim(),
        stoppage_photos: serializeHistoryPhotos(form.photos),
      };
      await gsmaSubmitRequest(
        () => api.post('/forms/ph_stoppage', payload),
        'Stoppage Details submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildPhStoppageReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <FormPageHeader formKey="ph_stoppage" fallbackTitle="Stoppage Details" />

      <form onSubmit={openReview} noValidate className="space-y-4">
        <div className="form-section space-y-4">
          <div>
            <label className="label">Report Date:<span className="text-red-500 ml-0.5">*</span></label>
            <input type="date" name="date" value={form.date} onChange={handleChange} required className="input" />
          </div>

          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">From:<span className="text-red-500 ml-0.5">*</span></label>
              <input type="datetime-local" name="startTime" value={form.startTime} onChange={handleChange} required className="input" />
            </div>
            <div>
              <label className="label">To:<span className="text-red-500 ml-0.5">*</span></label>
              <input type="datetime-local" name="endTime" value={form.endTime} onChange={handleChange} required className="input" />
            </div>
          </div>

          <div>
            <label className="label">Section:<span className="text-red-500 ml-0.5">*</span></label>
            <select name="section" value={form.section} onChange={handleChange} required className="input">
              {PH_STOPPAGE_SECTION_OPTIONS.map((opt) => (
                <option key={opt || '__empty'} value={opt}>{opt || '— Select —'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Sub-Section:<span className="text-red-500 ml-0.5">*</span></label>
            <select name="sub_section" value={form.sub_section} onChange={handleChange} required className="input">
              {PH_STOPPAGE_SUBSECTION_OPTIONS.map((opt) => (
                <option key={opt || '__empty'} value={opt}>{opt || '— Select —'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Machinery:<span className="text-red-500 ml-0.5">*</span></label>
            <select name="machinery" value={form.machinery} onChange={handleChange} required className="input max-h-48">
              {PH_STOPPAGE_MACHINERY_OPTIONS.map((opt) => (
                <option key={opt || '__empty'} value={opt}>{opt || '— Select —'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Category:<span className="text-red-500 ml-0.5">*</span></label>
            <select name="category" value={form.category} onChange={handleChange} required className="input">
              {PH_STOPPAGE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt || '__empty'} value={opt}>{opt || '— Select —'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">
              Remark:<span className="text-red-500 ml-0.5">*</span>
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({REMARK_MIN}–{REMARK_MAX} characters)
              </span>
            </label>
            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              rows={3}
              maxLength={REMARK_MAX}
              className="input resize-none"
              placeholder=""
            />
            <p
              className={`mt-1 text-right text-xs ${
                remarkBelowMin ? 'font-medium text-red-600' : 'text-gray-400'
              }`}
            >
              {remarkLength}/{REMARK_MAX}
            </p>
          </div>

          <div>
            <label className="label block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
              Stoppage Photos (max {MAX_STOPPAGE_PHOTOS})
            </label>
            <PhotoUploadGrid
              photos={form.photos}
              onChange={(photos) => setForm((p) => ({ ...p, photos }))}
              inputRef={photoInputRef}
              maxPhotos={MAX_STOPPAGE_PHOTOS}
            />
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

export default PhStoppage;
