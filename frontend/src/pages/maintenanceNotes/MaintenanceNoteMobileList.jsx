import CardOverflowMenu from '../../components/CardOverflowMenu';
import { NoteStatusBadge } from './NoteStatusBadge';
import { formatNoteWhen } from './noteStatus';

export default function MaintenanceNoteMobileList({ items, actionItems, extraLine, footer, disabled }) {
  return (
    <ul className="space-y-3 md:hidden">
      {items.map((item) => (
        <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">{item.noteId}</p>
              <p className="mt-0.5 text-sm text-slate-600">{item.plantLabel}</p>
            </div>
            {actionItems ? (
              <CardOverflowMenu title="Actions" disabled={disabled} items={actionItems(item)} />
            ) : null}
          </div>
          <div className="mt-2">
            <NoteStatusBadge status={item.status} />
          </div>
          <p className="mt-3 break-words text-sm font-medium text-slate-800">{item.equipmentName || '—'}</p>
          {item.activityType ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{item.activityType}</p>
          ) : null}
          <p className="mt-0.5 break-words text-sm leading-relaxed text-slate-800">{item.activityDescription}</p>
          {item.activityDetails ? (
            <p className="mt-1 line-clamp-2 break-words text-sm leading-relaxed text-slate-500">{item.activityDetails}</p>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {item.createdByName} · {formatNoteWhen(item.createdAt)}
          </p>
          {extraLine ? extraLine(item) : null}
          {footer ? footer(item) : null}
        </li>
      ))}
    </ul>
  );
}
