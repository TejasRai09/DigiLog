import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdSave } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';

const SEVERITY_OPTIONS  = ['', 'Fatal', 'Serious Harm', 'Minor Harm', 'No Harm / Near Miss'];
const TREATMENT_OPTIONS = ['', 'Nil', 'First Aid', 'Doctor', 'Hospital'];
const PERSON_TYPES      = ['', 'Employee', 'Contractor', 'Labour', 'Other'];
const HAZARD_OPTIONS    = ['', 'Yes', 'No'];

const INITIAL = {
  date: '', time: '',
  name: '', contact_no: '', department: '', person_type: '', person_type_other: '',
  location: '',
  severity: '', treatment: '', treatment_given: '', treatment_by: '',
  description: '',
  hazard_identified: '',
  hod_comments: '', hod_signed: '', hod_position: '', hod_date: '',
};

const EhsNearMiss = () => {
  const navigate    = useNavigate();
  const [form, setForm]         = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.date) { toast.error('Date is required.'); return; }
    if (!form.name) { toast.error('Person name is required.'); return; }
    if (!form.severity) { toast.error('Severity is required.'); return; }
    setSubmitting(true);
    try {
      await api.post('/forms/ehs_near_miss', form);
      toast.success('Report submitted!');
      setForm(INITIAL);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const S = (name, label, required = false) => (
    <div>
      <label className="label">{label}{required && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type="text" name={name} value={form[name]} onChange={handle} className="input" />
    </div>
  );

  return (
    <main className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6 transition-colors">
        <MdArrowBack className="h-4 w-4" /> Back
      </button>
      <h1 className="page-title mb-6">Near Miss / Incident / Accident Report</h1>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* Section 1 – Date & Time */}
        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Report Date &amp; Time</h2>
          <div className="form-row flex-wrap gap-4">
            <div>
              <label className="label">Date<span className="text-red-500 ml-0.5">*</span></label>
              <input type="date" name="date" value={form.date} onChange={handle} required className="input" />
            </div>
            <div>
              <label className="label">Time</label>
              <input type="time" name="time" value={form.time} onChange={handle} className="input" />
            </div>
          </div>
        </div>

        {/* Section 2 – Person Involved */}
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

        {/* Section 3 – Incident Details */}
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

        {/* Section 4 – Treatment */}
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

        {/* Section 5 – Follow-up */}
        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Follow-up</h2>
          <div>
            <label className="label">Significant Hazard Identified?</label>
            <select name="hazard_identified" value={form.hazard_identified} onChange={handle} className="input">
              {HAZARD_OPTIONS.map((o) => <option key={o} value={o}>{o || '— Select —'}</option>)}
            </select>
          </div>
        </div>

        {/* Section 6 – HOD Sign-off */}
        <div className="form-section space-y-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">HOD Sign-off</h2>
          <div>
            <label className="label">HOD Comments</label>
            <textarea name="hod_comments" value={form.hod_comments} onChange={handle} rows={3} className="input resize-none" />
          </div>
          <div className="form-row flex-wrap gap-4">
            {S('hod_signed', 'Signed')}
            {S('hod_position', 'Position')}
          </div>
          <div>
            <label className="label">HOD Date</label>
            <input type="date" name="hod_date" value={form.hod_date} onChange={handle} className="input" />
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

export default EhsNearMiss;
