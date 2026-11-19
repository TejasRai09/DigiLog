import { calcPurity } from '../utils/labPurity';

/** Read-only purity. Not submitted; MySQL stores it from Pol and Brix. */
const PurityReadout = ({ pol, brix }) => (
  <div>
    <input
      type="text"
      readOnly
      tabIndex={-1}
      value={calcPurity(pol, brix)}
      placeholder="Purity"
      aria-label="Purity"
      aria-readonly="true"
      className="input bg-gray-50 text-gray-800 cursor-default"
    />
  </div>
);

export default PurityReadout;
