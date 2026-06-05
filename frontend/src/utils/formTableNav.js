import { isHubFormKey, hubFormPath, hubNavState } from '../config/hubFormRoutes';
import { isBiDashboardFormKey, biDashboardPath } from '../config/biDashboardRoutes';
import { isPowerDeptFormKey, powerDeptPath } from '../config/powerDeptRoutes';
import { ehsHubForFormKey } from '../config/breadcrumbHubs';

export function isSimpleOpenForm(form) {
  return (
    isHubFormKey(form.formKey) ||
    isBiDashboardFormKey(form.formKey) ||
    isPowerDeptFormKey(form.formKey)
  );
}

export function openFormTarget(navigate, form, { appId = null, returnTo = null } = {}) {
  const baseState = {};
  if (appId != null && appId !== '') baseState.appId = String(appId);
  if (returnTo) baseState.returnTo = returnTo;
  else if (appId != null && appId !== '') baseState.returnTo = `/apps/${appId}`;

  if (isPowerDeptFormKey(form.formKey)) {
    const path = powerDeptPath(form.formKey);
    if (path) {
      const navState = { ...baseState, returnTo: returnTo || '/power' };
      navigate(path, { state: Object.keys(navState).length ? navState : undefined });
    }
    return;
  }
  if (isBiDashboardFormKey(form.formKey)) {
    const path = biDashboardPath(form.formKey);
    if (path) {
      navigate(path, { state: Object.keys(baseState).length ? baseState : undefined });
    }
    return;
  }
  if (isHubFormKey(form.formKey)) {
    const path = hubFormPath(form.formKey);
    const hubState = hubNavState(form.formKey, { appId, returnTo });
    navigate(path, { state: { ...baseState, ...hubState } });
    return;
  }
  const ehsHub = ehsHubForFormKey(form.formKey);
  const navState = { ...baseState };
  if (ehsHub) {
    navState.hubPath = ehsHub.path;
    navState.hubLabel = ehsHub.label;
    if (!navState.returnTo) navState.returnTo = ehsHub.path;
  }
  navigate(`/forms/${form.formKey}`, {
    state: Object.keys(navState).length ? navState : undefined,
  });
}

export function openFormButtonLabel(form) {
  if (isSimpleOpenForm(form)) return 'Open';
  return 'Open Digital Form';
}
