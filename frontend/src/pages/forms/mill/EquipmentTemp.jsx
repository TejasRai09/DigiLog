import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';
import ReportDateFields from '../../../components/ReportDateFields';

const SHIFTS = ['A', 'B', 'C', 'G'];

/** Row labels / placeholders — milling_logbook1.html */
const equipList = [
  { key: 'CaneKeig', label: 'Cane Kicker' },
  { key: 'CardDrum1', label: 'Cardian Drum 1' },
  { key: 'CardDrum2', label: 'Cardian Drum 2' },
  { key: 'FeedDrum', label: 'Feeder Drum' },
  { key: 'CaneCar', label: 'Cane Carrier' },
  { key: 'ShredCar', label: 'Shred. Carrier' },
  { key: 'BeltConvy', label: 'Belt Convy' },
  { key: 'IRC1', label: 'IRC 1' },
  { key: 'IRC2', label: 'IRC 2' },
  { key: 'IRC3', label: 'IRC 3' },
  { key: 'IRC4', label: 'IRC 4' },
  { key: 'Mill0', label: 'Mill 0' },
  { key: 'Mill4', label: 'Mill 4' },
];

const TEMP_FIELDS = [
  { suffix: 'MtrTemp', placeholder: 'Motor Temp' },
  { suffix: 'GearTempDE', placeholder: 'Gear Temp (DE)' },
  { suffix: 'GearTempNDE', placeholder: 'Gear Temp (NDE)' },
  { suffix: 'BearTempDE', placeholder: 'Bearing Temp (DE)' },
  { suffix: 'BearTempNDE', placeholder: 'Bearing Temp (NDE)' },
];

const buildInitial = () => {
  const init = { date: '', shift: '', time: '' };
  equipList.forEach(({ key }) => {
    TEMP_FIELDS.forEach(({ suffix }) => {
      init[`${key}_${suffix}`] = '';
    });
  });
  return init;
};

const INITIAL = buildInitial();

const EquipmentTemp = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date || !form.shift) { toast.error('Date and Shift are required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/mill_logbook1', form);
      toast.success('Equipment Temperature submitted!');
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
          <h3 className="section-title">Equipments </h3>
          {equipList.map(({ key, label }) => (
            <div key={key} className="mb-5 last:mb-0">
              <p className="text-sm font-semibold text-gray-800 mb-2">{`${label}:`}</p>
              <div className="form-row">
                {TEMP_FIELDS.map(({ suffix, placeholder }) => (
                  <LegacyNumField
                    key={`${key}_${suffix}`}
                    label=""
                    name={`${key}_${suffix}`}
                    value={form[`${key}_${suffix}`]}
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

export default EquipmentTemp;
