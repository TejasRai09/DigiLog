import { useMemo, useState } from 'react';
import { MdSave } from 'react-icons/md';
import FormPageHeader from '../../../components/FormPageHeader';
import AutoNowInput from '../../../components/AutoNowInput';
import FormReviewModal from '../../../components/FormReviewModal';
import FormFileUploadRow from '../../../components/FormFileUploadRow';
import FormPhotoUploadRow from '../../../components/FormPhotoUploadRow';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import { buildEhsNearMissReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';

const SEVERITY_OPTIONS  = ['', 'Fatal', 'Serious Harm', 'Minor Harm', 'No Harm / Near Miss'];
const TREATMENT_OPTIONS = ['', 'Nil', 'First Aid', 'Doctor', 'Hospital'];
const PERSON_TYPES      = ['', 'Employee', 'Contractor', 'Labour', 'Other'];
const HAZARD_OPTIONS    = ['', 'Yes', 'No'];
const INCIDENT_TYPES = [
  'Unsafe Act',
  'Unsafe Condition',
  'Near Miss',
  'Non-Reportable Act',
  'Reportable Act',
];
const MAX_DOCS = 3;
const MAX_PHOTOS = 3;

const emptySlots = (n) => Array.from({ length: n }, () => '');

const INITIAL = {
  date: '', time: '',
  incident_category: '',
  name: '', contact_no: '', department: '', person_type: '', person_type_other: '',
  location: '',
  severity: '', treatment: '', treatment_given: '', treatment_by: '',
  description: '',
  hazard_identified: '',
  hod_signoff_file: '',
  hod_signoff_file_name: '',
  document_files: emptySlots(MAX_DOCS),
  document_names: emptySlots(MAX_DOCS),
  incident_photos: emptySlots(MAX_PHOTOS),
  incident_photo_names: emptySlots(MAX_PHOTOS),
};

function packDocuments(files, names) {
  const rows = [];
  for (let i = 0; i < MAX_DOCS; i += 1) {
    if (files[i]) rows.push({ file: files[i], name: names[i] || `document_${i + 1}` });
  }
  return rows;
}

function packPhotos(photos, names) {
  const rows = [];
  for (let i = 0; i < MAX_PHOTOS; i += 1) {
    if (photos[i]) rows.push({ file: photos[i], name: names[i] || `Image ${i + 1}` });
  }
  return rows;
}

const EhsNearMiss = () => {
  const [form, setForm] = useState(INITIAL);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const setDocument = (index, { dataUrl, fileName }) => {
    setForm((p) => {
      const files = [...p.document_files];
      const names = [...p.document_names];
      files[index] = dataUrl || '';
      names[index] = fileName || '';
      const first = files.findIndex((f) => f);
      return {
        ...p,
        document_files: files,
        document_names: names,
        hod_signoff_file: first >= 0 ? files[first] : '',
        hod_signoff_file_name: first >= 0 ? names[first] : '',
      };
    });
  };

  const setPhoto = (index, dataUrl, fileName) => {
    setForm((p) => {
      const photos = [...p.incident_photos];
      const names = [...p.incident_photo_names];
      photos[index] = dataUrl || '';
      names[index] = dataUrl ? (fileName || names[index] || '') : '';
      return { ...p, incident_photos: photos, incident_photo_names: names };
    });
  };

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date) { toast.error('Date is required.'); return false; }
      if (!form.incident_category) { toast.error('Select an incident type.'); return false; }
      if (!form.name) { toast.error('Person name is required.'); return false; }
      if (!form.severity) { toast.error('Severity is required.'); return false; }
      return true;
    },
    submit: async () => {
      const documents = packDocuments(form.document_files, form.document_names);
      const photos = packPhotos(form.incident_photos, form.incident_photo_names);
      const payload = {
        ...form,
        documents: documents.length ? JSON.stringify(documents) : null,
        incident_photos: photos.length ? JSON.stringify(photos) : null,
      };
      delete payload.document_files;
      delete payload.document_names;
      delete payload.incident_photo_names;
      await gsmaSubmitRequest(
        () => api.post('/forms/ehs_near_miss', payload),
        'Report submitted!',
      );
      setForm({
        ...INITIAL,
        document_files: emptySlots(MAX_DOCS),
        document_names: emptySlots(MAX_DOCS),
        incident_photos: emptySlots(MAX_PHOTOS),
        incident_photo_names: emptySlots(MAX_PHOTOS),
      });
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildEhsNearMissReview(form) : null),
    [reviewOpen, form],
  );

  const S = (name, label, required = false) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type="text" name={name} value={form[name]} onChange={handle} className="input" />
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <FormPageHeader
        formKey="ehs_near_miss"
        fallbackTitle="Accident Report / Near Miss Report"
        fallbackDescription="Log workplace accidents and near misses for investigation"
      />

      <form onSubmit={openReview} className="space-y-6">

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Report Date &amp; Time</h2>
          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">Date<span className="text-red-500 ml-0.5">*</span></label>
              <AutoNowInput type="date" name="date" value={form.date} onChange={handle} required className="input" />
            </div>
            <div>
              <label className="label">Time</label>
              <AutoNowInput type="time" name="time" value={form.time} onChange={handle} className="input" />
            </div>
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Incident Type<span className="text-red-500 ml-0.5">*</span>
          </h2>
          <div className="flex flex-col gap-2.5">
            {INCIDENT_TYPES.map((opt) => (
              <label key={opt} className="flex items-center gap-2.5 text-sm text-gray-800">
                <input
                  type="radio"
                  name="incident_category"
                  value={opt}
                  checked={form.incident_category === opt}
                  onChange={handle}
                  className="h-4 w-4 accent-emerald-600"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Person(s) Involved</h2>
          {S('name', 'Name', true)}
          <div className="form-row flex-wrap gap-4">
            {S('contact_no', 'Contact No.')}
            {S('department', 'Department / Section')}
          </div>
          <div>
            <label className="label">Person Type</label>
            <select name="person_type" value={form.person_type} onChange={handle} className="input">
              {PERSON_TYPES.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </div>
          {form.person_type === 'Other' && S('person_type_other', 'Specify Other')}
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Incident Details</h2>
          {S('location', 'Location')}
          <div>
            <label className="label">Severity<span className="text-red-500 ml-0.5">*</span></label>
            <select name="severity" value={form.severity} onChange={handle} required className="input">
              {SEVERITY_OPTIONS.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Description / Cause of Incident</label>
            <textarea name="description" value={form.description} onChange={handle} rows={4} className="input resize-none" />
          </div>
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Treatment</h2>
          <div>
            <label className="label">Treatment Given</label>
            <select name="treatment" value={form.treatment} onChange={handle} className="input">
              {TREATMENT_OPTIONS.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </div>
          <div>
            <label className="label">What Treatment was Given?</label>
            <textarea name="treatment_given" value={form.treatment_given} onChange={handle} rows={2} className="input resize-none" />
          </div>
          {S('treatment_by', 'By Whom')}
        </div>

        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Follow-up</h2>
          <div>
            <label className="label">Significant Hazard Identified?</label>
            <select name="hazard_identified" value={form.hazard_identified} onChange={handle} className="input">
              {HAZARD_OPTIONS.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </div>
        </div>

        <div className="form-section">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Document Upload</h2>
          <p className="mb-2 text-xs text-gray-500">Up to 3 documents (JPG, JPEG, PDF, or Word). Max 6 MB each.</p>
          {form.document_files.map((value, i) => (
            <FormFileUploadRow
              key={`doc-${i}`}
              label={`Document ${i + 1}`}
              hint={i === 0 ? 'Include the signed HOD document here if applicable.' : undefined}
              value={value}
              fileName={form.document_names[i]}
              onChange={(payload) => setDocument(i, payload)}
              optional
            />
          ))}
        </div>

        <div className="form-section">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">Incident Photos</h2>
          <p className="mb-2 text-xs text-gray-500">Up to 3 images (PNG or JPG).</p>
          {form.incident_photos.map((value, i) => (
            <FormPhotoUploadRow
              key={`photo-${i}`}
              label={`Photo ${i + 1}`}
              value={value}
              onChange={(dataUrl, fileName) => setPhoto(i, dataUrl, fileName)}
              optional
            />
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setForm({
              ...INITIAL,
              document_files: emptySlots(MAX_DOCS),
              document_names: emptySlots(MAX_DOCS),
              incident_photos: emptySlots(MAX_PHOTOS),
              incident_photo_names: emptySlots(MAX_PHOTOS),
            })}
            className="btn-secondary"
          >
            Reset
          </button>
          <button type="submit" disabled={submitting} className="btn-primary px-8">
            {submitting ? <Spinner size="sm" /> : <MdSave className="h-4 w-4" />}
            {submitting ? 'Submitting…' : 'Submit'}
          </button>
        </div>
      </form>

      {reviewConfig ? (
        <FormReviewModal
          open={reviewOpen}
          onClose={closeReview}
          onConfirm={confirmSubmit}
          confirming={submitting}
          {...reviewConfig}
        />
      ) : null}
    </main>
  );
};

export default EhsNearMiss;
