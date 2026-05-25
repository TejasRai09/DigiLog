import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const GRADES = ['A-Massecuite', 'A1-Massecuite', 'B-Massecuite', 'C-Massecuite', 'C1-Massecuite'];

const makeStrike = (grade) => ({ grade, strike_no: '', pan_no: '', start_time: '', drop_time: '', boil_time: '', down_time: '', qty: '', cry_no: '', sample_purity: '', brix: '', purity: '', remarks: '' });

const INITIAL = {
  date: '', season: '2025-26',
  strikes: GRADES.map(makeStrike),
};

const ProdPanLogbook = () => {
  const navigate = useNavigate();
  const [form, setForm]         = useState(INITIAL);
  const [activeGrade, setActiveGrade] = useState(GRADES[0]);
  const [submitting, setSub]    = useState(false);

  const handleMeta = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleStrike = (grade, field, val) =>
    setForm((p) => ({
      ...p,
      strikes: p.strikes.map((s) => s.grade === grade ? { ...s, [field]: val } : s),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSub(true);
    try {
      const rows = form.strikes.map((s) => ({ date: form.date, season: form.season, ...s }));
      await api.post('/forms/prod_pan_logbook/batch', { rows });
      toast.success('Pan Log Book submitted!');
      setForm(INITIAL);
      setActiveGrade(GRADES[0]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSub(false);
    }
  };

  const activeStrike = form.strikes.find((s) => s.grade === activeGrade);

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-1">Pan Log Book</h1>
      <p className="text-xs text-gray-500 mb-6 uppercase tracking-wider">Zuari Industries Ltd — Gobind Sugar Mill</p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-section grid grid-cols-2 gap-4">
          <div>
            <label className="label">Boiling Operation Date <span className="text-red-500">*</span></label>
            <input type="date" name="date" value={form.date} onChange={handleMeta} required className="input" />
          </div>
          <div>
            <label className="label">Season</label>
            <input type="text" name="season" value={form.season} onChange={handleMeta} className="input" />
          </div>
        </div>

        <div className="form-section space-y-3">
          <label className="label">Select Massecuite Grade</label>
          <div className="flex flex-wrap gap-2">
            {GRADES.map((g) => (
              <button key={g} type="button" onClick={() => setActiveGrade(g)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${activeGrade === g ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {activeStrike && (
          <div className="form-section space-y-5">
            <h2 className="text-sm font-semibold text-emerald-800 uppercase tracking-wide">{activeGrade} — Parameters Log</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['Strike No.', 'strike_no', 'e.g. A-12'],
                ['Pan No.', 'pan_no', 'e.g. 03'],
                ['Starting Time', 'start_time', '00:00'],
                ['Dropping Time', 'drop_time', '00:00'],
                ['Boiling Time (Hrs)', 'boil_time', 'e.g. 3.5'],
                ['Down Time (Mins)', 'down_time', 'e.g. 15 min'],
                ['Massecuite Qty', 'qty', 'Volume'],
                ['Dropping Cry No.', 'cry_no', 'Crystallizer no.'],
              ].map(([label, field, ph]) => (
                <div key={field}>
                  <label className="label">{label}</label>
                  <input type="text" value={activeStrike[field]} onChange={(e) => handleStrike(activeGrade, field, e.target.value)} placeholder={ph} className="input" />
                </div>
              ))}
            </div>
            <div className="bg-gray-50 border rounded-lg p-4 space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Laboratory Analysis</p>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="label">Key Sample Purity (%)</label><input type="text" value={activeStrike.sample_purity} onChange={(e) => handleStrike(activeGrade, 'sample_purity', e.target.value)} placeholder="Purity %" className="input" /></div>
                <div><label className="label">Massecuite Brix (%)</label><input type="text" value={activeStrike.brix} onChange={(e) => handleStrike(activeGrade, 'brix', e.target.value)} placeholder="Brix %" className="input" /></div>
                <div><label className="label">Massecuite Purity (%)</label><input type="text" value={activeStrike.purity} onChange={(e) => handleStrike(activeGrade, 'purity', e.target.value)} placeholder="Purity %" className="input" /></div>
              </div>
            </div>
            <div>
              <label className="label">Remarks</label>
              <input type="text" value={activeStrike.remarks} onChange={(e) => handleStrike(activeGrade, 'remarks', e.target.value)} placeholder="Notes..." className="input" />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => { setForm(INITIAL); setActiveGrade(GRADES[0]); }} className="btn-secondary">Reset</button>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit All Grades'}
          </button>
        </div>
      </form>
    </main>
  );
};

export default ProdPanLogbook;
