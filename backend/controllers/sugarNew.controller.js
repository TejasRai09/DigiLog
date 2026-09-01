const { createPowerEquipmentController } = require('./powerEquipmentControllerFactory');

module.exports = createPowerEquipmentController({
  equipment: 'shn_equipment',
  specs: 'shn_specs',
  schedule: 'shn_oem_schedule',
  history: 'shn_history',
  defaultDept: 'sugar_house',
  logPrefix: 'sugarNew',
  historySubGroupScoped: true,
  scheduleEquipmentScoped: true,
});
