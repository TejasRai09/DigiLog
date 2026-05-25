import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import AppBreadcrumb from './AppBreadcrumb';
import { useFormMeta } from '../hooks/useFormMeta';
import { useAppName } from '../hooks/useAppName';
import { buildFormPageTrail } from '../utils/breadcrumbTrail';

/**
 * Breadcrumb for `/forms/:formKey` pages and BI dashboard form routes.
 */
const FormPageBreadcrumb = ({
  formKey,
  fallbackTitle = '',
  subformLabel,
  className = 'mb-6',
}) => {
  const location = useLocation();
  const state = location.state ?? {};
  const appId = state.appId;
  const returnTo = state.returnTo;
  const hubPath = state.hubPath;
  const hubLabel = state.hubLabel;
  const parentLabel = state.parentLabel;
  const appName = useAppName(appId);
  const { name, loading } = useFormMeta(formKey, { fallbackTitle });

  const items = useMemo(
    () =>
      buildFormPageTrail({
        formKey,
        formTitle: (loading && !name ? fallbackTitle : name) || fallbackTitle || 'Form',
        appId,
        appName,
        subformLabel,
        locationState: { returnTo, hubPath, hubLabel, parentLabel },
      }),
    [
      formKey,
      name,
      loading,
      fallbackTitle,
      appId,
      appName,
      subformLabel,
      returnTo,
      hubPath,
      hubLabel,
      parentLabel,
    ],
  );

  return <AppBreadcrumb items={items} className={className} />;
};

export default FormPageBreadcrumb;
