import { useMemo, useRef, useState } from 'react';
import {
  MdAdd,
  MdChevronLeft,
  MdChevronRight,
  MdClose,
  MdDownload,
  MdEdit,
  MdInfo,
  MdSave,
  MdSearch,
  MdVisibility,
} from 'react-icons/md';
import {
  FaFile,
  FaFileExcel,
  FaFileLines,
  FaFilePdf,
  FaFileWord,
} from 'react-icons/fa6';
import Spinner from '../Spinner';
import EquipmentSectionShell from './EquipmentSectionShell';
import EquipmentMultiSelectDropdown from './EquipmentMultiSelectDropdown';
import ToolbarFilterSelect from './ToolbarFilterSelect';
import { resizeImage } from '../../utils/resizeImage';
import {
  EMPTY_HISTORY_FORM,
  HISTORY_MAINTENANCE_TYPE_OPTIONS,
  HISTORY_SERVICE_OPTIONS,
  HISTORY_DOCUMENT_ACCEPT,
  MAX_HISTORY_DOCUMENTS,
  equipmentKeysFromRecord,
  compareMaintenanceHistoryByDate,
  formatDateDisplay,
  formatEntryId,
  historyRecordFromApi,
  isOffSeason,
  maintenanceTypeLabel,
  normalizeServiceFromApi,
  serviceLabel,
} from '../../utils/equipmentHistoryModel';
import { downloadMaintenanceHistoryExcel } from '../../utils/equipmentHistoryExcel';
import { downloadHistoryDocument } from '../../utils/historyDocuments';

const ITEMS_PER_PAGE = 8;
const MAX_PHOTOS = 3;

const FILTER_SEARCH_CLASS =
  'w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500';

function formSnapshotFromRecord(record) {
  return {
    equipmentKeys: [...equipmentKeysFromRecord(record)].sort(),
    season: record.season || '',
    year: record.year || '',
    start: record.start || '',
    finish: record.finish || '',
    observation: record.observation || '',
    action: record.action || '',
    repairCost: record.repairCost || '',
    service: record.service || '',
    maintenanceType: record.maintenanceType || '',
    provider: record.provider || '',
    responsible: record.responsible || '',
    remarks: record.remarks || '',
    photosBefore: [...(record.photosBefore || [])],
    photosAfter: [...(record.photosAfter || [])],
    documents: (record.documents || []).map((doc) => ({ ...doc })),
  };
}

function documentsFormEqual(aDocs, bDocs) {
  const normalize = (docs) => (docs || []).map((doc) => ({
    storageKey: doc.storageKey || '',
    displayName: doc.displayName || '',
    pending: Boolean(doc.pending),
    fileName: doc.file?.name || '',
  }));
  return JSON.stringify(normalize(aDocs)) === JSON.stringify(normalize(bDocs));
}

function historyFormsEqual(a, b) {
  const scalarKeys = [
    'season', 'year', 'start', 'finish', 'observation', 'action',
    'repairCost', 'service', 'maintenanceType', 'provider', 'responsible', 'remarks',
  ];
  for (const key of scalarKeys) {
    if (String(a?.[key] ?? '') !== String(b?.[key] ?? '')) return false;
  }
  const aKeys = [...(a?.equipmentKeys || [])].sort();
  const bKeys = [...(b?.equipmentKeys || [])].sort();
  if (aKeys.length !== bKeys.length || aKeys.some((value, index) => value !== bKeys[index])) {
    return false;
  }
  return JSON.stringify(a?.photosBefore || []) === JSON.stringify(b?.photosBefore || [])
    && JSON.stringify(a?.photosAfter || []) === JSON.stringify(b?.photosAfter || [])
    && documentsFormEqual(a?.documents, b?.documents);
}

function SeasonBadge({ season }) {
  const inSeason = season === 'Season';
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold border tracking-wide uppercase ${
        inSeason
          ? 'bg-[#e2f9f0] text-[#059669] border-[#c1f4e1]'
          : 'bg-[#ffebd6] text-[#ea580c] border-[#ffd8b3]'
      }`}
    >
      {season || '—'}
    </span>
  );
}

function PhotoUploadGrid({ label, photos, onChange, inputRef }) {
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || photos.length >= MAX_PHOTOS) return;
    const data = await resizeImage(file);
    onChange([...photos, data]);
  };

  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-slate-500">{label}</span>
      <div className="grid grid-cols-3 gap-2">
        {photos.map((img, idx) => (
          <div
            key={idx}
            className="relative aspect-square bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-sm"
          >
            <img src={img} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, i) => i !== idx))}
              className="absolute top-1 right-1 bg-slate-950/80 hover:bg-slate-950 text-white p-1 rounded-full"
            >
              <MdClose className="w-2.5 h-2.5" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="aspect-square border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50/50 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-all"
          >
            <MdAdd className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-bold uppercase tracking-wide">Add</span>
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

function documentFileKind(doc) {
  const name = String(doc?.originalName || doc?.file?.name || doc?.displayName || '').toLowerCase();
  const mime = String(doc?.mimeType || doc?.file?.type || '').toLowerCase();
  if (name.endsWith('.pdf') || mime.includes('pdf')) return 'pdf';
  if (name.endsWith('.doc') || name.endsWith('.docx') || mime.includes('word')) return 'word';
  if (name.endsWith('.xls') || name.endsWith('.xlsx') || mime.includes('excel') || mime.includes('spreadsheet')) {
    return 'excel';
  }
  if (name.endsWith('.txt') || mime.startsWith('text/')) return 'text';
  return 'generic';
}

function DocumentFileIcon({ doc, className = 'w-9 h-9' }) {
  switch (documentFileKind(doc)) {
    case 'pdf':
      return <FaFilePdf className={`${className} text-red-500`} aria-hidden />;
    case 'word':
      return <FaFileWord className={`${className} text-blue-600`} aria-hidden />;
    case 'excel':
      return <FaFileExcel className={`${className} text-emerald-600`} aria-hidden />;
    case 'text':
      return <FaFileLines className={`${className} text-slate-600`} aria-hidden />;
    default:
      return <FaFile className={`${className} text-slate-400`} aria-hidden />;
  }
}

function DocumentUploadGrid({ documents, onChange, inputRef }) {
  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || documents.length >= MAX_HISTORY_DOCUMENTS) return;
    onChange([
      ...documents,
      {
        storageKey: null,
        displayName: file.name,
        originalName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        pending: true,
        file,
      },
    ]);
  };

  const updateDisplayName = (index, displayName) => {
    onChange(documents.map((doc, idx) => (idx === index ? { ...doc, displayName } : doc)));
  };

  const removeDocument = (index) => {
    onChange(documents.filter((_, idx) => idx !== index));
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {documents.map((doc, index) => (
          <div key={doc.storageKey || `pending-${index}`} className="min-w-0 space-y-1">
            <div className="relative aspect-square bg-slate-50 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex items-center justify-center">
              <DocumentFileIcon doc={doc} />
              <button
                type="button"
                onClick={() => removeDocument(index)}
                className="absolute top-1 right-1 bg-slate-950/80 hover:bg-slate-950 text-white p-1 rounded-full"
              >
                <MdClose className="w-2.5 h-2.5" />
              </button>
            </div>
            <input
              type="text"
              value={doc.displayName || ''}
              onChange={(e) => updateDisplayName(index, e.target.value)}
              className="w-full px-1 py-0.5 border border-slate-200 rounded-md outline-none text-[10px] text-center bg-white truncate"
              placeholder="Name"
              title={doc.displayName || ''}
            />
          </div>
        ))}
        {documents.length < MAX_HISTORY_DOCUMENTS && (
          <div className="min-w-0 space-y-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="aspect-square w-full border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-slate-50/50 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:text-blue-500 transition-all"
            >
              <MdAdd className="w-5 h-5 mb-1" />
              <span className="text-[10px] font-bold uppercase tracking-wide">Add</span>
            </button>
            <span className="block text-[10px] font-semibold text-slate-400 text-center">Document</span>
          </div>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={HISTORY_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}

export default function EquipmentMaintenanceHistoryHub({
  apiRecords = [],
  totalCount,
  saving = false,
  embedded = false,
  open = true,
  onToggle,
  onSave,
  equipmentOptions = [],
  defaultEquipmentKeys = [],
  exportFileName,
  enableDocuments = false,
  historyApiBase = '',
  equipId = null,
  observationRequired = true,
}) {
  const showEquipmentPicker = equipmentOptions.length > 0;
  const records = useMemo(
    () => apiRecords.map(historyRecordFromApi),
    [apiRecords],
  );

  const equipmentLabelMap = useMemo(() => {
    const map = new Map();
    equipmentOptions.forEach((opt) => map.set(opt.key, opt.label));
    return map;
  }, [equipmentOptions]);

  const resolveEquipmentKeys = (rec) => {
    const keys = rec.equipmentKeys?.length ? rec.equipmentKeys : equipmentKeysFromRecord(rec);
    if (keys.length) return keys;
    return defaultEquipmentKeys.length ? [...defaultEquipmentKeys] : [];
  };

  const labelForRecord = (rec) => {
    const keys = resolveEquipmentKeys(rec);
    if (!keys.length) return '—';
    return keys
      .map((key) => equipmentLabelMap.get(key))
      .filter(Boolean)
      .join(', ') || rec.subSection || '—';
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [seasonFilter, setSeasonFilter] = useState('All');
  const [yearFilter, setYearFilter] = useState('All');
  const [equipmentFilter, setEquipmentFilter] = useState([]);
  const [startSortOrder, setStartSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form, setForm] = useState(EMPTY_HISTORY_FORM);

  const serviceOptions = useMemo(() => {
    const normalized = normalizeServiceFromApi(form.service);
    if (normalized && !HISTORY_SERVICE_OPTIONS.includes(normalized)) {
      return [normalized, ...HISTORY_SERVICE_OPTIONS];
    }
    return HISTORY_SERVICE_OPTIONS;
  }, [form.service]);

  const maintenanceTypeOptions = useMemo(() => {
    const known = HISTORY_MAINTENANCE_TYPE_OPTIONS.map((opt) => opt.value);
    if (form.maintenanceType && !known.includes(form.maintenanceType)) {
      return [
        { value: form.maintenanceType, label: form.maintenanceType },
        ...HISTORY_MAINTENANCE_TYPE_OPTIONS,
      ];
    }
    return HISTORY_MAINTENANCE_TYPE_OPTIONS;
  }, [form.maintenanceType]);

  const [lightboxImage, setLightboxImage] = useState(null);
  const [lightboxCaption, setLightboxCaption] = useState('');

  const fileBeforeRef = useRef(null);
  const fileAfterRef = useRef(null);
  const fileDocRef = useRef(null);
  const editBaselineRef = useRef(null);

  const badge = totalCount ?? records.length;

  const uniqueYears = useMemo(() => {
    const years = records.map((r) => r.year).filter((y) => y && y !== '—');
    return ['All', ...Array.from(new Set(years)).sort((a, b) => b.localeCompare(a))];
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records
      .filter((rec) => {
        const matchesSearch = !q
          || formatEntryId(rec.id).toLowerCase().includes(q)
          || rec.observation.toLowerCase().includes(q)
          || (rec.action && rec.action.toLowerCase().includes(q))
          || String(rec.year).toLowerCase().includes(q)
          || labelForRecord(rec).toLowerCase().includes(q)
          || maintenanceTypeLabel(rec.maintenanceType).toLowerCase().includes(q);

        const matchesSeason = seasonFilter === 'All'
          || (seasonFilter === 'Off-Season' ? isOffSeason(rec.season) : rec.season === seasonFilter);

        const matchesYear = yearFilter === 'All' || rec.year === yearFilter;

        const recKeys = resolveEquipmentKeys(rec);
        const matchesEquipment = equipmentFilter.length === 0
          || recKeys.some((key) => equipmentFilter.includes(key));

        return matchesSearch && matchesSeason && matchesYear && matchesEquipment;
      })
      .sort((a, b) => compareMaintenanceHistoryByDate(a, b, startSortOrder));
  }, [records, searchQuery, seasonFilter, yearFilter, equipmentFilter, equipmentLabelMap, startSortOrder]);

  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  const openAdd = () => {
    setIsEditing(false);
    setSelectedRecord(null);
    editBaselineRef.current = null;
    setForm({
      ...EMPTY_HISTORY_FORM,
      equipmentKeys: equipmentOptions[0]?.key
        ? [equipmentOptions[0].key]
        : (defaultEquipmentKeys.length ? [...defaultEquipmentKeys] : []),
    });
    setFormOpen(true);
  };

  const openEdit = (record, e) => {
    if (e) e.stopPropagation();
    setIsEditing(true);
    setSelectedRecord(record);
    const snapshot = formSnapshotFromRecord(record);
    editBaselineRef.current = snapshot;
    setForm({
      equipmentKeys: [...snapshot.equipmentKeys],
      season: snapshot.season,
      year: snapshot.year,
      start: snapshot.start,
      finish: snapshot.finish,
      observation: snapshot.observation,
      action: snapshot.action,
      repairCost: snapshot.repairCost,
      service: snapshot.service,
      maintenanceType: snapshot.maintenanceType,
      provider: snapshot.provider,
      responsible: snapshot.responsible,
      remarks: snapshot.remarks,
      photosBefore: [...snapshot.photosBefore],
      photosAfter: [...snapshot.photosAfter],
      documents: (snapshot.documents || []).map((doc) => ({ ...doc })),
    });
    setDetailOpen(false);
    setFormOpen(true);
  };

  const openDetail = (record) => {
    setSelectedRecord(record);
    setDetailOpen(true);
  };

  const handleStartChange = (value) => {
    setForm((f) => ({
      ...f,
      start: value,
      year: value ? value.split('-')[0] : '',
    }));
  };

  const canSave = useMemo(() => {
    if (!form.season?.trim()) return false;
    if (observationRequired) {
      if (!form.start?.trim()) return false;
      if (!form.observation?.trim()) return false;
    } else {
      if (!form.year?.trim()) return false;
    }
    if (showEquipmentPicker && (!form.equipmentKeys || form.equipmentKeys.length === 0)) return false;
    if (isEditing) {
      if (!editBaselineRef.current) return false;
      return !historyFormsEqual(form, editBaselineRef.current);
    }
    return true;
  }, [form, isEditing, showEquipmentPicker, observationRequired]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    await onSave(form, isEditing ? 'edit' : 'add', selectedRecord?.id);
    setFormOpen(false);
  };

  const downloadImage = (src, name) => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `${name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadDocument = async (record, doc) => {
    if (!enableDocuments || !historyApiBase || !equipId || !record?.id || doc.pending) return;
    try {
      await downloadHistoryDocument(historyApiBase, equipId, record.id, doc);
    } catch {
      /* caller may toast */
    }
  };

  const handleDownloadExcel = () => {
    if (!records.length) return;
    const baseName = (exportFileName || 'Equipment_Maintenance_History')
      .replace(/[^\w\s-]/g, '')
      .trim()
      .replace(/\s+/g, '_');
    downloadMaintenanceHistoryExcel(records, {
      includeEquipmentColumns: showEquipmentPicker,
      getEquipmentLabel: labelForRecord,
      sortOrder: startSortOrder,
      filename: `${baseName}_${new Date().toISOString().slice(0, 10)}.xlsx`,
    });
  };

  const seasonFilterOptions = useMemo(() => ([
    { value: 'All', label: 'All Seasons' },
    { value: 'Off-Season', label: 'Off-Season' },
    { value: 'Season', label: 'Season' },
  ]), []);

  const yearFilterOptions = useMemo(
    () => uniqueYears.map((yr) => ({
      value: yr,
      label: yr === 'All' ? 'All Years' : yr,
    })),
    [uniqueYears],
  );

  const sortFilterOptions = useMemo(() => ([
    { value: 'desc', label: 'Start: Newest first' },
    { value: 'asc', label: 'Start: Oldest first' },
  ]), []);

  const toolbar = (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 bg-slate-50/40">
      <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search IDs, observations, actions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className={FILTER_SEARCH_CLASS}
          />
        </div>

        <ToolbarFilterSelect
          value={seasonFilter}
          onChange={(value) => {
            setSeasonFilter(value);
            setCurrentPage(1);
          }}
          options={seasonFilterOptions}
        />

        <ToolbarFilterSelect
          value={yearFilter}
          onChange={(value) => {
            setYearFilter(value);
            setCurrentPage(1);
          }}
          options={yearFilterOptions}
        />

        {showEquipmentPicker && (
          <EquipmentMultiSelectDropdown
            options={equipmentOptions}
            value={equipmentFilter}
            onChange={(keys) => {
              setEquipmentFilter(keys);
              setCurrentPage(1);
            }}
            labelMap={equipmentLabelMap}
            emptyLabel="All Equipment"
            variant="toolbar"
            triggerMinWidth="14rem"
            panelMinWidth={280}
          />
        )}

        <ToolbarFilterSelect
          value={startSortOrder}
          onChange={(value) => {
            setStartSortOrder(value);
            setCurrentPage(1);
          }}
          options={sortFilterOptions}
          minWidth="11.5rem"
          panelMinWidth={188}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
        <button
          type="button"
          onClick={handleDownloadExcel}
          disabled={records.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MdDownload className="w-3.5 h-3.5" />
          Download Excel
        </button>
        <button
          type="button"
          onClick={openAdd}
          disabled={showEquipmentPicker && equipmentOptions.length === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MdAdd className="w-3.5 h-3.5" />
          Add Record
        </button>
      </div>
    </div>
  );

  const desktopTable = (
    <div className="hidden md:block overflow-x-auto px-4 md:px-6 py-4">
      <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm bg-white">
        <table className="w-full border-collapse text-left text-xs font-semibold text-slate-500">
          <thead className="bg-[#f8fafc]/90 border-b border-slate-100 text-[11px] uppercase tracking-wider text-slate-400 font-bold">
            <tr>
              <th className="px-5 py-4 w-[110px]">Entry ID</th>
              {showEquipmentPicker && <th className="px-5 py-4 w-[140px]">Equipment</th>}
              <th className="px-5 py-4 w-[130px]">Season</th>
              <th className="px-5 py-4 w-[80px]">Year</th>
              <th className="px-5 py-4 w-[105px]">Start</th>
              <th className="px-5 py-4 w-[105px]">Finish</th>
              <th className="px-5 py-4 w-[100px]">Maint. Type</th>
              <th className="px-5 py-4">Observation</th>
              <th className="px-5 py-4">Action</th>
              <th className="px-5 py-4 w-[120px] text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-600">
            {paginatedRecords.length > 0 ? paginatedRecords.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                onClick={() => openDetail(row)}
              >
                <td className="px-5 py-3.5 font-mono font-bold text-slate-800">{formatEntryId(row.id)}</td>
                {showEquipmentPicker && (
                  <td className="px-5 py-3.5 text-slate-800 font-semibold max-w-[140px] truncate" title={labelForRecord(row)}>
                    {labelForRecord(row)}
                  </td>
                )}
                <td className="px-5 py-3.5"><SeasonBadge season={row.season} /></td>
                <td className="px-5 py-3.5 text-slate-500">{row.year || '—'}</td>
                <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{formatDateDisplay(row.start)}</td>
                <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">{formatDateDisplay(row.finish)}</td>
                <td
                  className="px-5 py-3.5 text-slate-700 font-semibold whitespace-nowrap"
                  title={maintenanceTypeLabel(row.maintenanceType) || undefined}
                >
                  {row.maintenanceType || '—'}
                </td>
                <td className="px-5 py-3.5 max-w-xs truncate text-slate-800" title={row.observation}>{row.observation || '—'}</td>
                <td className="px-5 py-3.5 max-w-xs whitespace-pre-line text-slate-800" title={row.action}>{row.action || '—'}</td>
                <td className="px-5 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={() => openDetail(row)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg" title="View">
                      <MdVisibility className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={(e) => openEdit(row, e)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                      <MdEdit className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={showEquipmentPicker ? 10 : 9} className="px-5 py-12 text-center text-slate-400">
                  <MdInfo className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600 text-sm">No maintenance records found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const mobileCards = (
    <div className="md:hidden px-4 py-4 space-y-3">
      {paginatedRecords.length > 0 ? paginatedRecords.map((row) => (
        <div key={row.id} className="bg-white rounded-2xl p-4 border border-slate-200/60 shadow-sm space-y-3">
          {showEquipmentPicker && (
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600 truncate">
              {labelForRecord(row)}
            </p>
          )}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="bg-slate-100 text-slate-600 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0">
                {formatEntryId(row.id)}
              </span>
              <h3 className="text-xs font-bold text-slate-800 truncate">{row.observation || row.action || '—'}</h3>
            </div>
            <SeasonBadge season={row.season} />
          </div>
          <p className="text-[11px] text-slate-600">
            <span className="text-slate-400 font-bold">Timeline:</span>{' '}
            {formatDateDisplay(row.start)} – {formatDateDisplay(row.finish)}
          </p>
          {row.maintenanceType && (
            <p className="text-[11px] text-slate-600">
              <span className="text-slate-400 font-bold">Maint. Type:</span>{' '}
              {maintenanceTypeLabel(row.maintenanceType)}
            </p>
          )}
          <p className="text-[11px] text-slate-600 line-clamp-3 whitespace-pre-line">{row.action || '—'}</p>
          <div className="flex items-center justify-between pt-1 border-t border-slate-50">
            <span className="text-[9px] text-slate-400 font-bold uppercase">
              {row.photosBefore?.length || 0} before / {row.photosAfter?.length || 0} after
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => openDetail(row)} className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-500">
                <MdVisibility className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={(e) => openEdit(row, e)} className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-blue-600">
                <MdEdit className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )) : (
        <div className="bg-white rounded-2xl p-8 text-center text-slate-400 border border-slate-100">
          <MdInfo className="w-7 h-7 mx-auto mb-2 text-slate-300" />
          <p className="text-xs font-bold text-slate-600">No records found</p>
        </div>
      )}
    </div>
  );

  const pagination = filteredRecords.length > ITEMS_PER_PAGE ? (
    <div className="px-4 md:px-6 pb-6 pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-semibold text-slate-500">
      <div>
        Showing{' '}
        <span className="text-slate-800">{filteredRecords.length > 0 ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0}</span>
        {' '}to{' '}
        <span className="text-slate-800">{Math.min(currentPage * ITEMS_PER_PAGE, filteredRecords.length)}</span>
        {' '}of <span className="text-slate-800">{filteredRecords.length}</span> records
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
          className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
        >
          <MdChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: totalPages }).map((_, i) => (
          <button
            key={i + 1}
            type="button"
            onClick={() => setCurrentPage(i + 1)}
            className={`px-3 py-1.5 rounded-lg border text-xs ${
              currentPage === i + 1
                ? 'bg-blue-600 border-blue-600 text-white font-bold'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {i + 1}
          </button>
        ))}
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
          className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50"
        >
          <MdChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  ) : null;

  const formModal = formOpen && (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] p-4 flex items-end sm:items-center justify-center overflow-y-auto">
      <div className="bg-white shadow-2xl border border-slate-100 flex flex-col w-full max-w-2xl rounded-t-3xl sm:rounded-xl max-h-[92vh] sm:my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-base font-bold text-slate-800">
              {isEditing ? 'Edit History Record' : 'Add History Record'}
            </h3>
            {isEditing && selectedRecord && (
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                ID: {formatEntryId(selectedRecord.id)}
              </span>
            )}
          </div>
          <button type="button" onClick={() => setFormOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4 text-sm">
            {showEquipmentPicker && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Equipment <span className="text-red-500">*</span>
                </label>
                <EquipmentMultiSelectDropdown
                  options={equipmentOptions}
                  value={form.equipmentKeys || []}
                  onChange={(keys) => setForm((f) => ({ ...f, equipmentKeys: keys }))}
                  labelMap={equipmentLabelMap}
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Season <span className="text-red-500">*</span>
                </label>
                <select
                  value={form.season}
                  onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
                >
                  <option value="">— Select —</option>
                  <option value="Off-Season">Off-Season</option>
                  <option value="Season">Season</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Year {!observationRequired && <span className="text-red-500">*</span>}
                  {observationRequired && (
                    <span className="text-slate-400 font-normal">(from start date)</span>
                  )}
                </label>
                <input
                  type="text"
                  readOnly={observationRequired}
                  value={form.year}
                  onChange={observationRequired
                    ? undefined
                    : (e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  placeholder={observationRequired ? 'From start date' : 'e.g. 2019'}
                  className={`w-full px-3 py-2 border border-slate-200 rounded-lg text-sm ${
                    observationRequired
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                      : 'outline-none'
                  }`}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Date of Start {observationRequired && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="date"
                  value={form.start}
                  onChange={(e) => handleStartChange(e.target.value)}
                  required={observationRequired}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Date of Finish</label>
                <input
                  type="date"
                  value={form.finish}
                  onChange={(e) => setForm((f) => ({ ...f, finish: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Outage / Observation {observationRequired && <span className="text-red-500">*</span>}
              </label>
              <textarea
                rows={2}
                required={observationRequired}
                value={form.observation}
                onChange={(e) => setForm((f) => ({ ...f, observation: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Action Taken</label>
              <textarea
                rows={3}
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Maintenance Type</label>
                <select
                  value={form.maintenanceType}
                  onChange={(e) => setForm((f) => ({ ...f, maintenanceType: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
                >
                  <option value="">— Select —</option>
                  {maintenanceTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Repair Cost (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  value={form.repairCost}
                  onChange={(e) => setForm((f) => ({ ...f, repairCost: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Service</label>
                <select
                  value={form.service}
                  onChange={(e) => setForm((f) => ({ ...f, service: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
                >
                  <option value="">— Select —</option>
                  {serviceOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Provider</label>
                <input
                  type="text"
                  value={form.provider}
                  onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Responsible</label>
                <input
                  type="text"
                  value={form.responsible}
                  onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Remarks</label>
              <input
                type="text"
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg outline-none text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Service Photos (max {MAX_PHOTOS} each)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <PhotoUploadGrid
                  label="Before Service"
                  photos={form.photosBefore}
                  onChange={(photosBefore) => setForm((f) => ({ ...f, photosBefore }))}
                  inputRef={fileBeforeRef}
                />
                <PhotoUploadGrid
                  label="After Service"
                  photos={form.photosAfter}
                  onChange={(photosAfter) => setForm((f) => ({ ...f, photosAfter }))}
                  inputRef={fileAfterRef}
                />
              </div>
            </div>

            {enableDocuments && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                  Documents (max {MAX_HISTORY_DOCUMENTS})
                </label>
                {/* Match photo thumb size: half-width column + 3-col grid (same as Before/After) */}
                <div className="w-full sm:w-1/2">
                  <DocumentUploadGrid
                    documents={form.documents || []}
                    onChange={(documents) => setForm((f) => ({ ...f, documents }))}
                    inputRef={fileDocRef}
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">PDF, Word, text, or Excel · max 10 MB each</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 sticky bottom-0 bg-white">
            <button type="button" onClick={() => setFormOpen(false)} className="px-5 py-2.5 border border-slate-200 rounded-lg text-slate-600 font-bold text-xs">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !canSave}
              className="px-5 py-2.5 bg-[#2563eb] hover:bg-blue-700 text-white font-bold rounded-lg text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {saving ? <Spinner size="sm" /> : <MdSave className="w-4 h-4" />}
                {isEditing ? 'Save' : 'Add'}
              </button>
          </div>
        </form>
      </div>
    </div>
  );

  const detailModal = detailOpen && selectedRecord && (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-[2px] p-4 flex items-end sm:items-center justify-center overflow-y-auto">
      <div className="bg-white shadow-xl border border-slate-100 flex flex-col w-full max-w-xl rounded-t-3xl sm:rounded-2xl max-h-[92vh] sm:my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Full Record Details</h3>
            <span className="text-[11px] font-bold text-slate-800 font-mono">ID: {formatEntryId(selectedRecord.id)}</span>
          </div>
          <button type="button" onClick={() => setDetailOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
            <MdClose className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-sm">
          {showEquipmentPicker && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase">Equipment</span>
              <span className="text-sm font-semibold text-slate-800">{labelForRecord(selectedRecord)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase">Season</span>
            <SeasonBadge season={selectedRecord.season} />
          </div>

          <div className="grid grid-cols-3 gap-2 border-y border-slate-100 py-4 text-center bg-slate-50/30 rounded-xl">
            <div>
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Year</span>
              <span className="text-sm font-bold text-slate-700">{selectedRecord.year || '—'}</span>
            </div>
            <div className="border-x border-slate-100">
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Start</span>
              <span className="text-sm font-semibold">{formatDateDisplay(selectedRecord.start)}</span>
            </div>
            <div>
              <span className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Finish</span>
              <span className="text-sm font-semibold">{formatDateDisplay(selectedRecord.finish)}</span>
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Outage / Observation</span>
            <p className="text-slate-800 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 font-semibold">{selectedRecord.observation || '—'}</p>
          </div>
          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1.5">Action Taken</span>
            <p className="text-slate-600 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 whitespace-pre-line">{selectedRecord.action || '—'}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-100 pt-4">
            <div className="sm:col-span-2">
              <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Maintenance Type</span>
              <span className="text-sm font-semibold text-slate-700">
                {maintenanceTypeLabel(selectedRecord.maintenanceType) || '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Repair Cost</span>
              <span className="text-sm font-bold text-emerald-600">
                {selectedRecord.repairCost ? `₹ ${Number(selectedRecord.repairCost).toLocaleString()}` : '—'}
              </span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Service</span>
              <span className="text-sm font-semibold text-slate-700">{serviceLabel(selectedRecord.service) || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Provider</span>
              <span className="text-sm font-semibold text-slate-700">{selectedRecord.provider || '—'}</span>
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Responsible</span>
              <span className="text-sm font-semibold text-slate-700">{selectedRecord.responsible || '—'}</span>
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-400 uppercase mb-1">Remarks</span>
            <span className="text-sm text-slate-600 italic block">{selectedRecord.remarks || 'No notes'}</span>
          </div>

          {enableDocuments && selectedRecord.documents?.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase block mb-2">
                Documents ({selectedRecord.documents.length})
              </span>
              <div className="space-y-2">
                {selectedRecord.documents.map((doc, idx) => (
                  <button
                    key={doc.storageKey || idx}
                    type="button"
                    onClick={() => handleDownloadDocument(selectedRecord, doc)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors"
                  >
                    <DocumentFileIcon doc={doc} className="w-6 h-6 shrink-0" />
                    <span className="text-sm font-semibold text-slate-700 truncate flex-1">{doc.displayName}</span>
                    <MdDownload className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {(selectedRecord.photosBefore?.length > 0 || selectedRecord.photosAfter?.length > 0) && (
            <div className="border-t border-slate-100 pt-4 space-y-4">
              {selectedRecord.photosBefore?.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Before ({selectedRecord.photosBefore.length})</span>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedRecord.photosBefore.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setLightboxImage(img); setLightboxCaption(`Before #${idx + 1}`); }}
                        className="h-20 rounded-xl border overflow-hidden"
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedRecord.photosAfter?.length > 0 && (
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">After ({selectedRecord.photosAfter.length})</span>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedRecord.photosAfter.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => { setLightboxImage(img); setLightboxCaption(`After #${idx + 1}`); }}
                        className="h-20 rounded-xl border overflow-hidden"
                      >
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-white">
          <button
            type="button"
            onClick={(e) => openEdit(selectedRecord, e)}
            className="px-4 py-2 border border-slate-200 text-blue-600 font-semibold rounded-lg text-xs flex items-center gap-1"
          >
            <MdEdit className="w-3.5 h-3.5" />
            Edit
          </button>
          <button type="button" onClick={() => setDetailOpen(false)} className="px-4 py-2 bg-slate-800 text-white font-semibold rounded-lg text-xs">
            Close
          </button>
        </div>
      </div>
    </div>
  );

  const lightbox = lightboxImage && (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-slate-950/95 p-4"
      onClick={() => setLightboxImage(null)}
    >
      <div className="w-full max-w-3xl flex justify-between text-white mb-2 px-2">
        <span className="text-xs font-bold uppercase text-slate-300">{lightboxCaption}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); downloadImage(lightboxImage, lightboxCaption); }}
            className="inline-flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg"
          >
            <MdDownload className="w-3.5 h-3.5" />
            Download
          </button>
          <button type="button" onClick={() => setLightboxImage(null)} className="text-slate-300 hover:text-white p-1">
            <MdClose className="w-4 h-4" />
          </button>
        </div>
      </div>
      <img
        src={lightboxImage}
        alt=""
        className="max-w-full max-h-[70vh] object-contain rounded-xl border border-white/10"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );

  const body = (
    <>
      {toolbar}
      {desktopTable}
      {mobileCards}
      {pagination}
      {formModal}
      {detailModal}
      {lightbox}
    </>
  );

  if (embedded) {
    return (
      <EquipmentSectionShell
        title="Equipment Maintenance History"
        badge={badge}
        open={open}
        onToggle={onToggle}
      >
        {body}
      </EquipmentSectionShell>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-xl font-bold text-slate-800">Equipment Maintenance History</h2>
      </div>
      {body}
    </div>
  );
}
