import { useEffect, useState } from 'react';
import api from '../api/axios';
import { withoutGsmaLabel } from '../utils/displayLabels';

/**
 * Load form display metadata from GET /api/forms/:formKey.
 * Falls back to provided titles when the form is not in the catalog (e.g. EHS-only routes).
 */
export function useFormMeta(formKey, { fallbackTitle = '', fallbackDescription = '' } = {}) {
  const [meta, setMeta] = useState({
    name: fallbackTitle,
    description: fallbackDescription,
    loading: Boolean(formKey),
  });

  useEffect(() => {
    if (!formKey) {
      setMeta({ name: fallbackTitle, description: fallbackDescription, loading: false });
      return undefined;
    }

    let cancelled = false;
    setMeta((prev) => ({ ...prev, loading: true }));

    (async () => {
      try {
        const { data } = await api.get(`/forms/${formKey}`);
        if (cancelled) return;
        setMeta({
          name: withoutGsmaLabel(data.name) || fallbackTitle,
          description: data.description ? withoutGsmaLabel(data.description) : fallbackDescription,
          loading: false,
        });
      } catch {
        if (cancelled) return;
        setMeta({
          name: fallbackTitle,
          description: fallbackDescription,
          loading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formKey, fallbackTitle, fallbackDescription]);

  return meta;
}
