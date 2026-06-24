import { MdBolt, MdChevronLeft } from 'react-icons/md';
import { ENGINEERING_DISCIPLINES } from '../../config/engineeringDisciplines';

function DisciplineCard({ discipline, onOpen, opening }) {
  const isOpening = opening === discipline.id;

  return (
    <button
      type="button"
      onClick={() => onOpen(discipline)}
      disabled={isOpening}
      className="card p-5 text-left w-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-60 disabled:pointer-events-none flex flex-col items-center justify-center min-h-[120px]"
    >
      <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mb-3">
        <MdBolt className="h-5 w-5" />
      </div>
      <h4 className="text-base font-semibold text-gray-900 text-center">
        {isOpening ? 'Opening…' : discipline.name}
      </h4>
    </button>
  );
}

export default function EngineeringDisciplineCards({
  equipmentNode,
  onSelectDiscipline,
  onBack,
  opening = null,
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-gray-900">{equipmentNode.name}</h3>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 shrink-0"
          >
            <MdChevronLeft className="h-4 w-4" />
            Back
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {ENGINEERING_DISCIPLINES.map((discipline) => (
          <DisciplineCard
            key={discipline.id}
            discipline={discipline}
            onOpen={onSelectDiscipline}
            opening={opening}
          />
        ))}
      </div>
    </div>
  );
}
