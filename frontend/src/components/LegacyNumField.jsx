/**
 * Number field for logbook forms — supports legacy HTML-style placeholders.
 * `label` optional when the parent section already describes the row.
 */
const LegacyNumField = ({ label, name, value, onChange, placeholder = '' }) => (
  <div>
    {label ? <label className="label">{label}</label> : null}
    <input
      type="number"
      step="0.01"
      name={name}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="input"
      aria-label={label || placeholder || name}
    />
  </div>
);

export default LegacyNumField;
