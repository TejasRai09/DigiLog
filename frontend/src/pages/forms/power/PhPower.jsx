import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';
import ReportDateFields from '../../../components/ReportDateFields';

const PowerRow = ({ rowLabel, children }) => (
  <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
    <span className="label shrink-0 min-w-[8rem] sm:min-w-[11rem] text-gray-800">{rowLabel}</span>
    <div className="flex flex-wrap gap-4 flex-1">{children}</div>
  </div>
);

const INITIAL = {
  date: '', time: '',
  Crush: '', Baggase: '',
  Hours30: '', Hours3Old: '', Hours3New: '', Hours4: '',
  PowerGen30: '', PowerGen3Old: '', PowerGen3New: '', PowerGen4MW: '',
  GenDG30: '', GenDG3Old: '', GenDG3New: '', GenDG4: '',
  ExportGrid30: '', ExportGrid3Old: '', ExportGrid3New: '', ExportGrid4: '',
  ExportSug30: '', ExportSug3Old: '', ExportSug3New: '', ExportSug4: '',
  ExportCogen30: '', ExportCogen3Old: '', ExportCogen3New: '', ExportCogen4: '',
  ExportDist30: '',
  Imp_Grid: '', Imp_3MWOld: '', Imp_3MWNew: '', Imp_4MW: '',
  PowerConMillHouse: '', PowerConDSHouse: '', PowerConRaw_Ref: '',
  PowerCon70TPH: '', PowerConETP: '', PowerConColony: '', PowerConOthers: '',
  remark: '',
};

const PhPower = () => {
  const navigate = useNavigate();
  const [form, setForm]       = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/ph_power', form);
      toast.success('Power Details submitted!');
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
      <h1 className="page-title mb-6">GSMA Power Logbook</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-section space-y-3">
          <div className="form-row flex-wrap justify-center sm:justify-start">
            <ReportDateFields
              dateValue={form.date}
              timeValue={form.time}
              onChange={handleChange}
              dateRequired
              timeRequired
            />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h3 className="section-title">Power Details:</h3>
          <div className="space-y-5">
            <PowerRow rowLabel="Crushing:">
              <LegacyNumField name="Crush" value={form.Crush} onChange={handleChange} placeholder="Cane Crushed (Qtls)" />
              <LegacyNumField name="Baggase" value={form.Baggase} onChange={handleChange} placeholder="Bagasse Produced (Qtls)" />
            </PowerRow>
            <PowerRow rowLabel="Operating Hours:">
              <LegacyNumField name="Hours30" value={form.Hours30} onChange={handleChange} placeholder="30.85MW STG" />
              <LegacyNumField name="Hours3Old" value={form.Hours3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <LegacyNumField name="Hours3New" value={form.Hours3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <LegacyNumField name="Hours4" value={form.Hours4} onChange={handleChange} placeholder="4MW STG" />
            </PowerRow>
            <PowerRow rowLabel="Power Generation:">
              <LegacyNumField name="PowerGen30" value={form.PowerGen30} onChange={handleChange} placeholder="30.85MW STG" />
              <LegacyNumField name="PowerGen3Old" value={form.PowerGen3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <LegacyNumField name="PowerGen3New" value={form.PowerGen3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <LegacyNumField name="PowerGen4MW" value={form.PowerGen4MW} onChange={handleChange} placeholder="4MW STG" />
            </PowerRow>
            <PowerRow rowLabel="Power Gen by DG Set:">
              <LegacyNumField name="GenDG30" value={form.GenDG30} onChange={handleChange} placeholder="625KVA DG Set 1" />
              <LegacyNumField name="GenDG3Old" value={form.GenDG3Old} onChange={handleChange} placeholder="625KVA DG Set 2" />
              <LegacyNumField name="GenDG3New" value={form.GenDG3New} onChange={handleChange} placeholder="625KVA DG Set 3" />
              <LegacyNumField name="GenDG4" value={form.GenDG4} onChange={handleChange} placeholder="380KVA DG Set 4" />
            </PowerRow>
            <PowerRow rowLabel="Power Import:">
              <LegacyNumField name="Imp_Grid" value={form.Imp_Grid} onChange={handleChange} placeholder="Grid" />
              <LegacyNumField name="Imp_3MWOld" value={form.Imp_3MWOld} onChange={handleChange} placeholder="3MW Old" />
              <LegacyNumField name="Imp_3MWNew" value={form.Imp_3MWNew} onChange={handleChange} placeholder="3MW New" />
              <LegacyNumField name="Imp_4MW" value={form.Imp_4MW} onChange={handleChange} placeholder="4MW" />
            </PowerRow>
            <PowerRow rowLabel="Power Export to Grid:">
              <LegacyNumField name="ExportGrid30" value={form.ExportGrid30} onChange={handleChange} placeholder="30.85MW STG" />
              <LegacyNumField name="ExportGrid3Old" value={form.ExportGrid3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <LegacyNumField name="ExportGrid3New" value={form.ExportGrid3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <LegacyNumField name="ExportGrid4" value={form.ExportGrid4} onChange={handleChange} placeholder="4MW STG" />
            </PowerRow>
            <PowerRow rowLabel="Power to Sugar:">
              <LegacyNumField name="ExportSug30" value={form.ExportSug30} onChange={handleChange} placeholder="30.85MW STG" />
              <LegacyNumField name="ExportSug3Old" value={form.ExportSug3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <LegacyNumField name="ExportSug3New" value={form.ExportSug3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <LegacyNumField name="ExportSug4" value={form.ExportSug4} onChange={handleChange} placeholder="4MW STG" />
            </PowerRow>
            <PowerRow rowLabel="Power to Sugar (Breakup):">
              <LegacyNumField name="PowerConMillHouse" value={form.PowerConMillHouse} onChange={handleChange} placeholder="Power Consumption Mill" />
              <LegacyNumField name="PowerConDSHouse" value={form.PowerConDSHouse} onChange={handleChange} placeholder="Power Consumption DS" />
              <LegacyNumField name="PowerConRaw_Ref" value={form.PowerConRaw_Ref} onChange={handleChange} placeholder="Power Consp. Raw & Ref." />
              <LegacyNumField name="PowerCon70TPH" value={form.PowerCon70TPH} onChange={handleChange} placeholder="Power Consumption 70TPH" />
              <LegacyNumField name="PowerConETP" value={form.PowerConETP} onChange={handleChange} placeholder="Power Consp. ETP" />
              <LegacyNumField name="PowerConColony" value={form.PowerConColony} onChange={handleChange} placeholder="Power Consp. Colony" />
              <LegacyNumField name="PowerConOthers" value={form.PowerConOthers} onChange={handleChange} placeholder="Power Consp. Others" />
            </PowerRow>
            <PowerRow rowLabel="Power to Cogen (Aux Consp):">
              <LegacyNumField name="ExportCogen30" value={form.ExportCogen30} onChange={handleChange} placeholder="30.85MW STG" />
              <LegacyNumField name="ExportCogen3Old" value={form.ExportCogen3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <LegacyNumField name="ExportCogen3New" value={form.ExportCogen3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <LegacyNumField name="ExportCogen4" value={form.ExportCogen4} onChange={handleChange} placeholder="4MW STG" />
            </PowerRow>
            <PowerRow rowLabel="Power to Distillery from 30MW:">
              <LegacyNumField name="ExportDist30" value={form.ExportDist30} onChange={handleChange} placeholder="30.85MW STG" />
            </PowerRow>
            <div>
              <label className="label">Remark:</label>
              <textarea name="remark" value={form.remark} onChange={handleChange} rows={3} className="input resize-none" placeholder="" />
            </div>
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

export default PhPower;
