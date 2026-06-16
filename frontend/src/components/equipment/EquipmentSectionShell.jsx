import { MdExpandLess, MdExpandMore } from 'react-icons/md';

export default function EquipmentSectionShell({
  title,
  badge,
  open = true,
  onToggle,
  children,
  className = '',
}) {
  return (
    <section className={`mb-3 bg-white border border-slate-200/90 rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-1.5 h-6 bg-slate-800 rounded-full shrink-0" aria-hidden />
          <h2 className="text-sm md:text-[15px] font-bold text-slate-900 tracking-tight truncate">
            {title}
          </h2>
          {badge != null && (
            <span className="bg-blue-50 text-blue-600 text-[11px] font-bold px-2 py-0.5 rounded-full min-w-[24px] text-center shrink-0">
              {badge}
            </span>
          )}
        </div>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors shrink-0"
            aria-label={open ? 'Collapse section' : 'Expand section'}
          >
            {open ? <MdExpandLess className="w-5 h-5" /> : <MdExpandMore className="w-5 h-5" />}
          </button>
        )}
      </div>
      {open && children}
    </section>
  );
}
