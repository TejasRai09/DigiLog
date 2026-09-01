import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdInsights, MdRefresh, MdUpload } from 'react-icons/md';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Spinner from './Spinner';

function formatBytes(n) {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatIngestedAt(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function SlotCard({
  meta,
  file,
  uploading,
  onUpload,
}) {
  const inputRef = useRef(null);
  const hasFile = Boolean(file);

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-gray-900">{meta.label}</h3>
        <p className="mt-0.5 text-xs text-gray-500">{meta.hint}</p>
      </div>

      {hasFile ? (
        <div className="mb-4 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs">
          <p className="font-semibold text-gray-900 truncate" title={file.originalFilename}>
            {file.originalFilename}
          </p>
          <p className="mt-1 text-gray-500">
            {formatBytes(file.fileSizeBytes)} · {formatIngestedAt(file.createdAt)}
          </p>
          <p className="mt-0.5 text-gray-400">
            Uploaded by {file.uploadedByName}
          </p>
        </div>
      ) : (
        <p className="mb-4 text-xs italic text-gray-400">No file uploaded yet.</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={meta.accept || '.xlsx,.xls'}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(meta.slot, f);
          e.target.value = '';
        }}
      />

      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="btn-primary w-full justify-center text-sm"
      >
        {uploading ? <Spinner size="sm" /> : hasFile ? <MdRefresh className="h-4 w-4" /> : <MdUpload className="h-4 w-4" />}
        {uploading ? 'Uploading…' : hasFile ? 'Replace & re-import' : 'Upload & import'}
      </button>
    </div>
  );
}

export default function PurchyUploadSection({ onImportStarted, refreshToken = 0 }) {
  const [meta, setMeta] = useState([]);
  const [slots, setSlots] = useState({ grower: null, staff: null });
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/data-upload/purchy-slots');
      setSlots(data.slots || { grower: null, staff: null });
      setMeta(data.meta || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load Purchy uploads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots, refreshToken]);

  const handleUpload = async (slot, file) => {
    const slotMeta = meta.find((m) => m.slot === slot);
    const form = new FormData();
    form.append('slot', slot);
    if (slotMeta?.category) form.append('category', slotMeta.category);
    form.append('file', file);

    setUploadingSlot(slot);
    try {
      const { data } = await api.post('/data-upload/purchy', form);
      toast.success(data.message || 'Upload started.');
      await fetchSlots();
      if (data.purchyImport?.jobId) {
        onImportStarted({
          jobId: data.purchyImport.jobId,
          type: data.purchyImport.type,
          filename: file.name,
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const displayMeta = meta.length
    ? meta
    : [
      { slot: 'grower', label: 'Grower Details Season', hint: 'Grower Details Season workbook (.xlsx)' },
      { slot: 'staff', label: 'Staff wise Bonding', hint: 'Staff wise Bonding target workbook (.xlsx)' },
    ];

  return (
    <div className="card mt-6 overflow-hidden border-violet-200/80 shadow-sm">
      <div className="border-b border-violet-100 bg-gradient-to-r from-violet-50 to-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MdInsights className="h-5 w-5 text-violet-600" />
              <h2 className="text-sm font-bold text-gray-900">Purchy Analysis</h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-gray-600">
              Upload grower and staff workbooks here. Re-uploading replaces the previous file and re-imports data into the Purchy BI dashboard.
            </p>
          </div>
          <Link
            to="/bi/purchy-analysis"
            className="text-xs font-bold text-violet-700 hover:text-violet-900"
          >
            Open Purchy Analysis →
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">
          {displayMeta.map((m) => (
            <SlotCard
              key={m.slot}
              meta={m}
              file={slots[m.slot]}
              uploading={uploadingSlot === m.slot}
              onUpload={handleUpload}
            />
          ))}
        </div>
      )}
    </div>
  );
}
