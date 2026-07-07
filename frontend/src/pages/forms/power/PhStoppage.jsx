import { useMemo, useState } from 'react';
import {
  MdAccountTree,
  MdAssignment,
  MdGridView,
  MdLabel,
  MdSettings,
} from 'react-icons/md';
import FormReviewModal from '../../../components/FormReviewModal';
import { PowerFormPage } from '../../../components/power/PowerLogbookFormUI';
import StoppagePhotoSlots from '../../../components/power/StoppagePhotoSlots';
import {
  SPECIFY_MAX_LENGTH,
  StoppageInput,
  StoppageRemarkArea,
  StoppageSelect,
  StoppageSpecifyArea,
} from '../../../components/power/StoppageFormUI';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import { buildPhStoppageReview } from '../../../config/gsmaFormReviewBuilders';
import { useGsmaFormReview } from '../../../hooks/useGsmaFormReview';
import { gsmaSubmitRequest } from '../../../utils/gsmaFormSubmit';
import { serializeHistoryPhotos } from '../../../utils/equipmentHistoryModel';
import {
  PH_STOPPAGE_CATEGORY_OPTIONS,
  PH_STOPPAGE_MACHINERY_OPTIONS,
  PH_STOPPAGE_SECTION_OPTIONS,
  PH_STOPPAGE_SUBSECTION_OPTIONS,
} from './phStoppageOptions';

const REMARK_MIN = 20;
const REMARK_MAX = 150;
const MAX_STOPPAGE_PHOTOS = 2;

const SECTION_OTHERS = 'Others';
const SUBSECTION_OTHERS = 'OTHERS';
const MACHINERY_OTHERS = 'Others';
const CATEGORY_OTHER = 'Other';

const INITIAL = {
  date: '',
  startTime: '',
  endTime: '',
  section: '',
  section_specify: '',
  sub_section: '',
  sub_section_specify: '',
  machinery: '',
  machinery_specify: '',
  category: '',
  category_specify: '',
  remarks: '',
  photos: [],
};

const PhStoppage = () => {
  const [form, setForm] = useState(INITIAL);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === 'section' && value !== SECTION_OTHERS) next.section_specify = '';
      if (name === 'sub_section' && value !== SUBSECTION_OTHERS) next.sub_section_specify = '';
      if (name === 'machinery' && value !== MACHINERY_OTHERS) next.machinery_specify = '';
      if (name === 'category' && value !== CATEGORY_OTHER) next.category_specify = '';
      return next;
    });
  };

  const resetForm = () => setForm(INITIAL);

  const { reviewOpen, submitting, openReview, closeReview, confirmSubmit } = useGsmaFormReview({
    validate: () => {
      if (!form.date || !form.startTime || !form.endTime) {
        toast.error('Report Date, From and To are required.');
        return false;
      }
      if (form.endTime <= form.startTime) {
        toast.error('To must be later than From.');
        return false;
      }
      if (!form.section || !form.sub_section || !form.machinery || !form.category) {
        toast.error('Section, Sub-Section, Machinery and Category are required.');
        return false;
      }
      if (form.section === SECTION_OTHERS && !form.section_specify.trim()) {
        toast.error('Please specify Section is required when Others is selected.');
        return false;
      }
      if (form.section === SECTION_OTHERS && form.section_specify.trim().length > SPECIFY_MAX_LENGTH) {
        toast.error(`Please specify Section must be at most ${SPECIFY_MAX_LENGTH} characters.`);
        return false;
      }
      if (form.sub_section === SUBSECTION_OTHERS && !form.sub_section_specify.trim()) {
        toast.error('Please specify Sub-Section is required when OTHERS is selected.');
        return false;
      }
      if (form.sub_section === SUBSECTION_OTHERS && form.sub_section_specify.trim().length > SPECIFY_MAX_LENGTH) {
        toast.error(`Please specify Sub-Section must be at most ${SPECIFY_MAX_LENGTH} characters.`);
        return false;
      }
      if (form.machinery === MACHINERY_OTHERS && !form.machinery_specify.trim()) {
        toast.error('Please specify Machinery is required when Others is selected.');
        return false;
      }
      if (form.machinery === MACHINERY_OTHERS && form.machinery_specify.trim().length > SPECIFY_MAX_LENGTH) {
        toast.error(`Please specify Machinery must be at most ${SPECIFY_MAX_LENGTH} characters.`);
        return false;
      }
      if (form.category === CATEGORY_OTHER && !form.category_specify.trim()) {
        toast.error('Please specify Category is required when Other is selected.');
        return false;
      }
      if (form.category === CATEGORY_OTHER && form.category_specify.trim().length > SPECIFY_MAX_LENGTH) {
        toast.error(`Please specify Category must be at most ${SPECIFY_MAX_LENGTH} characters.`);
        return false;
      }
      const remarks = form.remarks.trim();
      if (!remarks) {
        toast.error('General remarks is required.');
        return false;
      }
      if (remarks.length < REMARK_MIN) {
        toast.error(`General remarks must be at least ${REMARK_MIN} characters.`);
        return false;
      }
      if (remarks.length > REMARK_MAX) {
        toast.error(`General remarks must be at most ${REMARK_MAX} characters.`);
        return false;
      }
      if (form.photos.length > MAX_STOPPAGE_PHOTOS) {
        toast.error(`Maximum ${MAX_STOPPAGE_PHOTOS} photos allowed.`);
        return false;
      }
      return true;
    },
    submit: async () => {
      const payload = {
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        section: form.section,
        section_specify: form.section === SECTION_OTHERS ? form.section_specify.trim() : null,
        sub_section: form.sub_section,
        sub_section_specify: form.sub_section === SUBSECTION_OTHERS ? form.sub_section_specify.trim() : null,
        machinery: form.machinery,
        machinery_specify: form.machinery === MACHINERY_OTHERS ? form.machinery_specify.trim() : null,
        category: form.category,
        category_specify: form.category === CATEGORY_OTHER ? form.category_specify.trim() : null,
        remarks: form.remarks.trim(),
        stoppage_photos: serializeHistoryPhotos(form.photos),
      };
      await gsmaSubmitRequest(
        () => api.post('/forms/ph_stoppage', payload),
        'Stoppage report submitted!',
      );
      resetForm();
    },
  });

  const reviewConfig = useMemo(
    () => (reviewOpen ? buildPhStoppageReview(form) : null),
    [reviewOpen, form],
  );

  const showSectionSpecify = form.section === SECTION_OTHERS;
  const showSubSectionSpecify = form.sub_section === SUBSECTION_OTHERS;
  const showMachinerySpecify = form.machinery === MACHINERY_OTHERS;
  const showCategorySpecify = form.category === CATEGORY_OTHER;

  return (
    <>
      <PowerFormPage
        formKey="ph_stoppage"
        fallbackTitle="Stoppage Details"
        title="Stoppage Details"
        onClear={resetForm}
        submitting={submitting}
        formId="stoppage-form"
      >
        <form id="stoppage-form" onSubmit={openReview} noValidate className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-start gap-4 border-b border-gray-100 px-6 py-5">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
              <MdAssignment className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Log Power Stoppage</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Provide details about the power stoppage event.
              </p>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
              <StoppageInput
                label="Report Date"
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                required
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <StoppageInput
                  label="From"
                  name="startTime"
                  type="datetime-local"
                  step="60"
                  value={form.startTime}
                  onChange={handleChange}
                  required
                />
                <StoppageInput
                  label="To"
                  name="endTime"
                  type="datetime-local"
                  step="60"
                  value={form.endTime}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-4">
                  <StoppageSelect
                    label="Section"
                    name="section"
                    value={form.section}
                    onChange={handleChange}
                    options={PH_STOPPAGE_SECTION_OPTIONS}
                    required
                    icon={MdGridView}
                    iconClassName="text-blue-500"
                  />
                  {showSectionSpecify ? (
                    <StoppageSpecifyArea
                      label="Please specify Section"
                      name="section_specify"
                      value={form.section_specify}
                      onChange={handleChange}
                      required
                      placeholder="Enter Section"
                    />
                  ) : null}
                </div>
                <div className="space-y-4">
                  <StoppageSelect
                    label="Sub-Section"
                    name="sub_section"
                    value={form.sub_section}
                    onChange={handleChange}
                    options={PH_STOPPAGE_SUBSECTION_OPTIONS}
                    required
                    icon={MdAccountTree}
                    iconClassName="text-emerald-500"
                  />
                  {showSubSectionSpecify ? (
                    <StoppageSpecifyArea
                      label="Please specify Sub-Section"
                      name="sub_section_specify"
                      value={form.sub_section_specify}
                      onChange={handleChange}
                      required
                      placeholder="Enter Sub-Section"
                    />
                  ) : null}
                </div>
                <div className="space-y-4">
                  <StoppageSelect
                    label="Machinery"
                    name="machinery"
                    value={form.machinery}
                    onChange={handleChange}
                    options={PH_STOPPAGE_MACHINERY_OPTIONS}
                    required
                    icon={MdSettings}
                    iconClassName="text-violet-500"
                  />
                  {showMachinerySpecify ? (
                    <StoppageSpecifyArea
                      label="Please specify Machinery"
                      name="machinery_specify"
                      value={form.machinery_specify}
                      onChange={handleChange}
                      required
                      placeholder="Enter Machinery"
                    />
                  ) : null}
                </div>
              </div>

              <div className="space-y-4">
                <StoppageSelect
                  label="Category"
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  options={PH_STOPPAGE_CATEGORY_OPTIONS}
                  required
                  icon={MdLabel}
                  iconClassName="text-orange-500"
                />
                {showCategorySpecify ? (
                  <StoppageSpecifyArea
                    label="Please specify Category"
                    name="category_specify"
                    value={form.category_specify}
                    onChange={handleChange}
                    required
                    placeholder="Enter Category"
                  />
                ) : null}
              </div>

              <StoppageRemarkArea
                name="remarks"
                value={form.remarks}
                onChange={handleChange}
                minLength={REMARK_MIN}
                maxLength={REMARK_MAX}
              />

              <div className="border-t border-gray-100 pt-5">
                <h2 className="text-sm font-semibold text-gray-900">
                  Stoppage Photos (Max {MAX_STOPPAGE_PHOTOS})
                </h2>
                <p className="mt-0.5 text-xs text-gray-500">
                  Upload clear photos related to the stoppage.
                </p>
                <div className="mt-4">
                  <StoppagePhotoSlots
                    photos={form.photos}
                    onChange={(photos) => setForm((p) => ({ ...p, photos }))}
                    maxPhotos={MAX_STOPPAGE_PHOTOS}
                  />
                </div>
              </div>
          </div>
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

export default PhStoppage;
