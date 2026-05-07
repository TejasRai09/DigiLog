import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import {
  PH_STOPPAGE_CATEGORY_OPTIONS,
  PH_STOPPAGE_MACHINERY_OPTIONS,
  PH_STOPPAGE_SECTION_OPTIONS,
  PH_STOPPAGE_SUBSECTION_OPTIONS,
} from './phStoppageOptions';

const INITIAL = {
  date: '', startTime: '', endTime: '',
  section: '', sub_section: '', machinery: '', category: '', remarks: '',
};

const PhStoppage = () => {
  const navigate = useNavigate();
  const [form, setForm]       = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.startTime || !form.endTime) {
      toast.error('Date, Start Time and End Time are required.');
      return;
    }
    if (!form.section || !form.sub_section || !form.machinery || !form.category) {
      toast.error('Section, Sub-Section, Machinery and Category are required.');
      return;
    }
    if (!String(form.remarks ?? '').trim()) {
      toast.error('Remark is required.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/forms/ph_stoppage', form);
      toast.success('Stoppage Details submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-6">GSMA Power — Stoppages</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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
            <label className="label">Remark:<span className="text-red-500 ml-0.5">*</span></label>
            <textarea name="remarks" value={form.remarks} onChange={handleChange} rows={3} required className="input resize-none" placeholder="" />
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
    </main>
  );
};

export default PhStoppage;
