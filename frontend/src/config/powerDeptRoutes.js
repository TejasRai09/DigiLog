/** Power plant department rows shown like forms on `/power`. */
export const POWER_DEPT_FORMS = [
  {
    _id: 'electrical',
    formKey: 'power_dept_electrical',
    name: 'Electrical',
    description:
      'Power plant electrical equipment — turbine, generator, boiler, fans, pumps and drives',
  },
  {
    _id: 'instrument',
    formKey: 'power_dept_instrument',
    name: 'Instrument',
    description: 'Motorized actuators, control valves and instrumentation devices',
  },
  {
    _id: 'instrument2',
    formKey: 'power_dept_instrument2',
    name: 'Instrument II',
    description: 'Control valves, safety valves and regulating devices',
  },
];

export function isPowerDeptFormKey(formKey) {
  return formKey != null && String(formKey).startsWith('power_dept_');
}

export function powerDeptFromFormKey(formKey) {
  if (!isPowerDeptFormKey(formKey)) return null;
  return String(formKey).slice('power_dept_'.length);
}

export function powerDeptPath(formKey) {
  const dept = powerDeptFromFormKey(formKey);
  return dept ? `/power/${dept}` : null;
}
