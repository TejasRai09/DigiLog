/** Generated purity columns. Must not be written on INSERT/UPDATE. */

const DS_PAIR_KEYS = [
  'PJ', 'MJ', 'LMJ', 'CJ', 'FJ', 'USul_Syrp', 'Sul_Syrp',
  'A_Mc', 'B_Mc', 'A1_Mc', 'C_Mc',
  'AH_Mol', 'AL_Mol', 'BH_Mol', 'CL_Mol', 'FMol', 'A1_Mol',
];

const RS_PAIR_KEYS = [
  'CJ', 'FJ', 'UtrSyrp', 'RawMc', 'R1Mc', 'R2Mc', 'BMc', 'CMc',
  'AH_Mol', 'AL_Mol', 'R1_Mol', 'R2_Mol', 'BH_Mol', 'CL_Mol', 'FMol',
  'RawMlt', 'ClearMlt',
];

const LAB_PURITY_COLUMNS = {
  ds_logbook: new Set(DS_PAIR_KEYS.map((key) => `${key}_Purity`)),
  rs_logbook: new Set([...RS_PAIR_KEYS.map((key) => `${key}_Purity`), 'Purity_FineLiqourMelt']),
};

function stripLabPurityColumns(formKey, payload) {
  const keys = LAB_PURITY_COLUMNS[formKey];
  if (!keys || !payload) return;
  for (const key of keys) delete payload[key];
}

module.exports = { LAB_PURITY_COLUMNS, stripLabPurityColumns };
