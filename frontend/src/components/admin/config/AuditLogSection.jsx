import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { MdExpandLess, MdExpandMore, MdRefresh } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../../components/Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';
import {
  auditFilterBranches,
  auditFilterCards,
  auditFilterLeaves,
  auditFilterRoots,
  auditFilterScreens,
  formsCardsFromApps,
} from '../../../utils/auditFilterTree';

const TABS = [
  { id: 'changes', label: 'Changes' },
  { id: 'activity', label: 'Views and downloads' },
  { id: 'sessions', label: 'Sign-ins' },
];

const ACTIONS = ['', 'Create', 'Update', 'Delete', 'Login'];
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

const EVENT_LABELS = {
  page_view: 'Opened page',
  section_open: 'Opened page',
  card_open: 'Opened page',
  form_open: 'Opened form',
  dashboard_open: 'Opened page',
  equipment_section_open: 'Opened page',
  view_data: 'Viewed data',
  download_csv: 'Downloaded CSV',
  download_pdf: 'Downloaded PDF',
  chart_download_csv: 'Downloaded chart',
  dashboard_tab: 'Opened page',
  dashboard_filter: 'Opened page',
  form_submit: 'Opened form',
  logout: 'Signed out',
};

/** Parse API DATETIME strings (MySQL UTC session + dateStrings) as UTC. */
function parseAuditUtcDateTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  const mysqlUtc = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(\.\d+)?$/.exec(s);
  if (mysqlUtc) {
    return new Date(`${mysqlUtc[1]}T${mysqlUtc[2]}${mysqlUtc[3] || ''}Z`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(value) {
  if (!value) return '—';
  const d = parseAuditUtcDateTime(value);
  if (!d) return String(value);
  return d.toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatRelative(value) {
  const d = parseAuditUtcDateTime(value);
  if (!d) return '';
  const sec = Math.round((Date.now() - d.getTime()) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} d ago`;
  return '';
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

const CLICK_EVENTS = new Set([
  'download_csv',
  'download_pdf',
  'chart_download_csv',
  'dashboard_tab',
  'dashboard_filter',
  'view_data',
]);

function formatDwell(seconds) {
  if (seconds == null || seconds === '') return '—';
  const s = Number(seconds);
  if (!Number.isFinite(s)) return '—';
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}

function formatStayTime(row) {
  if (CLICK_EVENTS.has(String(row.event_type || ''))) return 'Not a page stay';
  return formatDwell(row.dwell_seconds);
}

function eventLabel(type) {
  const key = String(type || '');
  return EVENT_LABELS[key] || (key ? key.replace(/_/g, ' ') : '—');
}

function istYmd(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function mondayOfIstWeek(todayYmd) {
  const probe = new Date(`${todayYmd}T06:00:00+05:30`);
  const dow = probe.getUTCDay();
  const offset = dow === 0 ? 6 : dow - 1;
  return addDaysYmd(todayYmd, -offset);
}

function resultChipClass(label) {
  switch (label) {
    case 'Saved':
      return 'bg-emerald-50 text-emerald-800';
    case 'Sent for approval':
      return 'bg-sky-50 text-sky-800';
    case 'Approved':
      return 'bg-teal-50 text-teal-800';
    case 'Edited':
      return 'bg-amber-50 text-amber-900';
    case 'Deleted':
      return 'bg-orange-50 text-orange-800';
    case 'Signed in':
    case 'Sent back':
      return 'bg-violet-50 text-violet-800';
    default:
      return 'bg-red-50 text-red-700';
  }
}

function FieldTable({ fields, mode }) {
  if (!fields.length) return null;
  const showDiff = mode === 'diff' || fields.some((f) => f.before != null);
  return (
    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50 text-gray-500">
            <th className="px-3 py-2 font-medium">Field</th>
            {showDiff ? (
              <>
                <th className="px-3 py-2 font-medium">Before</th>
                <th className="px-3 py-2 font-medium">After</th>
              </>
            ) : (
              <th className="px-3 py-2 font-medium">Value</th>
            )}
          </tr>
        </thead>
        <tbody>
          {fields.map((f, i) => (
            <tr key={`${f.field}-${i}`} className="border-b border-gray-50 last:border-0">
              <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-800">{f.field}</td>
              {showDiff ? (
                <>
                  <td className="max-w-xs break-words px-3 py-2 text-gray-600">{f.before ?? '—'}</td>
                  <td className="max-w-xs break-words px-3 py-2 text-gray-800">{f.after ?? f.value ?? '—'}</td>
                </>
              ) : (
                <td className="max-w-xl break-words px-3 py-2 text-gray-700">{f.value || '—'}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeExpand({ row }) {
  const body = row.request_body_readable || {};
  const fields = Array.isArray(body.fields) ? body.fields : [];
  const kind = body.change_kind || row.change_kind;
  const failed = row.success === false || row.success === 0;
  const isDelete = kind === 'delete' || row.action_type === 'Delete';
  const isEdit = kind === 'edit' || (row.action_type === 'Update' && fields.some((f) => f.before != null));
  const entered = !failed && !isDelete && !isEdit && fields.length > 0;
  const serverProblem = Number(row.status_code) >= 500 || row.result_label === 'Server problem';

  return (
    <div className="space-y-4">
      {entered ? (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">What was entered</h4>
          <FieldTable fields={fields} mode="value" />
        </section>
      ) : null}
      {isEdit && fields.length ? (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">What changed</h4>
          <FieldTable fields={fields} mode="diff" />
        </section>
      ) : null}
      {isDelete && fields.length ? (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600">What was deleted</h4>
          <FieldTable fields={fields} mode="value" />
        </section>
      ) : null}
      {failed ? (
        <section className="rounded border border-red-200 bg-red-50 px-3 py-3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-red-800">What went wrong</h4>
          <p className="text-sm font-medium text-red-800">{row.result_label || row.status_label || 'Failed'}</p>
          <p className="mt-1 text-sm text-red-700">{row.outcome_message || 'The save did not go through.'}</p>
          {serverProblem ? (
            <p className="mt-2 text-xs text-red-700">Ask IT to check Technical details for the cause.</p>
          ) : null}
        </section>
      ) : null}
      {!entered && !isEdit && !isDelete && !failed && fields.length ? (
        <FieldTable fields={fields} mode="value" />
      ) : null}
      <details className="rounded border border-gray-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-600">
          Technical details
        </summary>
        <dl className="mt-2 grid gap-1 text-xs text-gray-700 sm:grid-cols-2">
          <div><span className="text-gray-500">Email: </span>{row.user_email || '—'}</div>
          <div><span className="text-gray-500">API path: </span><span className="font-mono">{row.path || '—'}</span></div>
          <div><span className="text-gray-500">Status: </span>{row.status_code ?? '—'} {row.status_label ? `(${row.status_label})` : ''}</div>
          <div><span className="text-gray-500">Duration: </span>{row.duration_ms != null ? `${row.duration_ms} ms` : '—'}</div>
          <div><span className="text-gray-500">IP: </span>{row.ip || '—'}</div>
          <div className="sm:col-span-2"><span className="text-gray-500">Browser: </span>{row.user_agent || '—'}</div>
          {row.error_detail ? (
            <div className="sm:col-span-2"><span className="text-gray-500">Error: </span><span className="font-mono">{row.error_detail}</span></div>
          ) : null}
        </dl>
      </details>
    </div>
  );
}

function ActivityExpand({ row }) {
  let meta = row.metadata;
  if (typeof meta === 'string') {
    try { meta = JSON.parse(meta); } catch { /* keep string */ }
  }
  return (
    <dl className="grid gap-1 text-xs text-gray-700 sm:grid-cols-2">
      <div><span className="text-gray-500">Form / Dashboard: </span>{row.form_or_dashboard || '—'}</div>
      <div><span className="text-gray-500">Path: </span>{row.display_path || row.page_path || '—'}</div>
      <div><span className="text-gray-500">Stay: </span>{formatStayTime(row)}</div>
      <div><span className="text-gray-500">IP: </span>{row.ip || '—'}</div>
      {meta && typeof meta === 'object' ? (
        <div className="sm:col-span-2">
          <span className="text-gray-500">Details: </span>
          {Object.entries(meta).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') || '—'}
        </div>
      ) : null}
    </dl>
  );
}

const CHANGE_COL_COUNT = 6;
const ACTIVITY_COL_COUNT = 7;

/** Prefilled Area → Section → Detail → Card → Screen cascade. */
function TreeCascadeSelects({
  root, branch, leaf, card, screen,
  onRoot, onBranch, onLeaf, onCard, onScreen,
  formsCardLabels,
}) {
  const rootOpts = useMemo(() => auditFilterRoots(), []);
  const branchOpts = useMemo(() => auditFilterBranches(root), [root]);
  const leafOpts = useMemo(() => auditFilterLeaves(root, branch), [root, branch]);
  const cardOpts = useMemo(
    () => auditFilterCards(root, branch, leaf, formsCardLabels),
    [root, branch, leaf, formsCardLabels],
  );
  const screenOpts = useMemo(
    () => auditFilterScreens(root, branch, leaf, card),
    [root, branch, leaf, card],
  );
  const leafDisabled = !root || !branch || leafOpts.length === 0;
  const cardDisabled = !leaf || cardOpts.length === 0;
  const screenDisabled = !card || screenOpts.length === 0;

  return (
    <>
      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-44">
        Area
        <select
          className="input-field h-10"
          value={root}
          onChange={(e) => {
            onRoot(e.target.value);
            onBranch('');
            onLeaf('');
            onCard('');
            onScreen('');
          }}
        >
          <option value="">All</option>
          {rootOpts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-44">
        Section
        <select
          className="input-field h-10"
          value={branch}
          disabled={!root}
          onChange={(e) => {
            onBranch(e.target.value);
            onLeaf('');
            onCard('');
            onScreen('');
          }}
        >
          <option value="">{root ? 'All' : 'Select area first'}</option>
          {branchOpts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-52">
        Detail
        <select
          className="input-field h-10"
          value={leaf}
          disabled={leafDisabled}
          onChange={(e) => {
            onLeaf(e.target.value);
            onCard('');
            onScreen('');
          }}
        >
          <option value="">
            {!root || !branch ? 'Select section first' : leafOpts.length ? 'All' : 'No further detail'}
          </option>
          {leafOpts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-52">
        Card
        <select
          className="input-field h-10"
          value={card}
          disabled={cardDisabled}
          onChange={(e) => {
            onCard(e.target.value);
            onScreen('');
          }}
        >
          <option value="">
            {!leaf ? 'Select detail first' : cardOpts.length ? 'All' : 'No further card'}
          </option>
          {cardOpts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
      <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-44">
        Screen
        <select
          className="input-field h-10"
          value={screen}
          disabled={screenDisabled}
          onChange={(e) => onScreen(e.target.value)}
        >
          <option value="">
            {leaf === 'Equipment specification cards' && !card
              ? 'Select equipment card first'
              : screenOpts.length ? 'All' : 'No further screen'}
          </option>
          {screenOpts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </label>
    </>
  );
}

function chipClass(active) {
  return `rounded-full px-3 py-1 text-xs font-medium ${
    active ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
  }`;
}

export default function AuditLogSection() {
  const [tab, setTab] = useState('changes');
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [summary, setSummary] = useState(null);

  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [success, setSuccess] = useState('');
  const [active, setActive] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [quick, setQuick] = useState('');
  const [dateChip, setDateChip] = useState('');
  const [filterRoot, setFilterRoot] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterLeaf, setFilterLeaf] = useState('');
  const [filterCard, setFilterCard] = useState('');
  const [filterScreen, setFilterScreen] = useState('');
  const [formsCardLabels, setFormsCardLabels] = useState(null);
  const [page, setPage] = useState(1);
  const emptyApplied = {
    q: '', action: '', success: '', active: '', from: '', to: '', quick: '',
    filterRoot: '', filterBranch: '', filterLeaf: '', filterCard: '', filterScreen: '',
  };
  const [applied, setApplied] = useState(emptyApplied);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/apps-all');
        const apps = Array.isArray(data) ? data : (data.apps || data.data || []);
        if (!cancelled) setFormsCardLabels(formsCardsFromApps(apps));
      } catch {
        if (!cancelled) setFormsCardLabels(null);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const configLeafIsAction = applied.filterRoot === 'Config'
    && ['Create', 'Update', 'Delete'].includes(applied.filterLeaf);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const treeParams = {
        filter_root: applied.filterRoot || undefined,
        filter_branch: applied.filterBranch || undefined,
        filter_leaf: applied.filterLeaf || undefined,
        filter_card: applied.filterCard || undefined,
        filter_screen: applied.filterScreen || undefined,
      };

      if (tab === 'changes') {
        const params = {
          page,
          limit: 25,
          q: applied.q || undefined,
          action: configLeafIsAction ? undefined : (applied.action || undefined),
          success: applied.quick === 'problems' ? '0' : (applied.success || undefined),
          from: applied.from || undefined,
          to: applied.to || undefined,
          quick: applied.quick || undefined,
          ...treeParams,
        };
        const [{ data }, summaryRes] = await Promise.all([
          api.get('/admin/audit-logs', { params }),
          api.get('/admin/audit-logs/summary', {
            params: {
              q: applied.q || undefined,
              from: applied.from || undefined,
              to: applied.to || undefined,
              ...treeParams,
            },
          }).catch(() => ({ data: null })),
        ]);
        setRows(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
        setSummary(summaryRes.data || null);
      } else if (tab === 'activity') {
        const { data } = await api.get('/admin/activity-logs', {
          params: {
            page,
            limit: 25,
            q: applied.q || undefined,
            from: applied.from || undefined,
            to: applied.to || undefined,
            ...treeParams,
          },
        });
        setRows(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
        setSummary(null);
      } else {
        const { data } = await api.get('/admin/sessions', {
          params: {
            page,
            limit: 25,
            q: applied.q || undefined,
            from: applied.from || undefined,
            to: applied.to || undefined,
            active: applied.active || undefined,
            ...treeParams,
          },
        });
        setRows(data.data || []);
        setPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
        setSummary(null);
      }
    } catch {
      toast.error('Failed to load audit data.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, applied, tab, configLeafIsAction]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setApplied((prev) => {
      const next = {
        ...prev,
        action,
        success,
        active,
        from,
        to,
        quick,
        filterRoot,
        filterBranch,
        filterLeaf,
        filterCard,
        filterScreen,
      };
      if (
        prev.action === next.action
        && prev.success === next.success
        && prev.active === next.active
        && prev.from === next.from
        && prev.to === next.to
        && prev.quick === next.quick
        && prev.filterRoot === next.filterRoot
        && prev.filterBranch === next.filterBranch
        && prev.filterLeaf === next.filterLeaf
        && prev.filterCard === next.filterCard
        && prev.filterScreen === next.filterScreen
      ) {
        return prev;
      }
      setExpandedId(null);
      setPage(1);
      return next;
    });
  }, [action, success, active, from, to, quick, filterRoot, filterBranch, filterLeaf, filterCard, filterScreen]);

  const applyFilters = (e) => {
    e.preventDefault();
    setExpandedId(null);
    setApplied({
      q, action, success, active, from, to, quick,
      filterRoot, filterBranch, filterLeaf, filterCard, filterScreen,
    });
    setPage(1);
  };

  const resetFilters = () => {
    setQ('');
    setAction('');
    setSuccess('');
    setActive('');
    setFrom('');
    setTo('');
    setQuick('');
    setDateChip('');
    setFilterRoot('');
    setFilterBranch('');
    setFilterLeaf('');
    setFilterCard('');
    setFilterScreen('');
    setExpandedId(null);
    setPage(1);
    setApplied(emptyApplied);
  };

  const switchTab = (next) => {
    setTab(next);
    setExpandedId(null);
    setPage(1);
    setRows([]);
  };

  const applyDateChip = (id) => {
    const today = istYmd();
    if (dateChip === id) {
      setDateChip('');
      setFrom('');
      setTo('');
      return;
    }
    setDateChip(id);
    if (id === 'today') {
      setFrom(today);
      setTo(today);
    } else if (id === 'yesterday') {
      const y = addDaysYmd(today, -1);
      setFrom(y);
      setTo(y);
    } else if (id === 'week') {
      setFrom(mondayOfIstWeek(today));
      setTo(today);
    }
  };

  const applyQuick = (id) => {
    if (id === 'logins') {
      switchTab('sessions');
      return;
    }
    if (id === 'approvals') {
      setQuick(quick === 'approvals' ? '' : 'approvals');
      if (quick !== 'approvals') {
        setFilterRoot('Approvals');
        setFilterBranch('');
        setFilterLeaf('');
        setFilterCard('');
        setFilterScreen('');
      }
      return;
    }
    if (id === 'uploads') {
      setQuick(quick === 'uploads' ? '' : 'uploads');
      if (quick !== 'uploads') {
        setFilterRoot('Data Upload');
        setFilterBranch('');
        setFilterLeaf('');
        setFilterCard('');
        setFilterScreen('');
      }
      return;
    }
    const turningOff = quick === id;
    setQuick(turningOff ? '' : id);
    if (id === 'problems') setSuccess(turningOff ? '' : '0');
    else setSuccess('');
  };

  const applySummary = (key) => {
    if (key === 'failed') {
      setQuick('problems');
      setSuccess('0');
      return;
    }
    if (key === 'edits' || key === 'deletes') {
      setQuick('edits');
      setAction(key === 'deletes' ? 'Delete' : 'Update');
      return;
    }
    if (key === 'approvals' || key === 'sent_for_approval') {
      setQuick('approvals');
      setFilterRoot('Approvals');
      setFilterBranch(key === 'sent_for_approval' ? 'Operations forms' : '');
      setFilterLeaf('');
      return;
    }
    if (key === 'saved') {
      setQuick('');
      setAction('Create');
      setSuccess('1');
      setFilterRoot('Home');
      setFilterBranch('Forms Hub');
      setFilterLeaf('Forms cards');
    }
  };

  const descriptions = {
    changes: 'Who saved, edited, deleted, or approved plant and form data — and whether it went through.',
    activity: 'Who opened which form or dashboard, and who downloaded a file.',
    sessions: 'Who signed in, how long they stayed, and who is online now.',
  };

  const summaryItems = summary ? [
    { key: 'saved', label: 'Saved', value: summary.saved },
    { key: 'sent_for_approval', label: 'Sent for approval', value: summary.sent_for_approval },
    { key: 'approvals', label: 'Approved or returned', value: summary.approvals },
    { key: 'edits', label: 'Edits', value: summary.edits },
    { key: 'deletes', label: 'Deletes', value: summary.deletes },
    { key: 'failed', label: 'Failed', value: summary.failed },
  ] : [];

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

      {tab === 'changes' ? (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'This week' },
            { id: 'problems', label: 'Problems only' },
            { id: 'edits', label: 'Edits and deletes' },
            { id: 'approvals', label: 'Approvals' },
            { id: 'uploads', label: 'Uploads' },
            { id: 'logins', label: 'Sign-ins' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              className={chipClass(
                c.id === 'today' || c.id === 'yesterday' || c.id === 'week'
                  ? dateChip === c.id
                  : quick === c.id,
              )}
              onClick={() => {
                if (c.id === 'today' || c.id === 'yesterday' || c.id === 'week') applyDateChip(c.id);
                else applyQuick(c.id);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === 'changes' && summaryItems.length ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {summaryItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => applySummary(item.key)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="text-lg font-semibold tabular-nums text-slate-800">{item.value}</div>
              <div className="text-xs text-gray-500">{item.label}</div>
            </button>
          ))}
        </div>
      ) : null}

      <form onSubmit={applyFilters} className="mb-4 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <p className="w-full text-xs text-gray-500">
          Area, dates, and other dropdowns apply as soon as you change them. Use Apply for search text.
        </p>
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

        <TreeCascadeSelects
          root={filterRoot}
          branch={filterBranch}
          leaf={filterLeaf}
          card={filterCard}
          screen={filterScreen}
          onRoot={setFilterRoot}
          onBranch={setFilterBranch}
          onLeaf={setFilterLeaf}
          onCard={setFilterCard}
          onScreen={setFilterScreen}
          formsCardLabels={formsCardLabels}
        />

        {tab === 'changes' && filterRoot !== 'Config' ? (
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
          </>
        ) : null}

        {tab === 'changes' && filterRoot === 'Config' ? (
          <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-36">
            Result
            <select className="input-field h-10" value={success} onChange={(e) => setSuccess(e.target.value)}>
              {RESULT_FILTERS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
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
          <input type="date" className="input-field h-10" value={from} onChange={(e) => { setFrom(e.target.value); setDateChip(''); }} />
        </label>
        <label className="flex w-full flex-col gap-1 text-xs font-medium text-gray-600 sm:w-40">
          To
          <input type="date" className="input-field h-10" value={to} onChange={(e) => { setTo(e.target.value); setDateChip(''); }} />
        </label>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary h-10 px-4 text-sm">
            Apply
          </button>
          <button type="button" className="btn-secondary h-10 px-4 text-sm" onClick={resetFilters}>
            Reset
          </button>
        </div>
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
                <th className="px-2 py-2 font-medium">Person</th>
                <th className="px-2 py-2 font-medium">What happened</th>
                <th className="px-2 py-2 font-medium">Where</th>
                <th className="px-2 py-2 font-medium">Result</th>
                <th className="w-10 px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = expandedId === row.id;
                const location = row.location || row.display_path || row.path;
                const rel = formatRelative(row.created_at);
                const result = row.result_label || (row.success ? 'Saved' : 'Failed');
                return (
                  <Fragment key={row.id}>
                    <tr className="align-top border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">
                        <div>{formatTime(row.created_at)}</div>
                        {rel ? <div className="text-xs text-gray-400">{rel}</div> : null}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="font-medium text-gray-900">{row.user_name || '—'}</div>
                        <div className="text-xs capitalize text-gray-500">{row.user_role || '—'}</div>
                      </td>
                      <td className="max-w-[28rem] px-2 py-2.5 text-gray-800" title={row.description || ''}>
                        <div className="line-clamp-3 text-sm leading-snug">{row.description || '—'}</div>
                      </td>
                      <td className="max-w-[18rem] px-2 py-2.5 text-gray-800" title={location}>
                        <div className="line-clamp-2 text-sm leading-snug">{location}</div>
                      </td>
                      <td className="px-2 py-2.5">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold ${resultChipClass(result)}`}>
                          {result}
                        </span>
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
                        <td colSpan={CHANGE_COL_COUNT} className="px-3 py-3">
                          <ChangeExpand row={row} />
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
                <th className="whitespace-nowrap px-2 py-2 font-medium">Time</th>
                <th className="px-2 py-2 font-medium">Person</th>
                <th className="px-2 py-2 font-medium">What happened</th>
                <th className="px-2 py-2 font-medium">Form / Dashboard</th>
                <th className="px-2 py-2 font-medium">Where</th>
                <th className="px-2 py-2 font-medium">Stay time</th>
                <th className="w-10 px-2 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const open = expandedId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className="align-top border-b border-gray-50 hover:bg-gray-50/80">
                      <td className="whitespace-nowrap px-2 py-2.5 text-gray-700">{formatTime(row.entered_at)}</td>
                      <td className="px-2 py-2.5">
                        <div className="font-medium text-gray-900">{row.user_name || '—'}</div>
                        <div className="text-xs capitalize text-gray-500">{row.user_role || '—'}</div>
                      </td>
                      <td className="px-2 py-2.5 text-gray-800">{eventLabel(row.event_type)}</td>
                      <td className="px-2 py-2.5 text-gray-800">{row.form_or_dashboard || '—'}</td>
                      <td className="max-w-[18rem] px-2 py-2.5 text-gray-600" title={row.display_path || row.page_path}>
                        <div className="line-clamp-2 text-sm">{row.display_path || row.card || row.section || '—'}</div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2.5 tabular-nums text-gray-700">
                        {formatStayTime(row)}
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
                        <td colSpan={ACTIVITY_COL_COUNT} className="px-3 py-3">
                          <ActivityExpand row={row} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
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
