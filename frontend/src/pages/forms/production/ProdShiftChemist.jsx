import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave, MdAssignment, MdAccessTime } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const SHIFTS = [
  { key: 'shift8_4',  label: 'Shift 8–4 (Morning)' },
  { key: 'shift4_12', label: 'Shift 4–12 (Evening)' },
  { key: 'shift12_8', label: 'Shift 12–8 (Night)' },
];

const makeShiftState = () => ({ jobs_done: '', jobs_todo: '', sign: '', signed: false });

const INITIAL = {
  date: '', season: '2025-26', instructions: '',
  shift8_4:  makeShiftState(),
  shift4_12: makeShiftState(),
  shift12_8: makeShiftState(),
};

const ProdShiftChemist = () => {
  const navigate = useNavigate();
  const [form, setForm]       = useState(INITIAL);
  const [activeShift, setActiveShift] = useState('shift8_4');
  const [submitting, setSub]  = useState(false);

  const handleMeta = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleShift = (key, field, val) =>
    setForm((p) => ({ ...p, [key]: { ...p[key], [field]: val } }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSub(true);
    try {
      await api.post('/forms/prod_shift_chemist', {
        date: form.date,
        season: form.season,
        instructions: form.instructions,
        shift8_4_jobs_done:  form.shift8_4.jobs_done,
        shift8_4_jobs_todo:  form.shift8_4.jobs_todo,
        shift8_4_sign:       form.shift8_4.sign,
        shift4_12_jobs_done: form.shift4_12.jobs_done,
        shift4_12_jobs_todo: form.shift4_12.jobs_todo,
        shift4_12_sign:      form.shift4_12.sign,
        shift12_8_jobs_done: form.shift12_8.jobs_done,
        shift12_8_jobs_todo: form.shift12_8.jobs_todo,
        shift12_8_sign:      form.shift12_8.sign,
      });
      toast.success('Shift Chemist Log Book submitted!');
      setForm(INITIAL);
      setActiveShift('shift8_4');
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
      <h1 className="page-title mb-1">Shift Chemist Job Log Book</h1>
      <p className="text-xs text-gray-500 mb-6 uppercase tracking-wider">Production Department Log Register</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-section grid grid-cols-2 gap-4">
          <div>
            <label className="label">Date <span className="text-red-500">*</span></label>
            <input type="date" name="date" value={form.date} onChange={handleMeta} required className="input" />
          </div>
          <div>
            <label className="label">Season</label>
            <input type="text" name="season" value={form.season} onChange={handleMeta} className="input" />
          </div>
        </div>

        <div className="form-section space-y-3">
          <label className="label">Choose Shift to Log</label>
          <div className="flex gap-2">
            {SHIFTS.map((s) => (
              <button key={s.key} type="button" onClick={() => setActiveShift(s.key)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${activeShift === s.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {SHIFTS.map((s) => activeShift === s.key && (
          <div key={s.key} className="form-section space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{s.label}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label flex items-center gap-1"><MdAssignment className="h-3.5 w-3.5" /> Jobs Done</label>
                <textarea rows={5} value={form[s.key].jobs_done}
                  onChange={(e) => handleShift(s.key, 'jobs_done', e.target.value)}
                  placeholder="Log jobs accomplished this shift..."
                  className="input resize-none" />
              </div>
              <div>
                <label className="label flex items-center gap-1"><MdAccessTime className="h-3.5 w-3.5" /> Jobs To Be Done</label>
                <textarea rows={5} value={form[s.key].jobs_todo}
                  onChange={(e) => handleShift(s.key, 'jobs_todo', e.target.value)}
                  placeholder="Log pending tasks for next shift..."
                  className="input resize-none" />
              </div>
            </div>
            <div className="flex items-center justify-between bg-gray-50 border rounded-lg p-4">
              <span className="text-xs text-gray-600 font-medium">
                {form[s.key].signed ? `Verified by: ${form[s.key].sign}` : 'Awaiting signature'}
              </span>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form[s.key].signed}
                  onChange={(e) => {
                    handleShift(s.key, 'signed', e.target.checked);
                    handleShift(s.key, 'sign', e.target.checked ? 'Admin' : '');
                  }}
                  className="w-4 h-4 rounded text-blue-600" />
                Confirm Sign-off & Verify Shift Logs
              </label>
            </div>
          </div>
        ))}

        <div className="form-section">
          <label className="label">Instructions / Remarks</label>
          <textarea name="instructions" value={form.instructions} onChange={handleMeta} rows={3} className="input resize-none" placeholder="General hand-over remarks..." />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => { setForm(INITIAL); setActiveShift('shift8_4'); }} className="btn-secondary">Reset</button>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </main>
  );
};

export default ProdShiftChemist;
