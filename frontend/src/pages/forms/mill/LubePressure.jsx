import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';
import ReportDateFields from '../../../components/ReportDateFields';

const SHIFTS = ['A', 'B', 'C', 'G'];

const LUBE_FIELDS = [
  ['LubePressure_ACC', 'ACC (Kg/Sq.Cm)'],
  ['LubePressure_MCC', 'MCC (Kg/Sq.Cm)'],
  ['LubePressure_Shred', 'Shredder (Kg/Sq.Cm)'],
  ['LubePressure_M0', 'Mill 0 (Kg/Sq.Cm)'],
];

const ROLLER_PLACE = [
  ['gsT', 'Gear Side (T)'],
  ['gsB', 'Gear Side (B)'],
  ['gsUF', 'Gear Side (U/F)'],
  ['psT', 'Pintal Side (T)'],
  ['psB', 'Pintal Side (B)'],
  ['psUF', 'Pintal Side (U/F)'],
];

const INITIAL = {
  date: '', shift: '', time: '',
  LubePressure_ACC: '', LubePressure_MCC: '', LubePressure_Shred: '', LubePressure_M0: '',
  M0_gsT: '', M0_gsB: '', M0_gsUF: '', M0_psT: '', M0_psB: '', M0_psUF: '',
  M1_gsT: '', M1_gsB: '', M1_gsUF: '', M1_psT: '', M1_psB: '', M1_psUF: '',
  M2_gsT: '', M2_gsB: '', M2_gsUF: '', M2_psT: '', M2_psB: '', M2_psUF: '',
  M3_gsT: '', M3_gsB: '', M3_gsUF: '', M3_psT: '', M3_psB: '', M3_psUF: '',
  M4_gsT: '', M4_gsB: '', M4_gsUF: '', M4_psT: '', M4_psB: '', M4_psUF: '',
};

const LubePressure = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.shift) { toast.error('Date and Shift are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/mill_logbook3', form);
      toast.success('Lube Pressure and Roller Temp submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-6">GSMA Mill Logbook </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-section">
          <div className="form-row flex-wrap gap-6 items-end">
            <ReportDateFields
              dateValue={form.date}
              timeValue={form.time}
              onChange={handleChange}
              dateRequired
            />
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
          <h3 className="section-title">Lube Pump Pressure</h3>
          <div className="form-row flex-wrap">
            {LUBE_FIELDS.map(([nameKey, placeholder]) => (
              <LegacyNumField
                key={nameKey}
                label=""
                name={nameKey}
                value={form[nameKey]}
                onChange={handleChange}
                placeholder={placeholder}
              />
            ))}
          </div>
        </div>

        <div className="form-section">
          <h3 className="section-title">Mill Roller Temperature</h3>
          {['M0', 'M1', 'M2', 'M3', 'M4'].map((m) => (
            <div key={m} className="mb-5 last:mb-0">
              <p className="text-sm font-semibold text-gray-800 mb-2">{`Mill ${m.slice(1)}:`}</p>
              <div className="form-row flex-wrap">
                {ROLLER_PLACE.map(([suf, placeholder]) => (
                  <LegacyNumField
                    key={`${m}_${suf}`}
                    label=""
                    name={`${m}_${suf}`}
                    value={form[`${m}_${suf}`]}
                    onChange={handleChange}
                    placeholder={placeholder}
                  />
                ))}
              </div>
            </div>
          ))}
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

export default LubePressure;
