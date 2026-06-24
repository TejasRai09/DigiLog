import { useLocation } from 'react-router-dom';
import { MdFlashOn } from 'react-icons/md';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import AppFormsHeader from '../../components/AppFormsHeader';
import PowerPlantHierarchyExplorer from '../../components/power/PowerPlantHierarchyExplorer';
import { buildPowerPlantEquipmentNewTrail } from '../../utils/breadcrumbTrail';
import { useAppName } from '../../hooks/useAppName';

const PowerPlantEquipmentNew = () => {
  const location = useLocation();
  const appId = location.state?.appId;
  const appName = useAppName(appId);

  return (
    <main className="app-main">
      <AppBreadcrumb items={buildPowerPlantEquipmentNewTrail({ appId, appName })} />

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
        initialPathIds={location.state?.hierarchyPathIds}
        restoreEquipmentId={location.state?.restoreEquipmentId}
      />
    </main>
  );
};

export default PowerPlantEquipmentNew;
