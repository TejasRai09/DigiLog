import { BI_DASHBOARD_PATH } from '../config/biDashboardRoutes';
import {
  ehsHubForFormKey,
  hubLabelForPath,
  HUB_MODULE_LABELS,
  parentLabelFromReturnTo,
} from '../config/breadcrumbHubs';

/** Single-hub apps skip the app detail page — use app name only, not app + hub label. */
function hubListCrumb({ appId, appName, fallbackLabel }) {
  if (appId && appName) return { label: appName };
  return { label: fallbackLabel };
}

function hubParentCrumb({ appId, appName, path, fallbackLabel }) {
  const label = appId && appName ? appName : fallbackLabel;
  return { label, to: path };
}

export const DASHBOARD_CRUMB = { label: 'Dashboard', to: '/dashboard' };
export const FORMS_HUB_CRUMB = { label: 'Forms Hub', to: '/forms-hub' };
export const BI_TOWER_CRUMB = { label: 'BI Control Tower', to: '/bi' };

const POWER_DEPT_LABELS = {
  electrical: 'Electrical',
  instrument: 'Instrument',
  instrument2: 'Instrument II',
};

export function powerDeptLabel(dept) {
  return POWER_DEPT_LABELS[dept] ?? dept ?? 'Department';
}

/** Standard form page: Dashboard → Forms Hub → [App] → [Hub] → Form → [Subform] */
export function buildFormPageTrail({
  formKey,
  formTitle,
  appId,
  appName,
  subformLabel,
  locationState = {},
}) {
  const state = locationState ?? {};
  const title = formTitle || 'Form';
  const isBiForm = formKey && Object.prototype.hasOwnProperty.call(BI_DASHBOARD_PATH, formKey);

  if (isBiForm) {
    // BI dashboards open from `/bi`; app id often points at the same “BI Control Tower” app — skip duplicate crumb.
    const items = [DASHBOARD_CRUMB, BI_TOWER_CRUMB];
    items.push({ label: title });
    if (subformLabel) items.push({ label: subformLabel });
    return items;
  }

  const items = [DASHBOARD_CRUMB, FORMS_HUB_CRUMB];

  const hubPath = state.hubPath;
  const hubLabel = state.hubLabel ?? (hubPath ? hubLabelForPath(hubPath) : null);
  const ehsHub = ehsHubForFormKey(formKey);
  const isEhsContext = Boolean(ehsHub) || hubPath === '/ehs';

  if (isEhsContext) {
    items.push({ label: HUB_MODULE_LABELS['/ehs'], to: '/ehs' });
  } else if (appId && appName) {
    items.push({ label: appName, to: `/apps/${appId}` });
  }

  if (!isEhsContext && hubPath && hubLabel) {
    items.push({ label: hubLabel, to: hubPath });
  } else if (!isEhsContext && state.returnTo && state.returnTo !== '/forms-hub' && state.returnTo !== '/dashboard') {
    const parentLabel = state.parentLabel ?? parentLabelFromReturnTo(state.returnTo);
    if (parentLabel) {
      items.push({ label: parentLabel, to: state.returnTo });
    }
  }

  items.push({ label: title });
  if (subformLabel) items.push({ label: subformLabel });
  return items;
}

/** App detail: Dashboard → Forms Hub → App */
export function buildAppDetailTrail(appName) {
  return [
    DASHBOARD_CRUMB,
    FORMS_HUB_CRUMB,
    { label: appName || 'App' },
  ];
}

/** Forms Hub listing */
export function buildFormsHubTrail() {
  return [DASHBOARD_CRUMB, { label: 'Forms Hub' }];
}

/** BI Control Tower listing */
export function buildBiTowerTrail() {
  return [DASHBOARD_CRUMB, { label: 'BI Control Tower' }];
}

/** EHS module hub — always labelled “EHS” (not the full app name). */
export function buildEhsHubTrail() {
  return [DASHBOARD_CRUMB, FORMS_HUB_CRUMB, { label: HUB_MODULE_LABELS['/ehs'] }];
}

/** Production module hub. */
export function buildProductionHubTrail() {
  return [DASHBOARD_CRUMB, FORMS_HUB_CRUMB, { label: HUB_MODULE_LABELS['/production'] }];
}

/** Mill equipment list */
export function buildEquipmentListTrail({ appId, appName } = {}) {
  const items = [DASHBOARD_CRUMB, FORMS_HUB_CRUMB];
  items.push(hubListCrumb({ appId, appName, fallbackLabel: HUB_MODULE_LABELS['/equipment'] }));
  return items;
}

/** Equipment detail */
export function buildEquipmentDetailTrail({ appId, appName, equipmentName } = {}) {
  const items = [DASHBOARD_CRUMB, FORMS_HUB_CRUMB];
  items.push(hubParentCrumb({
    appId,
    appName,
    path: '/equipment',
    fallbackLabel: HUB_MODULE_LABELS['/equipment'],
  }));
  items.push({ label: equipmentName || 'Equipment' });
  return items;
}

/** Power plant hierarchy */
export function buildPowerLandingTrail({ appId, appName } = {}) {
  const items = [DASHBOARD_CRUMB, FORMS_HUB_CRUMB];
  items.push(hubListCrumb({ appId, appName, fallbackLabel: HUB_MODULE_LABELS['/power'] }));
  return items;
}

export function buildPowerDeptTrail({ appId, appName, dept } = {}) {
  const items = [DASHBOARD_CRUMB, FORMS_HUB_CRUMB];
  items.push(hubParentCrumb({
    appId,
    appName,
    path: '/power',
    fallbackLabel: HUB_MODULE_LABELS['/power'],
  }));
  items.push({ label: powerDeptLabel(dept) });
  return items;
}

export function buildPowerEquipmentTrail({ appId, appName, dept, equipmentName } = {}) {
  const items = buildPowerDeptTrail({ appId, appName, dept });
  items[items.length - 1] = { ...items[items.length - 1], to: `/power/${dept}` };
  items.push({ label: equipmentName || 'Equipment' });
  return items;
}

export function buildPowerPlantEquipmentNewTrail({
  appId,
  appName,
  hierarchyLabels = null,
  hierarchyPathIds = null,
  restoreEquipmentId = null,
  disciplineLabel = null,
} = {}) {
  const items = [DASHBOARD_CRUMB, FORMS_HUB_CRUMB];
  const hubPath = '/power-plant-equipment-new';
  const hubStateBase = {
    appId: appId != null && appId !== '' ? String(appId) : undefined,
  };
  const hubLabel = (appId && appName)
    ? appName
    : HUB_MODULE_LABELS['/power-plant-equipment-new'];

  const hasHierarchy = Array.isArray(hierarchyLabels)
    && hierarchyLabels.length > 0
    && Array.isArray(hierarchyPathIds)
    && hierarchyPathIds.length > 0;

  if (!hasHierarchy) {
    items.push({ label: hubLabel });
    if (disciplineLabel) items.push({ label: disciplineLabel });
    return items;
  }

  items.push({
    label: hubLabel,
    to: hubPath,
    state: hubStateBase,
  });

  const skipRoot = hierarchyLabels[0] === 'Power Plant';
  const segmentLabels = skipRoot ? hierarchyLabels.slice(1) : hierarchyLabels;
  const rootOffset = skipRoot ? 1 : 0;

  segmentLabels.forEach((label, i) => {
    const isLastSegment = i === segmentLabels.length - 1;
    const pathSliceEnd = i + 1 + rootOffset;
    const crumbPathIds = hierarchyPathIds.slice(0, pathSliceEnd);
    const equipmentState = restoreEquipmentId
      ? { ...hubStateBase, hierarchyPathIds, restoreEquipmentId }
      : null;

    if (isLastSegment && disciplineLabel) {
      items.push({
        label,
        to: hubPath,
        state: equipmentState,
      });
      return;
    }

    if (isLastSegment) {
      items.push({ label });
      return;
    }

    items.push({
      label,
      to: hubPath,
      state: {
        ...hubStateBase,
        hierarchyPathIds: crumbPathIds,
      },
    });
  });

  if (disciplineLabel) {
    items.push({
      label: disciplineLabel,
      to: hubPath,
      linkWhenLast: true,
      state: equipmentStateForDiscipline(hubStateBase, hierarchyPathIds, restoreEquipmentId),
    });
  }

  return items;
}

function equipmentStateForDiscipline(hubStateBase, hierarchyPathIds, restoreEquipmentId) {
  return {
    ...hubStateBase,
    hierarchyPathIds,
    restoreEquipmentId,
  };
}
