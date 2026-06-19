const { createPowerEquipmentController } = require('./powerEquipmentControllerFactory');

module.exports = createPowerEquipmentController({
  equipment: 'pp_equipment',
  specs: 'pp_specs',
  schedule: 'pp_oem_schedule',
  history: 'pp_history',
  defaultDept: 'electrical',
  logPrefix: 'power',
});
