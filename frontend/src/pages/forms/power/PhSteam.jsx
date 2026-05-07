import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import LegacyNumField from '../../../components/LegacyNumField';
import ReportDateFields from '../../../components/ReportDateFields';

const BoilerTitle = ({ children }) => (
  <h2 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-1 mt-6 first:mt-0">{children}</h2>
);

const StageLabel = ({ children }) => (
  <p className="text-sm font-semibold text-gray-700 mt-4 mb-2">{children}</p>
);

const INITIAL = {
  date: '', time: '',
  SteamGen150: '', SteamCon30MW: '',
  SteamtoSugar110_3ATAPRDS: '', Stmto3Old110_45ATAPRDS: '', Stmto3New110_45ATAPRDS: '',
  StmMillTurbine110_45ATAPRDS: '', StmtoDistil110_45ATAPRDS_o: '', Stm4MWTG110_45ATAPRDS: '',
  ExtractionStm30MW: '', Bleed2HPH1Stm: '', Bleed1HPH2Stm: '',
  TotalStmtoSug150: '', Stmtodeareator150: '',
  SteamGen70: '',
  StmCons3Old35: '', StmCons3New35: '', StmDist70: '', Stmto4_70TPH: '',
  TotalStmtoSug70: '',
  SteamGen35: '',
  StmCons4: '', StmCons45_55ATAPRDS: '', Stm45_55ATADeareatorEjectorPRDS: '',
  Extractionstm4: '',
  TotalStmdistil: '', StmtoEjector: '', Stm35TDeareator: '', StmtoSugDisti: '',
  Firewood150: '', Baggase150: '',
  Firewood70: '', Baggase70: '',
  Firewood35: '', Baggase35: '', SlopCon: '',
};

const PhSteam = () => {
  const navigate = useNavigate();
  const [form, setForm]       = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/ph_steam', form);
      toast.success('Steam Details submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const F = LegacyNumField;

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

        <div className="form-section space-y-2">
          <BoilerTitle>150 TPH:</BoilerTitle>
          <StageLabel>Stage 1</StageLabel>
          <div className="form-row flex-wrap">
            <F name="SteamGen150" value={form.SteamGen150} onChange={handleChange} placeholder="Steam Generation" />
          </div>
          <StageLabel>Stage 2</StageLabel>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            <F label="Steam Consumption:" name="SteamCon30MW" value={form.SteamCon30MW} onChange={handleChange} placeholder="30 MW" />
            <F label="Steam to Sugar through 110/3 ATA PRDS:" name="SteamtoSugar110_3ATAPRDS" value={form.SteamtoSugar110_3ATAPRDS} onChange={handleChange} placeholder="" />
            <F label="Steam to 3 MW TG Old through 110/45 ATA PRDS:" name="Stmto3Old110_45ATAPRDS" value={form.Stmto3Old110_45ATAPRDS} onChange={handleChange} placeholder="" />
            <F label="Steam to 3 MW TG New through 110/45 ATA PRDS:" name="Stmto3New110_45ATAPRDS" value={form.Stmto3New110_45ATAPRDS} onChange={handleChange} placeholder="" />
            <F label="Steam to Mill Turbine through 110/45 ATA PRDS:" name="StmMillTurbine110_45ATAPRDS" value={form.StmMillTurbine110_45ATAPRDS} onChange={handleChange} placeholder="" />
            <F label="Steam to Distillery Process through 110/45 ATA PRDS:" name="StmtoDistil110_45ATAPRDS_o" value={form.StmtoDistil110_45ATAPRDS_o} onChange={handleChange} placeholder="" />
            <F label="Steam to 4MW TG through 110/45 ATA PRDS:" name="Stm4MWTG110_45ATAPRDS" value={form.Stm4MWTG110_45ATAPRDS} onChange={handleChange} placeholder="" />
          </div>
          <StageLabel>Stage 3</StageLabel>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <F label="Extraction Steam from 30MW TG" name="ExtractionStm30MW" value={form.ExtractionStm30MW} onChange={handleChange} placeholder="30 MW" />
            <F label="Bleed 2 to HP H1 Steam" name="Bleed2HPH1Stm" value={form.Bleed2HPH1Stm} onChange={handleChange} placeholder="30 MW" />
            <F label="Bleed 1 to HP H2 Steam" name="Bleed1HPH2Stm" value={form.Bleed1HPH2Stm} onChange={handleChange} placeholder="30 MW" />
          </div>
          <StageLabel>Stage 4</StageLabel>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            <F label="Total Steam to Sugar Process" name="TotalStmtoSug150" value={form.TotalStmtoSug150} onChange={handleChange} placeholder="" />
            <F label="Steam to Deareator (150 TPH)" name="Stmtodeareator150" value={form.Stmtodeareator150} onChange={handleChange} placeholder="150 TPH" />
          </div>
          <StageLabel>Fuel Consumption:</StageLabel>
          <div className="form-row flex-wrap">
            <F name="Firewood150" value={form.Firewood150} onChange={handleChange} placeholder="Firewood (MT)" />
            <F name="Baggase150" value={form.Baggase150} onChange={handleChange} placeholder="Baggase (MT)" />
          </div>
        </div>

        <div className="form-section space-y-2">
          <BoilerTitle>70 TPH:</BoilerTitle>
          <StageLabel>Stage 1</StageLabel>
          <div className="form-row flex-wrap">
            <F name="SteamGen70" value={form.SteamGen70} onChange={handleChange} placeholder="Steam Generation" />
          </div>
          <StageLabel>Stage 2</StageLabel>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            <F label="Steam Consp. 3 MW TG Old:" name="StmCons3Old35" value={form.StmCons3Old35} onChange={handleChange} placeholder="" />
            <F label="Steam Consp. 3 MW TG New:" name="StmCons3New35" value={form.StmCons3New35} onChange={handleChange} placeholder="" />
            <F label="Steam to Distillery Process from 70 TPH:" name="StmDist70" value={form.StmDist70} onChange={handleChange} placeholder="" />
            <F label="Steam to 4 MW Turbine from 70 TPH:" name="Stmto4_70TPH" value={form.Stmto4_70TPH} onChange={handleChange} placeholder="" />
          </div>
          <StageLabel>Stage 3</StageLabel>
          <div className="form-row flex-wrap">
            <F label="Total Steam to Sugar:" name="TotalStmtoSug70" value={form.TotalStmtoSug70} onChange={handleChange} placeholder="" />
          </div>
          <StageLabel>Fuel Consumption:</StageLabel>
          <div className="form-row flex-wrap">
            <F name="Firewood70" value={form.Firewood70} onChange={handleChange} placeholder="Firewood (MT)" />
            <F name="Baggase70" value={form.Baggase70} onChange={handleChange} placeholder="Baggase (MT)" />
          </div>
        </div>

        <div className="form-section space-y-2">
          <BoilerTitle>35 TPH:</BoilerTitle>
          <StageLabel>Stage 1</StageLabel>
          <div className="form-row flex-wrap">
            <F name="SteamGen35" value={form.SteamGen35} onChange={handleChange} placeholder="Steam Generation" />
          </div>
          <StageLabel>Stage 2</StageLabel>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            <F label="Steam Consumption 4 MW Turbine:" name="StmCons4" value={form.StmCons4} onChange={handleChange} placeholder="" />
            <F label="Steam through 45/5.5 ATA Process PRDS:" name="StmCons45_55ATAPRDS" value={form.StmCons45_55ATAPRDS} onChange={handleChange} placeholder="" />
            <F label="Steam through 45/5.5 ATA Deareator & Ejector PRDS:" name="Stm45_55ATADeareatorEjectorPRDS" value={form.Stm45_55ATADeareatorEjectorPRDS} onChange={handleChange} placeholder="" />
          </div>
          <StageLabel>Stage 3</StageLabel>
          <div className="form-row flex-wrap">
            <F label="Extraction steam from 4MW TG:" name="Extractionstm4" value={form.Extractionstm4} onChange={handleChange} placeholder="" />
          </div>
          <StageLabel>Stage 4</StageLabel>
          <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2">
            <F label="Total Steam to distillery process:" name="TotalStmdistil" value={form.TotalStmdistil} onChange={handleChange} placeholder="" />
            <F label="Steam to Ejector:" name="StmtoEjector" value={form.StmtoEjector} onChange={handleChange} placeholder="" />
            <F label="Steam to 35T Boiler Deareator from TG :" name="Stm35TDeareator" value={form.Stm35TDeareator} onChange={handleChange} placeholder="" />
            <F label="Steam to Sugar from Distillery:" name="StmtoSugDisti" value={form.StmtoSugDisti} onChange={handleChange} placeholder="" />
          </div>
          <StageLabel>Fuel Consumption:</StageLabel>
          <div className="form-row flex-wrap">
            <F name="Firewood35" value={form.Firewood35} onChange={handleChange} placeholder="Firewood (MT)" />
            <F name="Baggase35" value={form.Baggase35} onChange={handleChange} placeholder="Baggase (MT)" />
            <F name="SlopCon" value={form.SlopCon} onChange={handleChange} placeholder="Slop Consumption (MT)" />
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

export default PhSteam;
