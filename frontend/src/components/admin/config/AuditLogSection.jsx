import { Fragment, useCallback, useEffect, useState } from 'react';
import { MdExpandLess, MdExpandMore, MdRefresh } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

const TABS = [
  { id: 'changes', label: 'Change Log' },
  { id: 'activity', label: 'Activity Log' },
  { id: 'sessions', label: 'Session Log' },
];

const ACTIONS = ['', 'Create', 'Update', 'Delete'];
const RESULT_FILTERS = [
  { value: '', label: 'All results' },
  { value: '1', label: 'Success' },
  { value: '0', label: 'Failed' },
];
const ACTIVE_FILTERS = [
  { value: '', label: 'All sessions' },
  { value: '1', label: 'Online now' },
  { value: '0', label: 'Ended' },
];

function formatTime(value) {
  if (!value) return '—';
  const d = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(minutes) {
  if (minutes == null || minutes === '') return '—';
  const m = Number(minutes);
  if (!Number.isFinite(m)) return '—';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

function formatDwell(seconds) {
  if (seconds == null || seconds === '') return '—';
  const s = Number(seconds);
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function statusClass(code) {
  if (code == null) return 'text-gray-500';
  if (code >= 200 && code < 300) return 'text-emerald-700';
  if (code >= 400) return 'text-red-600';
  return 'text-amber-700';
}

function actionClass(action) {
  switch (action) {
    case 'Create': return 'bg-emerald-50 text-emerald-800';
    case 'Update': return 'bg-sky-50 text-sky-800';
    case 'Delete': return 'bg-red-50 text-red-800';
    default: return 'bg-gray-50 text-gray-700';
  }
}

function ReadableBody({ body }) {
  if (!body) {
    return <p className="text-sm text-gray-500">(no details)</p>;
  }

  const fields = Array.isArray(body.fields) ? body.fields : [];
  const notes = Array.isArray(body.notes) ? body.notes : [];

  const groups = [];
  const groupMap = new Map();
  for (const f of fields) {
    const g = f.group || 'Details';
    if (!groupMap.has(g)) {
      groupMap.set(g, []);
      groups.push(g);
    }
    groupMap.get(g).push(f);
  }

  return (
    <div className="space-y-4">
      {body.what_changed ? (
        <p className="text-sm font-medium text-gray-800">{body.what_changed}</p>
      ) : null}
      {body.sections_note ? (
        <p className="text-xs text-gray-500">{body.sections_note}</p>
      ) : null}
      {notes.length ? (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-gray-500">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {fields.length ? (
        <div className="space-y-4">
          {groups.map((groupName) => (
            <div key={groupName} className="overflow-x-auto rounded border border-gray-200 bg-white">
              <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600">
                {groupName}
              </div>
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-500">
                    <th className="px-3 py-2 font-medium">Field</th>
                    <th className="px-3 py-2 font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {groupMap.get(groupName).map((f, i) => (
                    <tr key={`${groupName}-${f.field}-${i}`} className="border-b border-gray-50 last:border-0">
                      <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{f.field}</td>
                      <td className="max-w-xl break-words px-3 py-2 text-gray-700">{f.value || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No field-level details recorded.</p>
      )}
    </div>
  );
}

const COL_COUNT = 11;

function CascadeSelects({
  source,
  section,
  card,
  form,
  onSection,
  onCard,
  onForm,
  sectionLabel = 'Section',
  cardLabel = 'Card',
  formLabel = 'Form / Dashboard',
}) {
  const [sectionOpts, setSectionOpts] = useState([]);
  const [cardOpts, setCardOpts] = useState([]);
  const [formOpts, setFormOpts] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/audit-filter-options', { params: { source } });
        if (!cancelled) setSectionOpts(data.options || []);
      } catch {
        if (!cancelled) setSectionOpts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [source]);

  useEffect(() => {
    let cancelled = false;
    if (!section) {
      setCardOpts([]);
      return undefined;
    }
    (async () => {
      try {
        const { data } = await api.get('/admin/audit-filter-options', {
          params: { source, section },
        });
        if (!cancelled) setCardOpts(data.options || []);
      } catch {
        if (!cancelled) setCardOpts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [source, section]);

  useEffect(() => {
    let cancelled = false;
    if (!section || !card) {
      setFormOpts([]);
      return undefined;
    }
    (async () => {
      try {
        const { data } = await api.get('/admin/audit-filter-options', {
          params: { source, section, card },
        });
        if (!cancelled) setFormOpts(data.options || []);
      } catch {
        if (!cancelled) setFormOpts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [source, section, card]);

  return (
    <>
      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-44">
        {sectionLabel}
        <select
          className="input-field h-10"
          value={section}
          onChange={(e) => {
            onSection(e.target.value);
            onCard('');
            onForm('');
          }}
        >
          <option value="">All</option>
          {sectionOpts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-44">
        {cardLabel}
        <select
          className="input-field h-10"
          value={card}
          disabled={!section}
          onChange={(e) => {
            onCard(e.target.value);
            onForm('');
          }}
        >
          <option value="">All</option>
          {cardOpts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-48">
        {formLabel}
        <select
          className="input-field h-10"
          value={form}
          disabled={!section || !card}
          onChange={(e) => onForm(e.target.value)}
        >
          <option value="">All</option>
          {formOpts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
    </>
  );
}

export default function AuditLogSection() {
  const [tab, setTab] = useState('changes');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [success, setSuccess] = useState('');
  const [active, setActive] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [section, setSection] = useState('');
  const [card, setCard] = useState('');
  const [form, setForm] = useState('');
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState({
    q: '', action: '', success: '', active: '', from: '', to: '',
    section: '', card: '', form: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'changes') {
        const { data } = await api.get('/admin/audit-logs', {
          params: {
            page,
            limit: 25,
            q: applied.q || undefined,
            action: applied.action || undefined,
            success: applied.success || undefined,
            from: applied.from || undefined,
            to: applied.to || undefined,
            module: applied.section || undefined,
            screen: applied.card || undefined,
            resource_name: applied.form || undefined,
          },
        });
        setRows(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
      } else if (tab === 'activity') {
        const { data } = await api.get('/admin/activity-logs', {
          params: {
            page,
            limit: 25,
            q: applied.q || undefined,
            from: applied.from || undefined,
            to: applied.to || undefined,
            section: applied.section || undefined,
            card: applied.card || undefined,
            form_or_dashboard: applied.form || undefined,
          },
        });
        setRows(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
      } else {
        const { data } = await api.get('/admin/sessions', {
          params: {
            page,
            limit: 25,
            q: applied.q || undefined,
            from: applied.from || undefined,
            to: applied.to || undefined,
            active: applied.active || undefined,
          },
        });
        setRows(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
      }
    } catch {
      toast.error('Failed to load audit data.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, applied, tab]);

  useEffect(() => {
    load();
  }, [load]);

  const applyFilters = (e) => {
    e.preventDefault();
    setExpandedId(null);
    setApplied({ q, action, success, active, from, to, section, card, form });
    setPage(1);
  };

  const switchTab = (next) => {
    setTab(next);
    setExpandedId(null);
    setPage(1);
    setRows([]);
  };

  const descriptions = {
    changes: 'Who created, updated, or deleted plant / form / admin data.',
    activity: 'Who opened which section, card, form, or dashboard — and how long they stayed.',
    sessions: 'Login / logout times, session length, and who is online now.',
  };

  return (
    <ConfigSectionPanel
      title="Audit & Activity"
      description={descriptions[tab]}
      actions={(
        <button type="button" className="btn-secondary h-9 px-3 text-sm" onClick={() => load()} disabled={loading}>
          <MdRefresh className="mr-1 inline" size={16} />
          Refresh
        </button>
      )}
    >
      <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-100 pb-3">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              tab === t.id
                ? 'bg-slate-800 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={applyFilters} className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Search
          <input
            type="search"
            className="input-field h-10"
            placeholder="Name, email, description…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        {tab === 'changes' ? (
          <>
            <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-36">
              Action
              <select className="input-field h-10" value={action} onChange={(e) => setAction(e.target.value)}>
                {ACTIONS.map((a) => (
                  <option key={a || 'all'} value={a}>{a || 'All'}</option>
                ))}
              </select>
            </label>
            <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-36">
              Result
              <select className="input-field h-10" value={success} onChange={(e) => setSuccess(e.target.value)}>
                {RESULT_FILTERS.map((o) => (
                  <option key={o.value || 'all'} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <CascadeSelects
              source="audit"
              section={section}
              card={card}
              form={form}
              onSection={setSection}
              onCard={setCard}
              onForm={setForm}
              sectionLabel="Module"
              cardLabel="Screen"
              formLabel="Resource"
            />
          </>
        ) : null}

        {tab === 'activity' ? (
          <CascadeSelects
            source="activity"
            section={section}
            card={card}
            form={form}
            onSection={setSection}
            onCard={setCard}
            onForm={setForm}
          />
        ) : null}

        {tab === 'sessions' ? (
          <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-40">
            Status
            <select className="input-field h-10" value={active} onChange={(e) => setActive(e.target.value)}>
              {ACTIVE_FILTERS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-40">
          From
          <input type="date" className="input-field h-10" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-40">
          To
          <input type="date" className="input-field h-10" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary h-10 px-4 text-sm">
          Apply
        </button>
      </form>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No entries match these filters.</p>
      ) : tab === 'changes' ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <th className="whitespace-nowrap px-2 py-2 font-medium">Time</th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Role</th>
                <th className="px-2 py-2 font-medium">Action</th>
                <th className="px-2 py-2 font-medium">Description</th>
                <th className="px-2 py-2 font-medium">Location</th>
                <th className="px-2 py-2 font-medium">API Path</th>
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Result</th>
                <th className="w-10 px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = expandedId === row.id;
                const actionLabel = row.action_type || row.method;
                const location = row.location || row.display_path || row.path;
                const ok = row.success === true || row.success === 1;
                const failed = row.success === false || row.success === 0;
                return (
                  <Fragment key={row.id}>
                    <tr className="align-top border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">{formatTime(row.created_at)}</td>
                      <td className="px-2 py-2.5 font-medium text-gray-900">{row.user_name || '—'}</td>
                      <td className="px-2 py-2.5 text-gray-600">{row.user_email || '—'}</td>
                      <td className="px-2 py-2.5 capitalize text-gray-700">{row.user_role || '—'}</td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${actionClass(actionLabel)}`}>
                          {actionLabel}
                        </span>
                      </td>
                      <td className="max-w-[22rem] px-2 py-2.5 text-gray-800" title={row.description || ''}>
                        <div className="line-clamp-3 text-sm leading-snug">{row.description || '—'}</div>
                      </td>
                      <td className="max-w-[16rem] px-2 py-2.5 text-gray-800" title={location}>
                        <div className="line-clamp-2 text-sm leading-snug">{location}</div>
                      </td>
                      <td className="max-w-[12rem] truncate px-2 py-2.5 font-mono text-xs text-gray-600" title={row.path}>
                        {row.path}
                      </td>
                      <td className={`px-2 py-2.5 font-semibold tabular-nums ${statusClass(row.status_code)}`}>
                        {row.status_code ?? '—'}
                      </td>
                      <td className="px-2 py-2.5">
                        {ok ? (
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">OK</span>
                        ) : failed ? (
                          <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700">Fail</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5">
                        <button
                          type="button"
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                          aria-label={open ? 'Hide details' : 'Show details'}
                          onClick={() => setExpandedId(open ? null : row.id)}
                        >
                          {open ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
                        </button>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <td colSpan={COL_COUNT} className="px-3 py-3">
                          <ReadableBody body={row.request_body_readable} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : tab === 'activity' ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <th className="whitespace-nowrap px-2 py-2 font-medium">Entered</th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Event</th>
                <th className="px-2 py-2 font-medium">Section</th>
                <th className="px-2 py-2 font-medium">Card</th>
                <th className="px-2 py-2 font-medium">Form / Dashboard</th>
                <th className="px-2 py-2 font-medium">Path</th>
                <th className="px-2 py-2 font-medium">Dwell</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="align-top border-b border-gray-50 hover:bg-gray-50/80">
                  <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">{formatTime(row.entered_at)}</td>
                  <td className="px-2 py-2.5 font-medium text-gray-900">{row.user_name || '—'}</td>
                  <td className="px-2 py-2.5 text-gray-700">{row.event_type}</td>
                  <td className="px-2 py-2.5 text-gray-800">{row.section || '—'}</td>
                  <td className="px-2 py-2.5 text-gray-800">{row.card || '—'}</td>
                  <td className="px-2 py-2.5 text-gray-800">{row.form_or_dashboard || '—'}</td>
                  <td className="max-w-[18rem] px-2 py-2.5 text-gray-600" title={row.display_path || row.page_path}>
                    <div className="line-clamp-2 text-sm">{row.display_path || row.page_path || '—'}</div>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-gray-700">
                    {formatDwell(row.dwell_seconds)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
                <th className="whitespace-nowrap px-2 py-2 font-medium">Login</th>
                <th className="px-2 py-2 font-medium">Name</th>
                <th className="px-2 py-2 font-medium">Email</th>
                <th className="px-2 py-2 font-medium">Role</th>
                <th className="px-2 py-2 font-medium">Dept</th>
                <th className="px-2 py-2 font-medium">Logout</th>
                <th className="px-2 py-2 font-medium">Duration</th>
                <th className="px-2 py-2 font-medium">Pages</th>
                <th className="px-2 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const online = row.is_active === 1 || row.is_active === true;
                return (
                  <tr key={row.id} className="align-top border-b border-gray-50 hover:bg-gray-50/80">
                    <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">{formatTime(row.login_at)}</td>
                    <td className="px-2 py-2.5 font-medium text-gray-900">{row.user_name || '—'}</td>
                    <td className="px-2 py-2.5 text-gray-600">{row.user_email || '—'}</td>
                    <td className="px-2 py-2.5 capitalize text-gray-700">{row.user_role || '—'}</td>
                    <td className="px-2 py-2.5 text-gray-700">{row.user_department || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">{formatTime(row.logout_at)}</td>
                    <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-gray-700">
                      {formatDuration(row.duration_minutes)}
                    </td>
                    <td className="px-2 py-2.5 tabular-nums text-gray-700">{row.pages_visited ?? 0}</td>
                    <td className="px-2 py-2.5">
                      {online ? (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-800">Online</span>
                      ) : (
                        <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold text-gray-600">Ended</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && pagination.total > 0 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-gray-600">
          <span>
            {pagination.total} entr{pagination.total === 1 ? 'y' : 'ies'}
            {' · '}
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary h-9 px-3 disabled:opacity-40"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary h-9 px-3 disabled:opacity-40"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      ) : null}
    </ConfigSectionPanel>
  );
}
