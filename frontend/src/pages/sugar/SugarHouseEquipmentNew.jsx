import { useLocation } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { MdDomain } from 'react-icons/md';
import AppBreadcrumb from '../../components/AppBreadcrumb';
import AppFormsHeader from '../../components/AppFormsHeader';
import PowerPlantHierarchyExplorer from '../../components/power/PowerPlantHierarchyExplorer';
import { buildSugarHouseEquipmentNewTrail } from '../../utils/breadcrumbTrail';
import { findNodeById, findNodeByPath, pathIdsForNodeId, pathLabels } from '../../utils/hierarchyTreeUtils';
import useSugarHouseHierarchy from '../../hooks/useSugarHouseHierarchy';
import { useAppName } from '../../hooks/useAppName';
import { sugarHouseHierarchyAddAction } from '../../components/power/HierarchyManagePanel';
import { sugarNewDetailPath } from '../../utils/resolveDisciplineSection';

const SugarHouseEquipmentNew = () => {
  const location = useLocation();
  const appId = location.state?.appId;
  const appName = useAppName(appId);
  const { tree, loading, reload, rootId, source } = useSugarHouseHierarchy();

  const [navigation, setNavigation] = useState({
    pathIds: [],
    activeEquipmentId: null,
  });

  useEffect(() => {
    if (!rootId) return;

    const hierarchyPathIds = location.state?.hierarchyPathIds;
    const restoreEquipmentId = location.state?.restoreEquipmentId;
    const hasNavState = Boolean(hierarchyPathIds?.length) || restoreEquipmentId != null;

    if (hasNavState) {
      setNavigation({
        pathIds: hierarchyPathIds?.length ? hierarchyPathIds : [rootId],
        activeEquipmentId: restoreEquipmentId ?? null,
      });
      return;
    }

    setNavigation({
      pathIds: [rootId],
      activeEquipmentId: null,
    });
  }, [location.key, rootId]);

  useEffect(() => {
    if (!tree || !rootId) return;
    setNavigation((prev) => {
      if (prev.pathIds?.length) return prev;

      const hierarchyPathIds = location.state?.hierarchyPathIds;
      const restoreEquipmentId = location.state?.restoreEquipmentId;
      const hasNavState = Boolean(hierarchyPathIds?.length) || restoreEquipmentId != null;

      if (hasNavState) {
        return {
          pathIds: hierarchyPathIds?.length ? hierarchyPathIds : [rootId],
          activeEquipmentId: restoreEquipmentId ?? null,
        };
      }

      return { pathIds: [rootId], activeEquipmentId: null };
    });
  }, [tree, rootId]);

  useEffect(() => {
    if (!tree) return;
    setNavigation((prev) => {
      if (!prev.pathIds?.length) return prev;

      const nodeAtPath = findNodeByPath(tree, prev.pathIds);
      const lastId = prev.pathIds[prev.pathIds.length - 1];
      const safePathIds =
        nodeAtPath && String(nodeAtPath.id) === String(lastId)
          ? prev.pathIds
          : [rootId];

      let activeEquipmentId = prev.activeEquipmentId;
      if (activeEquipmentId && !findNodeById(tree, activeEquipmentId)) {
        activeEquipmentId = null;
      }

      const samePath =
        safePathIds.length === prev.pathIds.length
        && safePathIds.every((id, i) => String(id) === String(prev.pathIds[i]));
      if (samePath && activeEquipmentId === prev.activeEquipmentId) {
        return prev;
      }

      return { pathIds: safePathIds, activeEquipmentId };
    });
  }, [tree, rootId]);

  const breadcrumbItems = useMemo(() => {
    if (!tree) return buildSugarHouseEquipmentNewTrail({ appId, appName });

    let hierarchyLabels = null;
    let hierarchyPathIds = null;
    let restoreEquipmentId = null;

    if (navigation.activeEquipmentId) {
      hierarchyPathIds = pathIdsForNodeId(tree, navigation.activeEquipmentId);
      hierarchyLabels = pathLabels(tree, hierarchyPathIds);
      restoreEquipmentId = navigation.activeEquipmentId;
    } else if (navigation.pathIds?.length > 1) {
      hierarchyPathIds = navigation.pathIds;
      hierarchyLabels = pathLabels(tree, navigation.pathIds);
    }

    return buildSugarHouseEquipmentNewTrail({
      appId,
      appName,
      hierarchyLabels,
      hierarchyPathIds,
      restoreEquipmentId,
    });
  }, [appId, appName, navigation, tree]);

  return (
    <main className="app-main">
      <AppBreadcrumb items={breadcrumbItems} />

      <AppFormsHeader
        name={appName || 'Sugar House Equipment History'}
        description="Browse sugar plant equipment by section, location, main and sub equipment"
        icon={MdDomain}
        color="#8B5CF6"
        className="mb-6"
      />

      <PowerPlantHierarchyExplorer
        tree={tree}
        treeLoading={loading}
        onReloadTree={reload}
        hierarchySource={source}
        appId={appId}
        returnTo="/sugar-house-equipment-new"
        apiBase="/sugar-new"
        equipIdField="shnEquipId"
        detailPathFn={sugarNewDetailPath}
        getAddAction={sugarHouseHierarchyAddAction}
        pathIds={navigation.pathIds?.length ? navigation.pathIds : (tree ? [rootId] : [])}
        activeEquipmentId={navigation.activeEquipmentId}
        onNavigationChange={setNavigation}
      />
    </main>
  );
};

export default SugarHouseEquipmentNew;
