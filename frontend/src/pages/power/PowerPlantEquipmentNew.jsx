import { useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { MdFlashOn } from 'react-icons/md';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import AppFormsHeader from '../../components/AppFormsHeader';
import PowerPlantHierarchyExplorer from '../../components/power/PowerPlantHierarchyExplorer';
import { buildPowerPlantEquipmentNewTrail } from '../../utils/breadcrumbTrail';
import {
  POWER_PLANT_EQUIPMENT_TREE,
  pathIdsForNodeId,
  pathLabels,
} from '../../config/powerPlantEquipmentHierarchy';
import { useAppName } from '../../hooks/useAppName';

const PowerPlantEquipmentNew = () => {
  const location = useLocation();
  const appId = location.state?.appId;
  const appName = useAppName(appId);

  const [navigation, setNavigation] = useState(() => ({
    pathIds: location.state?.hierarchyPathIds?.length
      ? location.state.hierarchyPathIds
      : [POWER_PLANT_EQUIPMENT_TREE.id],
    activeEquipmentId: location.state?.restoreEquipmentId ?? null,
  }));

  useEffect(() => {
    setNavigation({
      pathIds: location.state?.hierarchyPathIds?.length
        ? location.state.hierarchyPathIds
        : [POWER_PLANT_EQUIPMENT_TREE.id],
      activeEquipmentId: location.state?.restoreEquipmentId ?? null,
    });
  }, [location.key]);

  const breadcrumbItems = useMemo(() => {
    let hierarchyLabels = null;
    let hierarchyPathIds = null;
    let restoreEquipmentId = null;

    if (navigation.activeEquipmentId) {
      hierarchyPathIds = pathIdsForNodeId(navigation.activeEquipmentId);
      hierarchyLabels = pathLabels(POWER_PLANT_EQUIPMENT_TREE, hierarchyPathIds);
      restoreEquipmentId = navigation.activeEquipmentId;
    } else if (navigation.pathIds?.length > 1) {
      hierarchyPathIds = navigation.pathIds;
      hierarchyLabels = pathLabels(POWER_PLANT_EQUIPMENT_TREE, navigation.pathIds);
    }

    return buildPowerPlantEquipmentNewTrail({
      appId,
      appName,
      hierarchyLabels,
      hierarchyPathIds,
      restoreEquipmentId,
    });
  }, [appId, appName, navigation]);

  return (
    <main className="app-main">
      <AppBreadcrumb items={breadcrumbItems} />

      <AppFormsHeader
        name={appName || 'Power Plant Equipment History (new)'}
        description="Browse boiler, turbine and water treatment equipment by cards or tree"
        icon={MdFlashOn}
        color="#D97706"
        className="mb-6"
      />

      <PowerPlantHierarchyExplorer
        appId={appId}
        returnTo="/power-plant-equipment-new"
        pathIds={navigation.pathIds}
        activeEquipmentId={navigation.activeEquipmentId}
        onNavigationChange={setNavigation}
      />
    </main>
  );
};

export default PowerPlantEquipmentNew;
