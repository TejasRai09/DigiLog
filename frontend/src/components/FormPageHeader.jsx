import { useFormMeta } from '../hooks/useFormMeta';
import FormPageBreadcrumb from './FormPageBreadcrumb';
import AppPageHeader from './AppPageHeader';

/**
 * Form page title from catalog (GET /api/forms/:formKey) with optional fallback.
 */
const FormPageHeader = ({
  formKey,
  fallbackTitle = '',
  fallbackDescription = '',
  showDescription = false,
  subformLabel,
  showBreadcrumb = true,
  showTitle = false,
  breadcrumbClassName = 'mb-6',
  className = 'mb-6',
}) => {
  const { name, description, loading } = useFormMeta(formKey, {
    fallbackTitle,
    fallbackDescription,
  });

  const title = name || fallbackTitle || 'Form';
  const desc = description || fallbackDescription;
  const showTitleBlock = showTitle || (showDescription && desc);

  return (
    <>
      {showBreadcrumb && formKey && (
        <FormPageBreadcrumb
          formKey={formKey}
          fallbackTitle={fallbackTitle || title}
          subformLabel={subformLabel}
          className={showTitleBlock ? breadcrumbClassName : className}
        />
      )}
      {showTitleBlock && (
        <AppPageHeader className={className}>
          {showTitle && (
            <h1 className="page-title">{loading && !name ? fallbackTitle || '…' : title}</h1>
          )}
          {showDescription && desc && (
            <p className={`max-w-2xl text-sm font-medium text-slate-700 ${showTitle ? 'mt-1' : ''}`}>
              {desc}
            </p>
          )}
        </AppPageHeader>
      )}
    </>
  );
};

export default FormPageHeader;
