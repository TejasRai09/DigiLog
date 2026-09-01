import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import FormReviewModal from '../../../components/FormReviewModal';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';
import BackToFormsHub from '../../../components/BackToFormsHub';

const INITIAL = {
  Date: '',
  Name: '',
  DeliveryPoint: '',
  VillageOrCenterCode: '',
  GrowerCode: '',
  TruckNumber: '',
  VehicleType: '',
  VarietyOfCane: '',
  CropType: '',
  MiddleBrix: '',
  DiseasedCane: '',
  StaleCane: '',
  ConsignmentConditions: ''
};

const VARIETIES = ['CO0238', 'COUK94184', 'CO0118', 'COPK5151', 'COS8272', 'Others'];
const VEHICLES = ['Cart', 'Trolley', 'Truck'];
const CROP_TYPES = ['Plant', 'Ratoon'];
const YES_NO = ['Yes', 'No'];
const CONDITIONS = ['Roots', 'Dry Leaves', 'Muddy', 'Clean'];

const BrixYardSampling = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState(INITIAL);

  const handleInput = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleRadio = (name, value) => setForm((p) => ({ ...p, [name]: value }));

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.Date) { toast.error('Sampling Date is required.'); return false; }
      if (!form.Name) { toast.error('Name is required.'); return false; }
      if (!form.DeliveryPoint) { toast.error('Delivery Point is required.'); return false; }
      if (!form.VillageOrCenterCode) { toast.error('Village/Center Code is required.'); return false; }
      if (!form.VehicleType) { toast.error('Vehicle Type is required.'); return false; }
      if (!form.VarietyOfCane) { toast.error('Variety of Cane is required.'); return false; }
      if (!form.CropType) { toast.error('Crop Type is required.'); return false; }
      if (!form.MiddleBrix) { toast.error('Middle Brix % is required.'); return false; }
      if (!form.DiseasedCane) { toast.error('Diseased Cane is required.'); return false; }
      if (!form.StaleCane) { toast.error('Stale Cane is required.'); return false; }
      if (!form.ConsignmentConditions) { toast.error('Consignment Conditions is required.'); return false; }
      return true;
    },
    submit: async () => {
      await gsmaSubmitRequest(
        () => api.post('/forms/brix_yard_sampling', {
          date: form.Date,
          Name: form.Name,
          DeliveryPoint: form.DeliveryPoint,
          VillageOrCenterCode: form.VillageOrCenterCode,
          GrowerCode: form.GrowerCode,
          TruckNumber: form.TruckNumber,
          VehicleType: form.VehicleType,
          VarietyOfCane: form.VarietyOfCane,
          CropType: form.CropType,
          MiddleBrix: parseFloat(form.MiddleBrix) || 0,
          DiseasedCane: form.DiseasedCane,
          StaleCane: form.StaleCane,
          ConsignmentConditions: form.ConsignmentConditions
        }),
        'Yard Brix Sampling Form submitted!'
      );
      setForm(INITIAL);
    }
  });

  // Basic builder for the review modal
  const buildReview = () => [
    { title: 'Record Info', fields: [
        { label: 'Date', value: form.Date },
        { label: 'Name', value: form.Name }
      ]},
    { title: 'Origin Details', fields: [
        { label: 'Delivery Point', value: form.DeliveryPoint },
        { label: 'Village/Center Code', value: form.VillageOrCenterCode },
        { label: 'Grower Code', value: form.GrowerCode || '-' }
      ]},
    { title: 'Transport', fields: [
        { label: 'Vehicle Type', value: form.VehicleType },
        { label: 'Truck Number', value: form.TruckNumber || '-' }
      ]},
    { title: 'Cane Details', fields: [
        { label: 'Variety', value: form.VarietyOfCane },
        { label: 'Crop Type', value: form.CropType }
      ]},
    { title: 'Quality Parameters', fields: [
        { label: 'Middle Brix %', value: form.MiddleBrix },
        { label: 'Diseased Cane', value: form.DiseasedCane },
        { label: 'Stale Cane', value: form.StaleCane },
        { label: 'Consignment Conditions', value: form.ConsignmentConditions }
      ]}
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <BackToFormsHub formKey="brix_yard_sampling" />
      </div>
      
      <h1 className="page-title mb-1">GSMA Yard Brix Sampling Form 23-24</h1>
      <p className="text-xs text-gray-500 mb-6 uppercase tracking-wider">Yard Area Brix measurement and Analysis Form - HOD Lab</p>
      
      <div className="bg-yellow-50 text-yellow-800 text-xs px-4 py-3 rounded-lg border border-yellow-200 mb-6">
        When you submit this form, it will not automatically collect your details like name and email address unless you provide it yourself. Fields marked with <span className="text-red-500">*</span> are required.
      </div>

      <div className="space-y-6">
        {/* Basic Info Section */}
        <div className="form-section">
          <h2 className="section-title">Record Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">1. Sampling Date <span className="text-red-500">*</span></label>
              <input type="date" name="Date" value={form.Date} onChange={handleInput} className="input" />
            </div>
            <div>
              <label className="label">2. Name <span className="text-red-500">*</span></label>
              <input type="text" name="Name" value={form.Name} onChange={handleInput} className="input" placeholder="Enter your answer" />
            </div>
          </div>
        </div>

        {/* Origin Details */}
        <div className="form-section">
          <h2 className="section-title">Origin Details</h2>
          <div className="space-y-4">
            <div>
              <label className="label">3. Select Delivery Point <span className="text-red-500">*</span></label>
              <div className="flex gap-4 mt-2">
                {['Gate', 'Center'].map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="DeliveryPoint" checked={form.DeliveryPoint === opt} onChange={() => handleRadio('DeliveryPoint', opt)} className="text-blue-600 focus:ring-blue-500" />
                    <span>{opt} Cane</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">4. Village/Center Code <span className="text-red-500">*</span></label>
                <input type="number" name="VillageOrCenterCode" value={form.VillageOrCenterCode} onChange={handleInput} className="input" placeholder="Enter code" />
              </div>
              {form.DeliveryPoint === 'Gate' && (
                <div>
                  <label className="label">5. Grower Code</label>
                  <input type="number" name="GrowerCode" value={form.GrowerCode} onChange={handleInput} className="input" placeholder="Enter code" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Transport Details */}
        <div className="form-section">
          <h2 className="section-title">Transport Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">7. Vehicle Type <span className="text-red-500">*</span></label>
              <div className="flex flex-col gap-2 mt-2">
                {VEHICLES.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="VehicleType" checked={form.VehicleType === opt} onChange={() => handleRadio('VehicleType', opt)} className="text-blue-600 focus:ring-blue-500" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.DeliveryPoint === 'Center' && (
              <div>
                <label className="label">6. Truck Number</label>
                <input type="text" name="TruckNumber" value={form.TruckNumber} onChange={handleInput} className="input" placeholder="e.g. UP31AT9184" />
              </div>
            )}
          </div>
        </div>

        {/* Cane & Crop Details */}
        <div className="form-section">
          <h2 className="section-title">Cane Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">8. Variety of Cane <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {VARIETIES.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="VarietyOfCane" checked={form.VarietyOfCane === opt} onChange={() => handleRadio('VarietyOfCane', opt)} className="text-blue-600 focus:ring-blue-500" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="label">9. Crop Type <span className="text-red-500">*</span></label>
              <div className="flex flex-col gap-2 mt-2">
                {CROP_TYPES.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="CropType" checked={form.CropType === opt} onChange={() => handleRadio('CropType', opt)} className="text-blue-600 focus:ring-blue-500" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quality Parameters */}
        <div className="form-section">
          <h2 className="section-title">Quality Parameters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="label">10. Middle Brix % <span className="text-red-500">*</span></label>
              <input type="number" step="0.1" name="MiddleBrix" value={form.MiddleBrix} onChange={handleInput} className="input" placeholder="Enter value" />
            </div>

            <div>
              <label className="label">11. Diseased Cane <span className="text-red-500">*</span></label>
              <div className="flex gap-4 mt-2">
                {YES_NO.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="DiseasedCane" checked={form.DiseasedCane === opt} onChange={() => handleRadio('DiseasedCane', opt)} className="text-blue-600 focus:ring-blue-500" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">12. Stale Cane <span className="text-red-500">*</span></label>
              <div className="flex gap-4 mt-2">
                {YES_NO.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="StaleCane" checked={form.StaleCane === opt} onChange={() => handleRadio('StaleCane', opt)} className="text-blue-600 focus:ring-blue-500" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">13. Consignment Conditions <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {CONDITIONS.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="ConsignmentConditions" checked={form.ConsignmentConditions === opt} onChange={() => handleRadio('ConsignmentConditions', opt)} className="text-blue-600 focus:ring-blue-500" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 pb-12 flex justify-end">
          <button type="button" onClick={openReview} className="btn-primary w-full sm:w-auto">
            Review & Submit <MdSave className="w-5 h-5 ml-1" />
          </button>
        </div>
      </div>

      <FormReviewModal
        open={reviewOpen}
        onClose={closeReview}
        onConfirm={confirmSubmit}
        confirming={submitting}
        title="Review Yard Brix Sampling"
        sections={buildReview()}
      />
    </main>
  );
};

export default BrixYardSampling;
