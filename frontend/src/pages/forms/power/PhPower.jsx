import { useMemo, useState } from 'react';
import {
  MdBolt,
  MdDownload,
  MdEco,
  MdElectricBolt,
  MdFactory,
  MdLocalBar,
  MdPieChart,
  MdSchedule,
  MdSettings,
  MdUpload,
} from 'react-icons/md';
import FormReviewModal from '../../../components/FormReviewModal';
import {
  PowerCategoryRow,
  PowerDateCard,
  PowerFormCard,
  PowerFormPage,
  PowerMetricField,
  PowerRemarkBlock,
  usePowerCollapseAll,
} from '../../../components/power/PowerLogbookFormUI';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { buildPhPowerReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const INITIAL = {
  date: '',
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
  PowerCon70TPH: '', PowerConETP: '', PowerConColony: '', PowerConSugarCPU: '', PowerConOthers: '',
  remark: '',
};

const F = PowerMetricField;

const PhPower = () => {
  const [form, setForm] = useState(INITIAL);
  const { collapseAll, toggleCollapseAll } = usePowerCollapseAll();

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date) {
        toast.error('Date is required.');
        return false;
      }
      if (!form.remark?.trim()) {
        toast.error('General remarks is required.');
        return false;
      }
      return true;
    },
    submit: async () => {
      await gsmaSubmitRequest(
        () => api.post('/forms/ph_power', { ...form, remark: form.remark.trim() }),
        'Power Details submitted!',
      );
      setForm(INITIAL);
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildPhPowerReview(form) : null),
    [reviewOpen, form],
  );

  return (
    <>
      <PowerFormPage
        formKey="ph_power"
        fallbackTitle="Power Details"
        title="Power Details"
        onClear={() => setForm(INITIAL)}
        submitting={submitting}
      >
        <form id="power-logbook-form" onSubmit={openReview} className="space-y-0">
          <PowerDateCard value={form.date} onChange={handleChange} required />

          <PowerFormCard
            icon={MdBolt}
            title="Power Details:"
            collapseAll={collapseAll}
            onToggleCollapseAll={toggleCollapseAll}
          >
            <PowerCategoryRow icon={MdEco} tone="green" title="Crushing:">
              <F label="Cane Crushed (Qtls)" name="Crush" value={form.Crush} onChange={handleChange} placeholder="Cane Crushed (Qtls)" />
              <F label="Bagasse Produced (Qtls)" name="Baggase" value={form.Baggase} onChange={handleChange} placeholder="Bagasse Produced (Qtls)" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdSchedule} tone="orange" title="Operating Hours:">
              <F label="30.85MW STG" name="Hours30" value={form.Hours30} onChange={handleChange} placeholder="30.85MW STG" />
              <F label="3MW STG (O)" name="Hours3Old" value={form.Hours3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <F label="3MW STG (N)" name="Hours3New" value={form.Hours3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <F label="4MW STG" name="Hours4" value={form.Hours4} onChange={handleChange} placeholder="4MW STG" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdBolt} tone="purple" title="Power Generation:">
              <F label="30.85MW STG" name="PowerGen30" value={form.PowerGen30} onChange={handleChange} placeholder="30.85MW STG" />
              <F label="3MW STG (O)" name="PowerGen3Old" value={form.PowerGen3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <F label="3MW STG (N)" name="PowerGen3New" value={form.PowerGen3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <F label="4MW STG" name="PowerGen4MW" value={form.PowerGen4MW} onChange={handleChange} placeholder="4MW STG" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdElectricBolt} tone="amber" title="Power Gen by DG Set:">
              <F label="625KVA DG Set 1" name="GenDG30" value={form.GenDG30} onChange={handleChange} placeholder="625KVA DG Set 1" />
              <F label="625KVA DG Set 2" name="GenDG3Old" value={form.GenDG3Old} onChange={handleChange} placeholder="625KVA DG Set 2" />
              <F label="625KVA DG Set 3" name="GenDG3New" value={form.GenDG3New} onChange={handleChange} placeholder="625KVA DG Set 3" />
              <F label="380KVA DG Set 4" name="GenDG4" value={form.GenDG4} onChange={handleChange} placeholder="380KVA DG Set 4" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdDownload} tone="blue" title="Power Import:">
              <F label="Grid" name="Imp_Grid" value={form.Imp_Grid} onChange={handleChange} placeholder="Grid" />
              <F label="3MW Old" name="Imp_3MWOld" value={form.Imp_3MWOld} onChange={handleChange} placeholder="3MW Old" />
              <F label="3MW New" name="Imp_3MWNew" value={form.Imp_3MWNew} onChange={handleChange} placeholder="3MW New" />
              <F label="4MW" name="Imp_4MW" value={form.Imp_4MW} onChange={handleChange} placeholder="4MW" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdUpload} tone="indigo" title="Power Export to Grid:">
              <F label="30.85MW STG" name="ExportGrid30" value={form.ExportGrid30} onChange={handleChange} placeholder="30.85MW STG" />
              <F label="3MW STG (O)" name="ExportGrid3Old" value={form.ExportGrid3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <F label="3MW STG (N)" name="ExportGrid3New" value={form.ExportGrid3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <F label="4MW STG" name="ExportGrid4" value={form.ExportGrid4} onChange={handleChange} placeholder="4MW STG" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdFactory} tone="pink" title="Power to Sugar:">
              <F label="30.85MW STG" name="ExportSug30" value={form.ExportSug30} onChange={handleChange} placeholder="30.85MW STG" />
              <F label="3MW STG (O)" name="ExportSug3Old" value={form.ExportSug3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <F label="3MW STG (N)" name="ExportSug3New" value={form.ExportSug3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <F label="4MW STG" name="ExportSug4" value={form.ExportSug4} onChange={handleChange} placeholder="4MW STG" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdPieChart} tone="teal" title="Power to Sugar (Breakup):" columns="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <F label="Power Consumption Mill" name="PowerConMillHouse" value={form.PowerConMillHouse} onChange={handleChange} placeholder="Power Consumption Mill" />
              <F label="Power Consumption DS" name="PowerConDSHouse" value={form.PowerConDSHouse} onChange={handleChange} placeholder="Power Consumption DS" />
              <F label="Power Consp. Raw & Ref." name="PowerConRaw_Ref" value={form.PowerConRaw_Ref} onChange={handleChange} placeholder="Power Consp. Raw & Ref." />
              <F label="Power Consumption 70TPH" name="PowerCon70TPH" value={form.PowerCon70TPH} onChange={handleChange} placeholder="Power Consumption 70TPH" />
              <F label="Power Consp. ETP" name="PowerConETP" value={form.PowerConETP} onChange={handleChange} placeholder="Power Consp. ETP" />
              <F label="Power Consp. Colony" name="PowerConColony" value={form.PowerConColony} onChange={handleChange} placeholder="Power Consp. Colony" />
              <F label="Sugar CPU" name="PowerConSugarCPU" value={form.PowerConSugarCPU} onChange={handleChange} placeholder="Sugar CPU" />
              <F label="Power Consp. Others" name="PowerConOthers" value={form.PowerConOthers} onChange={handleChange} placeholder="Power Consp. Others" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdSettings} tone="cyan" title="Power to Cogen (Aux Consp):">
              <F label="30.85MW STG" name="ExportCogen30" value={form.ExportCogen30} onChange={handleChange} placeholder="30.85MW STG" />
              <F label="3MW STG (O)" name="ExportCogen3Old" value={form.ExportCogen3Old} onChange={handleChange} placeholder="3MW STG (O)" />
              <F label="3MW STG (N)" name="ExportCogen3New" value={form.ExportCogen3New} onChange={handleChange} placeholder="3MW STG (N)" />
              <F label="4MW STG" name="ExportCogen4" value={form.ExportCogen4} onChange={handleChange} placeholder="4MW STG" />
            </PowerCategoryRow>

            <PowerCategoryRow icon={MdLocalBar} tone="rose" title="Power to Distillery from 30MW:" columns="sm:grid-cols-2 lg:grid-cols-4">
              <F label="30.85MW STG" name="ExportDist30" value={form.ExportDist30} onChange={handleChange} placeholder="30.85MW STG" />
            </PowerCategoryRow>

            <PowerRemarkBlock
              name="remark"
              value={form.remark}
              onChange={handleChange}
              required
              maxLength={500}
              placeholder=""
              showCounter={false}
            />
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

export default PhPower;
