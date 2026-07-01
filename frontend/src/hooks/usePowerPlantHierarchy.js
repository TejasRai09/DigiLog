import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import { POWER_PLANT_EQUIPMENT_TREE } from '../config/powerPlantEquipmentHierarchy';

export function usePowerPlantHierarchy() {
  const [tree, setTree] = useState(POWER_PLANT_EQUIPMENT_TREE);
  const [source, setSource] = useState('static');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async (options = {}) => {
    const silent = Boolean(options.silent);
    if (!silent) setLoading(true);
    setError(null);
    try {
      const { data } = await api.get('/power-new/hierarchy');
      if (data.tree) {
        setTree(data.tree);
        setSource(data.source || 'database');
      } else {
        setTree(POWER_PLANT_EQUIPMENT_TREE);
        setSource('static');
      }
    } catch (err) {
      setTree(POWER_PLANT_EQUIPMENT_TREE);
      setSource('static');
      setError(err.response?.data?.message || 'Could not load hierarchy.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return {
    tree,
    source,
    loading,
    error,
    reload,
    rootId: tree?.id ?? POWER_PLANT_EQUIPMENT_TREE.id,
  };
}

export default usePowerPlantHierarchy;
