import { useMemo, useState } from 'react';
import { MdLocalFireDepartment, MdWhatshot } from 'react-icons/md';
import FormReviewModal from '../../../components/FormReviewModal';
import {
  PowerCategoryRow,
  PowerDateCard,
  PowerFormCard,
  PowerFormPage,
  PowerMetricField,
  PowerStageLabel,
  usePowerCollapseAll,
} from '../../../components/power/PowerLogbookFormUI';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { buildPhSteamReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const INITIAL = {
  date: '',
  SteamGen150: '', SteamCon30MW: '',
  SteamtoSugar110_3ATAPRDS: '', Stmto3Old110_45ATAPRDS: '', Stmto3New110_45ATAPRDS: '',
  StmMillTurbine110_45ATAPRDS: '', StmtoDistil110_45ATAPRDS_o: '', Stm4MWTG110_45ATAPRDS: '',
  DSHWater110_3ATA: '', DSHWater110_45ATA: '',
  ExtractionStm30MW: '', Bleed2HPH1Stm: '', Bleed1HPH2Stm: '',
  TotalStmtoSug150: '', Stmtodeareator150: '',
  SteamGen70: '',
  StmCons3Old35: '', StmCons3New35: '', StmDist70: '', Stmto4_70TPH: '',
  DSHWater2ATA: '',
  TotalStmtoSug70: '',
  SteamGen35: '',
  StmCons4: '', StmCons45_55ATAPRDS: '', Stm45_55ATADeareatorEjectorPRDS: '',
  DSHWater5_5ATA: '',
  Extractionstm4: '',
  TotalStmdistil: '', StmtoEjector: '', Stm35TDeareator: '', StmtoSugDisti: '',
  Firewood150: '', Baggase150: '',
  Firewood70: '', Baggase70: '',
  Firewood35: '', Baggase35: '', SlopCon: '',
};

const F = PowerMetricField;

const PhSteam = () => {
  const [form, setForm] = useState(INITIAL);
  const { collapseAll, toggleCollapseAll } = usePowerCollapseAll();

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date) {
        toast.error('Date is required.');
        return false;
      }
      return true;
    },
    submit: async () => {
      await gsmaSubmitRequest(
        () => api.post('/forms/ph_steam', form),
        'Steam Details submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildPhSteamReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <>
      <PowerFormPage
        formKey="ph_steam"
        fallbackTitle="Steam Details"
        title="Steam Details"
        onClear={() => setForm(INITIAL)}
        submitting={submitting}
      >
        <form id="power-logbook-form" onSubmit={openReview}>
          <PowerDateCard value={form.date} onChange={handleChange} required />

          <PowerFormCard
            icon={MdWhatshot}
            title="Steam Details"
            collapseAll={collapseAll}
            onToggleCollapseAll={toggleCollapseAll}
          >
            <PowerCategoryRow icon={MdLocalFireDepartment} tone="orange" title="150 TPH:" columns="sm:grid-cols-2 lg:grid-cols-3">
              <PowerStageLabel>Stage 1</PowerStageLabel>
              <F label="Steam Generation" name="SteamGen150" value={form.SteamGen150} onChange={handleChange} placeholder="Steam Generation" />
              <PowerStageLabel>Stage 2</PowerStageLabel>
              <F label="Steam Consumption:" name="SteamCon30MW" value={form.SteamCon30MW} onChange={handleChange} placeholder="30 MW" />
              <F label="Steam to Sugar through 110/3 ATA PRDS:" name="SteamtoSugar110_3ATAPRDS" value={form.SteamtoSugar110_3ATAPRDS} onChange={handleChange} placeholder="" />
              <F label="Steam to 3 MW TG Old through 110/45 ATA PRDS:" name="Stmto3Old110_45ATAPRDS" value={form.Stmto3Old110_45ATAPRDS} onChange={handleChange} placeholder="" />
              <F label="Steam to 3 MW TG New through 110/45 ATA PRDS:" name="Stmto3New110_45ATAPRDS" value={form.Stmto3New110_45ATAPRDS} onChange={handleChange} placeholder="" />
              <F label="Steam to Mill Turbine through 110/45 ATA PRDS:" name="StmMillTurbine110_45ATAPRDS" value={form.StmMillTurbine110_45ATAPRDS} onChange={handleChange} placeholder="" />
              <F label="Steam to Distillery Process through 110/45 ATA PRDS:" name="StmtoDistil110_45ATAPRDS_o" value={form.StmtoDistil110_45ATAPRDS_o} onChange={handleChange} placeholder="" />
              <F label="Steam to 4MW TG through 110/45 ATA PRDS:" name="Stm4MWTG110_45ATAPRDS" value={form.Stm4MWTG110_45ATAPRDS} onChange={handleChange} placeholder="" />
              <F label="DSH Water to 110/3 ATA Steam" name="DSHWater110_3ATA" value={form.DSHWater110_3ATA} onChange={handleChange} placeholder="" />
              <F label="DSH Water to 110/45 ATA Steam" name="DSHWater110_45ATA" value={form.DSHWater110_45ATA} onChange={handleChange} placeholder="" />
              <PowerStageLabel>Stage 3</PowerStageLabel>
              <F label="Extraction Steam from 30MW TG" name="ExtractionStm30MW" value={form.ExtractionStm30MW} onChange={handleChange} placeholder="30 MW" />
              <F label="Bleed 2 to HP H1 Steam" name="Bleed2HPH1Stm" value={form.Bleed2HPH1Stm} onChange={handleChange} placeholder="30 MW" />
              <F label="Bleed 1 to HP H2 Steam" name="Bleed1HPH2Stm" value={form.Bleed1HPH2Stm} onChange={handleChange} placeholder="30 MW" />
              <PowerStageLabel>Stage 4</PowerStageLabel>
              <F label="Total Steam to Sugar Process" name="TotalStmtoSug150" value={form.TotalStmtoSug150} onChange={handleChange} placeholder="" />
              <F label="Steam to Deareator (150 TPH)" name="Stmtodeareator150" value={form.Stmtodeareator150} onChange={handleChange} placeholder="150 TPH" />
              <PowerStageLabel>Fuel Consumption:</PowerStageLabel>
              <F label="Firewood (MT)" name="Firewood150" value={form.Firewood150} onChange={handleChange} placeholder="Firewood (MT)" />
              <F label="Baggase (MT)" name="Baggase150" value={form.Baggase150} onChange={handleChange} placeholder="Baggase (MT)" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdLocalFireDepartment} tone="amber" title="70 TPH:" columns="sm:grid-cols-2 lg:grid-cols-3">
              <PowerStageLabel>Stage 1</PowerStageLabel>
              <F label="Steam Generation" name="SteamGen70" value={form.SteamGen70} onChange={handleChange} placeholder="Steam Generation" />
              <PowerStageLabel>Stage 2</PowerStageLabel>
              <F label="Steam Consp. 3 MW TG Old:" name="StmCons3Old35" value={form.StmCons3Old35} onChange={handleChange} placeholder="" />
              <F label="Steam Consp. 3 MW TG New:" name="StmCons3New35" value={form.StmCons3New35} onChange={handleChange} placeholder="" />
              <F label="Steam to Distillery Process from 70 TPH:" name="StmDist70" value={form.StmDist70} onChange={handleChange} placeholder="" />
              <F label="Steam to 4 MW Turbine from 70 TPH:" name="Stmto4_70TPH" value={form.Stmto4_70TPH} onChange={handleChange} placeholder="" />
              <F label="DSH Water to 2 ATA Steam" name="DSHWater2ATA" value={form.DSHWater2ATA} onChange={handleChange} placeholder="" />
              <PowerStageLabel>Stage 3</PowerStageLabel>
              <F label="Total Steam to Sugar:" name="TotalStmtoSug70" value={form.TotalStmtoSug70} onChange={handleChange} placeholder="" />
              <PowerStageLabel>Fuel Consumption:</PowerStageLabel>
              <F label="Firewood (MT)" name="Firewood70" value={form.Firewood70} onChange={handleChange} placeholder="Firewood (MT)" />
              <F label="Baggase (MT)" name="Baggase70" value={form.Baggase70} onChange={handleChange} placeholder="Baggase (MT)" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdLocalFireDepartment} tone="rose" title="35 TPH:" columns="sm:grid-cols-2 lg:grid-cols-3">
              <PowerStageLabel>Stage 1</PowerStageLabel>
              <F label="Steam Generation" name="SteamGen35" value={form.SteamGen35} onChange={handleChange} placeholder="Steam Generation" />
              <PowerStageLabel>Stage 2</PowerStageLabel>
              <F label="Steam Consumption 4 MW Turbine:" name="StmCons4" value={form.StmCons4} onChange={handleChange} placeholder="" />
              <F label="Steam through 45/5.5 ATA Process PRDS:" name="StmCons45_55ATAPRDS" value={form.StmCons45_55ATAPRDS} onChange={handleChange} placeholder="" />
              <F label="Steam through 45/5.5 ATA Deareator & Ejector PRDS:" name="Stm45_55ATADeareatorEjectorPRDS" value={form.Stm45_55ATADeareatorEjectorPRDS} onChange={handleChange} placeholder="" />
              <F label="DSH Water to 5.5 ATA Steam" name="DSHWater5_5ATA" value={form.DSHWater5_5ATA} onChange={handleChange} placeholder="" />
              <PowerStageLabel>Stage 3</PowerStageLabel>
              <F label="Extraction steam from 4MW TG:" name="Extractionstm4" value={form.Extractionstm4} onChange={handleChange} placeholder="" />
              <PowerStageLabel>Stage 4</PowerStageLabel>
              <F label="Total Steam to distillery process:" name="TotalStmdistil" value={form.TotalStmdistil} onChange={handleChange} placeholder="" />
              <F label="Steam to Ejector:" name="StmtoEjector" value={form.StmtoEjector} onChange={handleChange} placeholder="" />
              <F label="Steam to 35T Boiler Deareator from TG :" name="Stm35TDeareator" value={form.Stm35TDeareator} onChange={handleChange} placeholder="" />
              <F label="Steam to Sugar from Distillery:" name="StmtoSugDisti" value={form.StmtoSugDisti} onChange={handleChange} placeholder="" />
              <PowerStageLabel>Fuel Consumption:</PowerStageLabel>
              <F label="Firewood (MT)" name="Firewood35" value={form.Firewood35} onChange={handleChange} placeholder="Firewood (MT)" />
              <F label="Baggase (MT)" name="Baggase35" value={form.Baggase35} onChange={handleChange} placeholder="Baggase (MT)" />
              <F label="Slop Consumption (MT)" name="SlopCon" value={form.SlopCon} onChange={handleChange} placeholder="Slop Consumption (MT)" />
            </PowerCategoryRow>
          </PowerFormCard>
        </form>
      </PowerFormPage>

      {reviewConfig ? (
        <FormReviewModal
          open={reviewOpen}
          onClose={closeReview}
          onConfirm={confirmSubmit}
          confirming={submitting}
          {...reviewConfig}
        />
      ) : null}
    </>
  );
};

export default PhSteam;
