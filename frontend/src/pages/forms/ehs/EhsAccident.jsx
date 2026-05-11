import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const ACCIDENT_TYPES = ['', 'Minor', 'Major', 'Fatal'];

const INITIAL = {
  date: '', time: '',
  injured_person: '', department: '', location: '',
  type_of_accident: '', description: '',
};

const EhsAccident = () => {
  const navigate            = useNavigate();
  const [form, setForm]     = useState(INITIAL);
  const [submitting, setSub] = useState(false);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date)            { toast.error('Date is required.');            return; }
    if (!form.injured_person)  { toast.error('Injured person is required.');  return; }
    if (!form.type_of_accident){ toast.error('Accident type is required.');   return; }
    setSub(true);
    try {
      await api.post('/forms/ehs_accident', form);
      toast.success('Accident record submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSub(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-6">Accident Data Register</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
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
    </main>
  );
};

export default EhsAccident;
