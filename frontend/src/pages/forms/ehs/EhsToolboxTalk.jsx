import { useEffect, useMemo, useState } from 'react';
import { MdSave } from 'react-icons/md';
import FormPageHeader from '../../../components/FormPageHeader';
import FormReviewModal from '../../../components/FormReviewModal';
import FormPhotoUploadRow from '../../../components/FormPhotoUploadRow';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import useAuth from '../../../hooks/useAuth';
import { buildEhsToolboxTalkReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const SHIFT_OPTIONS = ['', 'A', 'B', 'C'];
const TOPIC_MIN = 20;
const TOPIC_MAX = 150;
const TIME_RANGE_ERROR = 'Time — To must be later than Time — From (24-hour format).';

/** Compare HH:mm values from `<input type="time">` (24-hour). */
const isEndTimeAfterStart = (start, end) => Boolean(start && end && end > start);

const getTimeRangeError = (start, end) => {
  if (!start || !end) return '';
  if (!isEndTimeAfterStart(start, end)) return TIME_RANGE_ERROR;
  return '';
};

/** Character count for topic validation — whitespace is not counted. */
const countTopicChars = (text) => String(text ?? '').replace(/\s/g, '').length;

const PHOTO_ROWS = [
  {
    key: 'attendance_sheet_photo',
    label: 'Attendance Sheet Photo',
    hint: 'Scanned roster sheet verifying headcount.',
    required: true,
  },
  {
    key: 'session_photo',
    label: 'Session Photo 1',
    hint: 'Primary slide capture or presenter photo.',
    required: true,
  },
  {
    key: 'session_photo_2',
    label: 'Session Photo 2',
    hint: 'Additional session context or audience view.',
    optional: true,
  },
];

const buildInitial = (preparedBy = '') => ({
  date: '',
  shift: '',
  start_time: '',
  end_time: '',
  report_prepared_by: preparedBy,
  topic_discussed: '',
  no_of_attendees: '',
  attendance_sheet_photo: '',
  session_photo: '',
  session_photo_2: '',
});

const EhsToolboxTalk = () => {
  const { user } = useAuth();
  const [form, setForm] = useState(() => buildInitial(user?.name ?? ''));
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (user?.name) {
      setForm((prev) => ({ ...prev, report_prepared_by: user.name }));
    }
  }, [user?.name]);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleTimeChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => {
      const next = { ...p, [name]: value };
      setTimeError(getTimeRangeError(
        name === 'start_time' ? value : next.start_time,
        name === 'end_time' ? value : next.end_time,
      ));
      return next;
    });
  };

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date) { toast.error('Date is required.'); return false; }
      if (!form.shift) { toast.error('Shift is required.'); return false; }
      if (!form.start_time) {
        setTimeError('Time — From is required.');
        toast.error('Time — From is required.');
        return false;
      }
      if (!form.end_time) {
        setTimeError('Time — To is required.');
        toast.error('Time — To is required.');
        return false;
      }
      const rangeErr = getTimeRangeError(form.start_time, form.end_time);
      if (rangeErr) {
        setTimeError(rangeErr);
        toast.error(rangeErr);
        return false;
      }
      setTimeError('');
      if (!form.report_prepared_by?.trim()) {
        toast.error('Report prepared by is required.');
        return false;
      }
      const topic = form.topic_discussed?.trim() ?? '';
      const topicChars = countTopicChars(topic);
      if (topicChars < TOPIC_MIN) {
        toast.error(`Topic discussed must be at least ${TOPIC_MIN} characters (spaces not counted).`);
        return false;
      }
      if (topicChars > TOPIC_MAX) {
        toast.error(`Topic discussed must be at most ${TOPIC_MAX} characters (spaces not counted).`);
        return false;
      }
      if (topic.length > TOPIC_MAX) {
        toast.error(`Topic discussed must be at most ${TOPIC_MAX} characters in total.`);
        return false;
      }
      const n = Number(form.no_of_attendees);
      if (!Number.isInteger(n) || n < 1) {
        toast.error('Number of attendees must be a whole number of at least 1.');
        return false;
      }
      if (!form.attendance_sheet_photo) {
        toast.error('Attendance sheet photo is required.');
        return false;
      }
      if (!form.session_photo) {
        toast.error('Session photo 1 is required.');
        return false;
      }
      return true;
    },
    submit: async () => {
      const payload = {
        ...form,
        topic_discussed: form.topic_discussed.trim(),
      };
      await gsmaSubmitRequest(
        () => api.post('/forms/ehs_toolbox_talk', payload),
        'Toolbox talk report submitted!',
      );
      setForm(buildInitial(user?.name ?? ''));
      setTimeError('');
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildEhsToolboxTalkReview(form) : null),
    [reviewOpen, form],
  );

  const topicCharCount = countTopicChars(form.topic_discussed);
  const topicBelowMin = topicCharCount < TOPIC_MIN;

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <FormPageHeader
        formKey="ehs_toolbox_talk"
        fallbackTitle="Daily Safety Toolbox Talk"
        fallbackDescription="Record daily toolbox talk session with attendance and session photos"
      />

      <form onSubmit={openReview} noValidate className="space-y-6">

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Session Details</h2>
          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">Date<span className="text-red-500 ml-0.5">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handle} required className="input" />
            </div>
            <div>
              <label className="label">Shift<span className="text-red-500 ml-0.5">*</span></label>
              <select name="shift" value={form.shift} onChange={handle} required className="input">
                {SHIFT_OPTIONS.map((o) => (
                  <option key={o || 'empty'} value={o}>{o || '— Select —'}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">Time — From<span className="text-red-500 ml-0.5">*</span></label>
              <input
                type="time"
                name="start_time"
                value={form.start_time}
                onChange={handleTimeChange}
                aria-invalid={Boolean(timeError)}
                aria-describedby={timeError ? 'time-range-error' : undefined}
                className={`input ${timeError ? 'border-red-500 ring-1 ring-red-500/30' : ''}`}
              />
            </div>
            <div>
              <label className="label">Time — To<span className="text-red-500 ml-0.5">*</span></label>
              <input
                type="time"
                name="end_time"
                value={form.end_time}
                onChange={handleTimeChange}
                aria-invalid={Boolean(timeError)}
                aria-describedby={timeError ? 'time-range-error' : undefined}
                className={`input ${timeError ? 'border-red-500 ring-1 ring-red-500/30' : ''}`}
              />
            </div>
          </div>
          {timeError ? (
            <p id="time-range-error" role="alert" className="text-sm text-red-600 font-medium">
              {timeError}
            </p>
          ) : null}
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Report Information</h2>
          <div>
            <label className="label">Report Prepared By</label>
            <input
              type="text"
              name="report_prepared_by"
              value={form.report_prepared_by}
              readOnly
              className="input bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="label">
              Topic Discussed<span className="text-red-500 ml-0.5">*</span>
              <span className="ml-2 text-xs font-normal text-gray-400">
                ({TOPIC_MIN}–{TOPIC_MAX} characters, spaces not counted)
              </span>
            </label>
            <textarea
              name="topic_discussed"
              value={form.topic_discussed}
              onChange={handle}
              rows={3}
              className="input resize-none"
              placeholder="Describe the safety topic covered in this toolbox talk…"
            />
            <p
              className={`mt-1 text-xs text-right ${topicBelowMin ? 'text-red-600 font-medium' : 'text-gray-400'}`}
              aria-live="polite"
            >
              {topicCharCount}/{TOPIC_MAX}
            </p>
          </div>
          <div>
            <label className="label">No. of Attendees<span className="text-red-500 ml-0.5">*</span></label>
            <input
              type="number"
              name="no_of_attendees"
              value={form.no_of_attendees}
              onChange={handle}
              min={1}
              step={1}
              required
              className="input max-w-xs"
            />
          </div>
        </div>

        <div className="form-section">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Photos</h2>
          {PHOTO_ROWS.map((row) => (
            <FormPhotoUploadRow
              key={row.key}
              label={row.label}
              hint={row.hint}
              value={form[row.key]}
              onChange={(v) => setForm((p) => ({ ...p, [row.key]: v }))}
              required={row.required}
              optional={row.optional}
            />
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => { setForm(buildInitial(user?.name ?? '')); setTimeError(''); }} className="btn-secondary">
            Reset
          </button>
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

export default EhsToolboxTalk;
