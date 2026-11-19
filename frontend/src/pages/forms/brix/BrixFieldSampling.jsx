import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import FormReviewModal from '../../../components/FormReviewModal';
import AutoNowInput from '../../../components/AutoNowInput';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';
import BackToFormsHub from '../../../components/BackToFormsHub';
import FormsHubViewOnlyBanner from '../../../components/FormsHubViewOnlyBanner';
import useAuth from '../../../hooks/useAuth';

const INITIAL = {
  Date: '',
  Name: '',
  TestType: '',
  GrowerName: '',
  VillageName: '',
  Variety: '',
  otherVariety: '',
  LandType: '',
  SoilType: '',
  CropType: '',
  FieldCondition: '',
  CropCondition: '',
  SamplingPoint: '',
  BottomBrix: '',
  MiddleBrix: '',
  TopBrix: ''
};

const VARIETIES = ['CO0238', 'COLK94184', 'CO0118', 'COPK5151', 'COS8272', 'COLK14201', 'CO15023', 'Others'];
const TEST_TYPES = ['New', 'Repeat'];
const LAND_TYPES = ['Upland', 'Midland', 'Lowland'];
const SOIL_TYPES = ['Loamy', 'Sandy', 'Clay', 'Silt', 'Others'];
const CROP_TYPES = ['Plant', 'Ratoon'];
const FIELD_CONDITIONS = ['Weed Free', 'Weedy', 'Waterlogged', 'Others'];
const CROP_CONDITIONS = ['Normal', 'Lodged', 'Dry', 'Diseased'];
const SAMPLING_POINTS = ['Border', 'Center'];

const BrixFieldSampling = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [form, setForm] = useState(() => ({ ...INITIAL, Name: user?.name ?? '' }));
  const [samplingTime, setSamplingTime] = useState(() =>
    new Date().toLocaleTimeString('en-GB', { hour12: false }),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setSamplingTime(new Date().toLocaleTimeString('en-GB', { hour12: false }));
    }, 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (user?.name) setForm((p) => ({ ...p, Name: user.name }));
  }, [user?.name]);

  const handleInput = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const handleRadio = (name, value) => setForm((p) => {
    const next = { ...p, [name]: value };
    if (name === 'Variety' && value !== 'Others') next.otherVariety = '';
    return next;
  });
  const varietyToSave = form.Variety === 'Others' ? form.otherVariety.trim() : form.Variety;

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.Date) { toast.error('Sampling Date is required.'); return false; }
      if (!form.Name) { toast.error('Name is required.'); return false; }
      if (!form.TestType) { toast.error('Test Type is required.'); return false; }
      if (!form.GrowerName) { toast.error('Grower Name is required.'); return false; }
      if (!form.VillageName) { toast.error('Village Name is required.'); return false; }
      if (!form.Variety) { toast.error('Variety of Cane is required.'); return false; }
      if (form.Variety === 'Others' && !form.otherVariety.trim()) {
        toast.error('Variety name is required when Others is selected.');
        return false;
      }
      if (!form.LandType) { toast.error('Land Type is required.'); return false; }
      if (!form.SoilType) { toast.error('Soil Type is required.'); return false; }
      if (!form.CropType) { toast.error('Crop Type is required.'); return false; }
      if (!form.FieldCondition) { toast.error('Field Condition is required.'); return false; }
      if (!form.CropCondition) { toast.error('Crop Condition is required.'); return false; }
      if (!form.SamplingPoint) { toast.error('Sampling Point is required.'); return false; }
      if (!form.BottomBrix) { toast.error('Bottom Brix % is required.'); return false; }
      if (!form.MiddleBrix) { toast.error('Middle Brix % is required.'); return false; }
      if (!form.TopBrix) { toast.error('Top Brix % is required.'); return false; }
      return true;
    },
    submit: async () => {
      await gsmaSubmitRequest(
        () => api.post('/forms/brix_field_sampling', {
          date: form.Date,
          Name: form.Name,
          TestType: form.TestType,
          GrowerName: form.GrowerName,
          VillageName: form.VillageName,
          Variety: varietyToSave,
          LandType: form.LandType,
          SoilType: form.SoilType,
          CropType: form.CropType,
          FieldCondition: form.FieldCondition,
          CropCondition: form.CropCondition,
          SamplingPoint: form.SamplingPoint,
          BottomBrix: parseFloat(form.BottomBrix) || 0,
          MiddleBrix: parseFloat(form.MiddleBrix) || 0,
          TopBrix: parseFloat(form.TopBrix) || 0
        }),
        'Field Brix Sampling Form submitted!'
      );
      setForm({ ...INITIAL, Name: user?.name ?? '' });
    }
  });

  const buildReview = () => [
    { title: 'Record Info', fields: [
        { label: 'Date', value: form.Date },
        { label: 'Sampling Time', value: `${samplingTime} (saved on submit)` },
        { label: 'Name', value: form.Name },
        { label: 'Test Type', value: form.TestType }
      ]},
    { title: 'Origin Details', fields: [
        { label: 'Grower Name', value: form.GrowerName },
        { label: 'Village Name', value: form.VillageName }
      ]},
    { title: 'Field Details', fields: [
        { label: 'Variety', value: varietyToSave },
        { label: 'Land Type', value: form.LandType },
        { label: 'Soil Type', value: form.SoilType },
        { label: 'Crop Type', value: form.CropType },
        { label: 'Field Condition', value: form.FieldCondition },
        { label: 'Crop Condition', value: form.CropCondition },
        { label: 'Sampling Point', value: form.SamplingPoint }
      ]},
    { title: 'Quality Parameters', fields: [
        { label: 'Bottom Brix %', value: form.BottomBrix },
        { label: 'Middle Brix %', value: form.MiddleBrix },
        { label: 'Top Brix %', value: form.TopBrix }
      ]}
  ];

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <BackToFormsHub formKey="brix_field_sampling" />
      </div>
      
      <h1 className="page-title mb-1">GSMA Field Brix Sampling Form</h1>
      <p className="text-xs text-gray-500 mb-6 uppercase tracking-wider">Cane Area Brix measurement and Analysis Form</p>
      <FormsHubViewOnlyBanner />
      
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
              <AutoNowInput type="date" name="Date" value={form.Date} onChange={handleInput} className="input" />
            </div>
            <div>
              <label className="label">Sampling Time</label>
              <input type="text" value={samplingTime} readOnly className="input bg-slate-50 text-slate-700" />
              <p className="mt-1 text-xs text-gray-500">Filled automatically when you submit. Another report can be saved on the same date at a different time.</p>
            </div>
            <div>
              <label className="label">2. Name <span className="text-red-500">*</span></label>
              <input type="text" name="Name" value={form.Name} readOnly className="input bg-slate-50 text-slate-700" />
              <p className="mt-1 text-xs text-gray-500">Filled from your account name.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="label">3. Select Test Type <span className="text-red-500">*</span></label>
              <div className="flex gap-4 mt-2">
                {TEST_TYPES.map((opt) => (
                  <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input type="radio" name="TestType" checked={form.TestType === opt} onChange={() => handleRadio('TestType', opt)} className="text-blue-600 focus:ring-blue-500" />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Origin Details */}
        <div className="form-section">
          <h2 className="section-title">Origin Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">4. Grower Name <span className="text-red-500">*</span></label>
              <input type="text" name="GrowerName" value={form.GrowerName} onChange={handleInput} className="input" placeholder="Enter answer" />
            </div>
            <div>
              <label className="label">5. Village Name <span className="text-red-500">*</span></label>
              <input type="text" name="VillageName" value={form.VillageName} onChange={handleInput} className="input" placeholder="Enter answer" />
            </div>
          </div>
        </div>

        {/* Field Details */}
        <div className="form-section">
          <h2 className="section-title">Field & Crop Details</h2>
          
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="label">6. Variety of Cane <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {VARIETIES.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="Variety" checked={form.Variety === opt} onChange={() => handleRadio('Variety', opt)} className="text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
                {form.Variety === 'Others' && (
                  <div className="mt-3">
                    <label className="label">Variety name <span className="text-red-500">*</span></label>
                    <input type="text" name="otherVariety" value={form.otherVariety} onChange={handleInput} maxLength={100} className="input" placeholder="Enter variety name" />
                  </div>
                )}
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

            <hr className="border-gray-100" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="label">7. Land Type <span className="text-red-500">*</span></label>
                <div className="flex flex-col gap-2 mt-2">
                  {LAND_TYPES.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="LandType" checked={form.LandType === opt} onChange={() => handleRadio('LandType', opt)} className="text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">8. Soil Type <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {SOIL_TYPES.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="SoilType" checked={form.SoilType === opt} onChange={() => handleRadio('SoilType', opt)} className="text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            
            <hr className="border-gray-100" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="label">10. Field Condition <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {FIELD_CONDITIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="FieldCondition" checked={form.FieldCondition === opt} onChange={() => handleRadio('FieldCondition', opt)} className="text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="label">11. Crop Condition <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {CROP_CONDITIONS.map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input type="radio" name="CropCondition" checked={form.CropCondition === opt} onChange={() => handleRadio('CropCondition', opt)} className="text-blue-600 focus:ring-blue-500" />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quality Parameters */}
        <div className="form-section">
          <h2 className="section-title">Quality Parameters</h2>
          
          <div className="mb-6">
            <label className="label">12. Sampling Point <span className="text-red-500">*</span></label>
            <div className="flex gap-4 mt-2">
              {SAMPLING_POINTS.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input type="radio" name="SamplingPoint" checked={form.SamplingPoint === opt} onChange={() => handleRadio('SamplingPoint', opt)} className="text-blue-600 focus:ring-blue-500" />
                  <span>{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label">13. Bottom Brix % <span className="text-red-500">*</span></label>
              <input type="number" step="0.1" name="BottomBrix" value={form.BottomBrix} onChange={handleInput} className="input" placeholder="Enter value" />
            </div>
            <div>
              <label className="label">14. Middle Brix % <span className="text-red-500">*</span></label>
              <input type="number" step="0.1" name="MiddleBrix" value={form.MiddleBrix} onChange={handleInput} className="input" placeholder="Enter value" />
            </div>
            <div>
              <label className="label">15. Top Brix % <span className="text-red-500">*</span></label>
              <input type="number" step="0.1" name="TopBrix" value={form.TopBrix} onChange={handleInput} className="input" placeholder="Enter value" />
            </div>
          </div>
        </div>

        <div className="pt-4 pb-12 flex justify-end">
          <button type="button" onClick={openReview} className="btn-primary w-full sm:w-auto forms-hub-write-action">
            Review & Submit <MdSave className="w-5 h-5 ml-1" />
          </button>
        </div>
      </div>

      <FormReviewModal
        open={reviewOpen}
        onClose={closeReview}
        onConfirm={confirmSubmit}
        confirming={submitting}
        title="Review Field Brix Sampling"
        sections={buildReview()}
      />
    </main>
  );
};

export default BrixFieldSampling;
