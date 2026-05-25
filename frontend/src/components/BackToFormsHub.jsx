import FormPageBreadcrumb from './FormPageBreadcrumb';

/**
 * @deprecated Prefer `FormPageHeader` (includes breadcrumb) or `FormPageBreadcrumb` directly.
 */
const BackToFormsHub = ({ formKey, fallbackTitle = '', subformLabel, className = 'mb-6' }) => (
  <FormPageBreadcrumb
    formKey={formKey}
    fallbackTitle={fallbackTitle}
    subformLabel={subformLabel}
    className={className}
  />
);

export default BackToFormsHub;
