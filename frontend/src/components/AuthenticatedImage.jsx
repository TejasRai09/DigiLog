import { useEffect, useState } from 'react';
import api from '../api/axios';

/**
 * Image that requires JWT (API paths like /auth/users/:id/avatar).
 * Pass-through for data: and absolute http(s) URLs (legacy avatars).
 */
export default function AuthenticatedImage({ src, alt = '', className, ...props }) {
  const [objectUrl, setObjectUrl] = useState(null);

  useEffect(() => {
    if (!src) {
      setObjectUrl(null);
      return undefined;
    }

    if (
      src.startsWith('data:')
      || src.startsWith('http://')
      || src.startsWith('https://')
    ) {
      setObjectUrl(src);
      return undefined;
    }

    let cancelled = false;
    let blobUrl = null;

    api
      .get(src, { responseType: 'blob' })
      .then((res) => {
        if (cancelled) return;
        blobUrl = URL.createObjectURL(res.data);
        setObjectUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setObjectUrl(null);
      });

    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [src]);

  if (!objectUrl) return null;

  return <img src={objectUrl} alt={alt} className={className} {...props} />;
}
