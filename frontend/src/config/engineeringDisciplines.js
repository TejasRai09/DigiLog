/** Engineering disciplines shown under each equipment in Power Plant Equipment History (new). */

export const ENGINEERING_DISCIPLINES = [
  {
    id: 'mechanical',
    name: 'Mechanical',
    tag: 'ROTARY',
    description:
      'Impellers, sleeve bearings, casing thickness, alignment indexes, vibration thresholds.',
  },
  {
    id: 'civil',
    name: 'Civil',
    tag: 'STRUCTURAL',
    description:
      'Concrete grade, anchor bolt torque parameters, spring dampener indices, leveling surveys.',
  },
  {
    id: 'electrical',
    name: 'Electrical',
    tag: 'POWER DRIVE',
    description:
      '6.6kV stator parameters, megger values, terminal sealing, current limiters.',
  },
  {
    id: 'instrument',
    name: 'Instrument',
    tag: 'AUTOMATION',
    description:
      'Vibration proximity probes, draft transmitters, PT100 RTD feedback, calibration certificates.',
  },
];

export function findDiscipline(id) {
  return ENGINEERING_DISCIPLINES.find((d) => d.id === id) ?? null;
}

export function disciplineNodesForEquipment(equipmentNode) {
  if (!equipmentNode?.id) return [];
  return ENGINEERING_DISCIPLINES.map((d) => ({
    id: `${equipmentNode.id}--disc-${d.id}`,
    name: d.name,
    isDiscipline: true,
    disciplineId: d.id,
    equipmentNode,
  }));
}

export function isEquipmentLeaf(node) {
  return Boolean(node?.isLeaf && !node?.isDiscipline);
}

export function parseDisciplineNodeId(nodeId) {
  const match = String(nodeId || '').match(/^(.+)--disc-(mechanical|civil|electrical|instrument)$/);
  if (!match) return null;
  return { equipmentNodeId: match[1], disciplineId: match[2] };
}
