import { useEffect, useState } from 'react';
import { MdExpandLess, MdExpandMore, MdSave, MdEmail } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../../../api/axios';
import Spinner from '../../Spinner';
import ConfigSectionPanel from './ConfigSectionPanel';

function HodSelect({ value, onChange, employees, placeholder = '— Select employee —' }) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
    >
      <option value="">{placeholder}</option>
      {employees.map((emp) => (
        <option key={emp.id} value={emp.id}>
          {emp.name} ({emp.email})
        </option>
      ))}
    </select>
  );
}

function Toggle({ enabled, onToggle, label }) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

export default function FormsApprovalSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [cards, setCards] = useState([]);
  const [openAppId, setOpenAppId] = useState(null);
  const [resending, setResending] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/admin/form-approval-settings');
        if (cancelled) return;
        setEmployees(data.employees || []);
        setCards(data.cards || []);
      } catch {
        if (!cancelled) toast.error('Failed to load forms approval settings.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const patchCard = (appId, patch) => {
    setCards((prev) => prev.map((card) => (
      card.appId === appId ? { ...card, ...patch } : card
    )));
  };

  const patchForm = (appId, formId, patch) => {
    setCards((prev) => prev.map((card) => {
      if (card.appId !== appId) return card;
      return {
        ...card,
        forms: card.forms.map((form) => (
          form.formId === formId ? { ...form, ...patch } : form
        )),
      };
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/admin/form-approval-settings', { cards });
      setCards(data.cards || cards);
      toast.success('Forms approval settings saved.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const resend = async (card, mode) => {
    const key = `${card.appId}:${mode}`;
    setResending(key);
    try {
      const { data } = await api.post('/admin/form-approval-settings/resend-digest', {
        appId: card.appId,
        mode,
      });
      if (data.sent) toast.success(data.message || 'Digest sent.');
      else toast(data.message || 'Nothing to email.');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resend digest.');
    } finally {
      setResending('');
    }
  };

  return (
    <ConfigSectionPanel
      title="Forms Approval"
      description="When enabled on a Forms Hub card, operator submits wait for the assigned HOD. Each form can inherit that setting, stay on with a different HOD, or skip approval and save immediately. Digest emails open a no-login inbox, same as maintenance approval. Off until you turn a card or form on."
      actions={
        loading ? <Spinner size="sm" /> : (
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 text-white disabled:opacity-50"
          >
            {saving ? <Spinner size="sm" /> : <MdSave className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : 'Save'}
          </button>
        )
      }
    >
      {loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : cards.length === 0 ? (
        <p className="text-sm text-slate-500">No data forms found to configure.</p>
      ) : (
        <div className="space-y-3">
          {cards.map((card) => {
            const open = openAppId === card.appId;
            return (
              <div
                key={card.appId}
                className="rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-900/40 overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">{card.name}</h3>
                      {card.description ? (
                        <p className="text-xs text-slate-500 mt-0.5">{card.description}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpenAppId(open ? null : card.appId)}
                      className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                    >
                      {open ? <MdExpandLess className="w-4 h-4" /> : <MdExpandMore className="w-4 h-4" />}
                      Forms
                    </button>
                  </div>
                  <Toggle
                    enabled={card.enabled}
                    onToggle={(enabled) => patchCard(card.appId, { enabled })}
                    label="Enable HOD approval for this card"
                  />
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                      Card HOD
                    </label>
                    <HodSelect
                      value={card.hodUserId}
                      onChange={(hodUserId) => patchCard(card.appId, { hodUserId })}
                      employees={employees}
                    />
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Full digest times (IST)
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                          Time 1
                        </label>
                        <input
                          type="time"
                          value={card.digestTime || '22:00'}
                          onChange={(e) => patchCard(card.appId, { digestTime: e.target.value || '22:00' })}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                          Time 2 (optional)
                        </label>
                        <input
                          type="time"
                          value={card.digestTime2 || ''}
                          onChange={(e) => patchCard(card.appId, { digestTime2: e.target.value || '' })}
                          className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900"
                        />
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Sends a full pending digest email to the HOD at each time (IST). Leave Time 2 blank to send only once per day.
                      The email opens a no-login approvals inbox.
                    </p>
                  </div>
                  {(card.enabled || card.forms.some((form) => form.mode === 'on')) ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={resending === `${card.appId}:all`}
                        onClick={() => resend(card, 'all')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                      >
                        {resending === `${card.appId}:all` ? <Spinner size="sm" /> : <MdEmail className="w-3.5 h-3.5" />}
                        {resending === `${card.appId}:all` ? 'Sending…' : 'Resend full digest'}
                      </button>
                      <button
                        type="button"
                        disabled={resending === `${card.appId}:new`}
                        onClick={() => resend(card, 'new')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 disabled:opacity-50"
                      >
                        {resending === `${card.appId}:new` ? <Spinner size="sm" /> : <MdEmail className="w-3.5 h-3.5" />}
                        {resending === `${card.appId}:new` ? 'Sending…' : 'Email new pending only'}
                      </button>
                    </div>
                  ) : null}
                </div>
                {open ? (
                  <div className="border-t border-slate-100 bg-slate-50/70 dark:bg-slate-800/30 p-4 space-y-3">
                    {card.forms.map((form) => (
                      <div
                        key={form.formId}
                        className="rounded-xl border border-slate-200 bg-white dark:bg-slate-900 p-3 space-y-2"
                      >
                        <p className="text-sm font-semibold text-slate-800">{form.name}</p>
                        <p className="text-[11px] text-slate-400">{form.formKey}</p>
                        <div className="flex flex-wrap gap-3 text-xs">
                          {['inherit', 'on', 'off'].map((mode) => (
                            <label key={mode} className="inline-flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name={`mode-${card.appId}-${form.formId}`}
                                checked={form.mode === mode}
                                onChange={() => patchForm(card.appId, form.formId, { mode })}
                              />
                              <span className="font-semibold capitalize text-slate-600">
                                {mode === 'inherit' ? 'Inherit card' : mode === 'on' ? 'On' : 'Off'}
                              </span>
                            </label>
                          ))}
                        </div>
                        {form.mode === 'on' ? (
                          <div>
                            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                              Form HOD (optional — leave blank to use card HOD)
                            </label>
                            <HodSelect
                              value={form.hodUserId}
                              onChange={(hodUserId) => patchForm(card.appId, form.formId, { hodUserId })}
                              employees={employees}
                              placeholder="— Use card HOD —"
                            />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </ConfigSectionPanel>
  );
}
