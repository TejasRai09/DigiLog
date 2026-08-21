import { useCallback, useRef, useState } from 'react';
import { MdSettings, MdRefresh, MdUpload } from 'react-icons/md';
import { Link } from 'react-router-dom';
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

function SlotCard({ meta, file, uploading, onUpload }) {
  const inputRef = useRef(null);
  const hasFile = Boolean(file);

  return (
    <div className="rounded-xl border border-sky-200 bg-white p-4 shadow-sm">
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

const META = [
  { slot: 'data_mill', label: 'Mill Equipment Mapping', hint: 'Data_Mill.xlsx file mapping mill variables to machinery.', filenameMatch: 'data_mill' },
  { slot: 'data_shredder', label: 'Shredder Equipment Mapping', hint: 'DataShredder_Names.xlsx mapping shredder variables.', filenameMatch: 'shredder_names' },
  { slot: 'data_lube', label: 'Lube & Roller Mapping', hint: 'DataLube_Names.xlsx mapping lube variables.', filenameMatch: 'lube_names' },
];

export default function MillingDashboardUploadSection({ files = [], onUploaded }) {
  const [uploadingSlot, setUploadingSlot] = useState(null);

  // Find latest file for each slot from the parent files array
  const slots = {};
  for (const m of META) {
    slots[m.slot] = files.find(f => f.originalFilename?.toLowerCase().includes(m.filenameMatch)) || null;
  }

  const handleUpload = async (slot, file) => {
    const slotMeta = META.find((m) => m.slot === slot);
    const form = new FormData();
    form.append('category', 'Milling Dashboard Mapping');
    form.append('file', file);

    setUploadingSlot(slot);
    try {
      const { data } = await api.post('/data-upload', form);
      const syncStatus = data.millMappingSync ? ' Mapping auto-synced successfully.' : '';
      toast.success('File uploaded.' + syncStatus);
      if (onUploaded) onUploaded();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed.');
    } finally {
      setUploadingSlot(null);
    }
  };

  return (
    <div className="card mt-6 overflow-hidden border-sky-200/80 shadow-sm">
      <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 to-white px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <MdSettings className="h-5 w-5 text-sky-600" />
              <h2 className="text-sm font-bold text-gray-900">Milling Operations Dashboard</h2>
            </div>
            <p className="mt-1 max-w-2xl text-xs text-gray-600">
              Upload equipment mapping reference files here. The system will automatically sync the mapping tables when a recognized file is uploaded.
            </p>
          </div>
          <Link
            to="/bi/milling-operations"
            className="text-xs font-bold text-sky-700 hover:text-sky-900"
          >
            Open Milling Operations →
          </Link>
        </div>
      </div>

      <div className="grid gap-4 p-4 lg:grid-cols-3 sm:p-6">
        {META.map((m) => (
          <SlotCard
            key={m.slot}
            meta={m}
            file={slots[m.slot]}
            uploading={uploadingSlot === m.slot}
            onUpload={handleUpload}
          />
        ))}
      </div>
    </div>
  );
}
