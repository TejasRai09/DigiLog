const { createPowerEquipmentController } = require('./powerEquipmentControllerFactory');

module.exports = createPowerEquipmentController({
  equipment: 'ppn_equipment',
  specs: 'ppn_specs',
  schedule: 'ppn_oem_schedule',
  history: 'ppn_history',
  defaultDept: 'plant',
  logPrefix: 'powerNew',
  historySubGroupScoped: true,
  scheduleEquipmentScoped: true,
});
