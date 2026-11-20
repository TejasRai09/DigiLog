import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminConfigLayout from '../../components/admin/AdminConfigLayout';
import {
  getConfigSection,
} from '../../components/admin/config/adminConfigSections';
import api from '../../api/axios';
import { EVENT_NOTIFICATION_NEW, onRealtimeEvent } from '../../realtime/socket';

const AdminConfig = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionFromUrl = searchParams.get('section');
  const initialSection = getConfigSection(sectionFromUrl).id;
  const [activeSectionId, setActiveSectionId] = useState(initialSection);
  const [pendingEditRequests, setPendingEditRequests] = useState(0);

  const loadPending = useCallback(async () => {
    try {
      const { data } = await api.get('/admin/form-edit-requests/count');
      setPendingEditRequests(Number(data.pending) || 0);
    } catch {
      /* the section itself reports a load error */
    }
  }, []);

  useEffect(() => { loadPending(); }, [loadPending, activeSectionId]);

  useEffect(() => {
    const onChanged = () => loadPending();
    window.addEventListener('edit-requests-changed', onChanged);
    return () => window.removeEventListener('edit-requests-changed', onChanged);
  }, [loadPending]);

  useEffect(() => onRealtimeEvent(EVENT_NOTIFICATION_NEW, (payload) => {
    if (payload?.type === 'form_edit_request_new') loadPending();
  }), [loadPending]);

  useEffect(() => {
    if (!sectionFromUrl) {
      setSearchParams({ section: getConfigSection(null).id }, { replace: true });
      return;
    }
    const next = getConfigSection(sectionFromUrl).id;
    setActiveSectionId(next);
  }, [sectionFromUrl, setSearchParams]);

  const ActiveSection = useMemo(() => {
    return getConfigSection(activeSectionId).Component;
  }, [activeSectionId]);

  const handleSectionChange = (id) => {
    setActiveSectionId(id);
    setSearchParams({ section: id }, { replace: true });
  };

  return (
    <AdminConfigLayout
      activeSectionId={activeSectionId}
      onSectionChange={handleSectionChange}
      pendingEditRequests={pendingEditRequests}
    >
      <ActiveSection key={activeSectionId} />
    </AdminConfigLayout>
  );
};

export default AdminConfig;
