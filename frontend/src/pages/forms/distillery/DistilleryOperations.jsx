import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';
import { computeDistilleryDerived } from '../../../utils/distilleryCalculations';

const OPERATION_MODES = ['Syrup', 'B Heavy', 'C Heavy', 'None'];

const DERIVED_ROWS = [
  { key: 'fs', label: 'FS' },
  { key: 'fs_quantity', label: 'FS Quantity' },
  { key: 'theoretical_yield', label: 'Theoretical yield' },
  { key: 'alcohol_prod_fermentation', label: 'Alcohol prod in fermentation' },
  { key: 'fe', label: 'FE' },
  { key: 'actual_prod_al', label: 'Actual prod. AL' },
  { key: 'de', label: 'DE' },
  { key: 'oe', label: 'OE' },
  { key: 'rec_bl', label: 'REC BL' },
  { key: 'rec_al', label: 'REC AL' },
  { key: 'trs_qty', label: 'TRS QTY' },
  { key: 'ufs_qty', label: 'UFS QTY' },
];

/** If abs(v) is below 1 (0 before the decimal), up to 6 fractional digits (trimmed); else 2 decimals. */
function formatDerived(v) {
  if (v === null || v === undefined) return '';
  if (typeof v !== 'number' || !Number.isFinite(v)) return '';

  const av = Math.abs(v);
  if (av === 0) return '0';

  if (av < 1) {
    return String(Number.parseFloat(Number(v.toFixed(6))));
  }

  return v.toFixed(2);
}

const INITIAL = {
  date: '',
  operation_mode: '',
  syrup_molasses_qtls: '',
  wash_distilled: '',
  trs: '',
  ufs: '',
  alcohol_pct: '',
  actual_ethanol_bl: '',
  al_bl_ratio_pct: '',
  total_bh_molasses_qtls: '',
  total_ch_molasses_qtls: '',
  ethanol_storage_bl: '',
};

const DistilleryOperations = () => {
  const navigate           = useNavigate();
  const [form, setForm]    = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const derived = useMemo(() => computeDistilleryDerived(form), [form]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) {
      toast.error('Operation Date is required.');
      return;
    }
    setSubmitting(true);
    const payload = { ...form, ...derived };
    try {
      await api.post('/forms/distillery_ops', payload);
      toast.success('Distillery operations saved.');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors"
      >
        <MdArrowBack className="h-4 w-4" /> Back
      </button>

      <div className="mb-8">
        <h1 className="page-title">GSMA Distillery Operations Form</h1>
        <p className="text-sm text-gray-500 mt-1">
          Daily operations tracking form for Distillery at GSMA
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="form-section">
          <label className="label" htmlFor="op-date">
            Operation Date<span className="text-red-500 ml-0.5">*</span>
          </label>
          <input
            id="op-date"
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            required
            className="input max-w-[12rem]"
          />
        </div>

        <div className="form-section space-y-3">
          <h3 className="section-title">Operation Mode</h3>
          <div className="flex flex-wrap gap-4">
            {OPERATION_MODES.map((mode) => (
              <label
                key={mode}
                className="flex items-center gap-2 cursor-pointer text-sm text-gray-800"
              >
                <input
                  type="radio"
                  name="operation_mode"
                  value={mode}
                  checked={form.operation_mode === mode}
                  onChange={handleChange}
                  className="text-teal-600 focus:ring-teal-500"
                />
                {mode}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section space-y-4">
          <h3 className="section-title">Production readings</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <LegacyNumField
              label="Syrup/Molasses Used (Qtls)"
              name="syrup_molasses_qtls"
              value={form.syrup_molasses_qtls}
              onChange={handleChange}
            />
            <LegacyNumField
              label="Wash Distilled"
              name="wash_distilled"
              value={form.wash_distilled}
              onChange={handleChange}
            />
            <LegacyNumField label="TRS" name="trs" value={form.trs} onChange={handleChange} />
            <LegacyNumField label="UFS" name="ufs" value={form.ufs} onChange={handleChange} />
            <LegacyNumField
              label="Alcohol %"
              name="alcohol_pct"
              value={form.alcohol_pct}
              onChange={handleChange}
            />
            <LegacyNumField
              label="Actual Ethanol Production (BL)"
              name="actual_ethanol_bl"
              value={form.actual_ethanol_bl}
              onChange={handleChange}
            />
            <LegacyNumField
              label="AL/BL Ratio (%)"
              name="al_bl_ratio_pct"
              value={form.al_bl_ratio_pct}
              onChange={handleChange}
            />
            <LegacyNumField
              label="Total BH Molasses in Storage (Distillery) – Qtls"
              name="total_bh_molasses_qtls"
              value={form.total_bh_molasses_qtls}
              onChange={handleChange}
            />
            <LegacyNumField
              label="Total CH Molasses in Storage (Distillery) – Qtls"
              name="total_ch_molasses_qtls"
              value={form.total_ch_molasses_qtls}
              onChange={handleChange}
            />
            <LegacyNumField
              label="Ethanol in Storage (BL)"
              name="ethanol_storage_bl"
              value={form.ethanol_storage_bl}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h3 className="section-title">Calculated fields</h3>
          <p className="text-xs text-gray-500">
            Derived from entries above; stored with the record. Division by zero shows blank.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DERIVED_ROWS.map(({ key, label }) => (
              <div key={key}>
                <label className="label text-gray-600">{label}</label>
                <input
                  type="text"
                  readOnly
                  value={formatDerived(derived[key])}
                  className="input bg-gray-50 text-gray-800 cursor-default"
                  tabIndex={-1}
                  aria-readonly="true"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={() => setForm(INITIAL)} className="btn-secondary">
            Reset
          </button>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>
    </main>
  );
};

export default DistilleryOperations;
