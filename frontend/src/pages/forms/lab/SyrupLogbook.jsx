import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';

const SHIFTS = ['A', 'B', 'C', 'G'];
const DIV_OPTIONS = ['No Diversion', 'DS', 'RS'];

const INITIAL = {
  date: '', shift: '',
  syrp_prodDS: '', syrp_prodRS: '',
  div_mode: 'No Diversion',
  syrp_div: '',
  MoLtoDist_DS: '', MoLtoDist_RS: '',
  syrp_trs: '', bh_trs: '',
};

const SyrupLogbook = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.shift) { toast.error('Date and Shift are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/syrp_logbook', form);
      toast.success('Syrup Logbook submitted!');
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
      <h1 className="page-title mb-6">GSMA Logbook - Syrup</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-section">
          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">Report Date:<span className="text-red-500 ml-0.5">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handleChange} required className="input" />
            </div>
            <div>
              <label className="label">Shift:<span className="text-red-500 ml-0.5">*</span></label>
              <select name="shift" value={form.shift} onChange={handleChange} required className="input">
                <option value="">— Select —</option>
                {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3 className="section-title">Syrup Production:</h3>
          <div className="form-row flex-wrap">
            <LegacyNumField label="" placeholder="Syrup Production (DS)" name="syrp_prodDS" value={form.syrp_prodDS} onChange={handleChange} />
            <LegacyNumField label="" placeholder="Syrup Production (RS)" name="syrp_prodRS" value={form.syrp_prodRS} onChange={handleChange} />
          </div>
        </div>

        <div className="form-section">
          <label className="label">Diversion From:<span className="text-red-500 ml-0.5">*</span></label>
          <select name="div_mode" value={form.div_mode} onChange={handleChange} required className="input max-w-md">
            {DIV_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div className="form-section">
          <h3 className="section-title">Syrup Diversion:</h3>
          <LegacyNumField label="" placeholder="Diversion Qty (Qtls)" name="syrp_div" value={form.syrp_div} onChange={handleChange} />
        </div>

        <div className="form-section">
          <h3 className="section-title">MolassestoDistil:</h3>
          <div className="form-row flex-wrap">
            <LegacyNumField label="" placeholder="From DS" name="MoLtoDist_DS" value={form.MoLtoDist_DS} onChange={handleChange} />
            <LegacyNumField label="" placeholder="From RS" name="MoLtoDist_RS" value={form.MoLtoDist_RS} onChange={handleChange} />
          </div>
        </div>

        <div className="form-section">
          <h3 className="section-title">Quality:</h3>
          <div className="form-row flex-wrap">
            <LegacyNumField label="" placeholder="Avg Syrup TRS" name="syrp_trs" value={form.syrp_trs} onChange={handleChange} />
            <LegacyNumField label="" placeholder="Avg B-Heavy TRS" name="bh_trs" value={form.bh_trs} onChange={handleChange} />
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

export default SyrupLogbook;
