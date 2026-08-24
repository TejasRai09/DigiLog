import { useCallback, useEffect, useState } from 'react';
import api from '../api/axios';
import useAuth from './useAuth';
import { DATA_UPLOAD_SECTION_KEYS } from '../config/dataUploadSections';

/** Whether the signed-in user can see Data Upload, and which sections. */
export default function useDataUploadAccess() {
  const { user } = useAuth();
  const userKey = user?.id ?? user?._id;

  const [sections, setSections] = useState(() => {
    if (!user) return [];
    if (user.role === 'admin') return [...DATA_UPLOAD_SECTION_KEYS];
    if (Array.isArray(user.dataUploadSections)) return [...user.dataUploadSections];
    return [];
  });
  const [loading, setLoading] = useState(() => {
    if (!user) return false;
    if (user.role === 'admin') return false;
    return !Array.isArray(user.dataUploadSections);
  });

  const refresh = useCallback(async () => {
    if (!user) {
      setSections([]);
      setLoading(false);
      return;
    }
    if (user.role === 'admin') {
      setSections([...DATA_UPLOAD_SECTION_KEYS]);
      setLoading(false);
      return;
    }

    // Instant path: sections already on auth user from login /auth/me
    if (Array.isArray(user.dataUploadSections) && user.dataUploadSections.length >= 0) {
      setSections([...user.dataUploadSections]);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const { data } = await api.get('/data-upload/access');
      setSections(Array.isArray(data.sections) ? data.sections : []);
    } catch (err) {
      console.error('[useDataUploadAccess]', err?.response?.status, err?.message);
      if (!Array.isArray(user.dataUploadSections)) setSections([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [userKey, user?.role, user?.dataUploadSections, refresh]);

  useEffect(() => {
    if (user?.role !== 'employee') return undefined;
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.role, refresh]);

  const enabled = sections.length > 0;
  const canAccess = (key) => sections.includes(key);

  return { enabled, loading, sections, canAccess, refresh };
}
