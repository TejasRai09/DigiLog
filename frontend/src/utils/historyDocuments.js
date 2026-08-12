import api from '../api/axios';
import {
  MAX_HISTORY_DOCUMENTS,
  historyRecordToApi,
  serializeHistoryDocumentsForApi,
} from './equipmentHistoryModel';

function documentFileName(storageKey) {
  const parts = String(storageKey || '').split('/');
  return parts[parts.length - 1] || '';
}

export async function uploadHistoryDocument(apiBase, equipId, historyId, file, displayName) {
  const fd = new FormData();
  fd.append('document', file);
  fd.append('displayName', displayName || file.name);
  const { data } = await api.post(
    `${apiBase}/${equipId}/history/${historyId}/documents`,
    fd,
  );
  return data.document;
}

export async function downloadHistoryDocument(apiBase, equipId, historyId, doc, fallbackName = 'document') {
  const fileName = documentFileName(doc.storageKey);
  if (!fileName) throw new Error('Invalid document.');
  const response = await api.get(
    `${apiBase}/${equipId}/history/${historyId}/documents/${encodeURIComponent(fileName)}`,
    { responseType: 'blob' },
  );
  const blob = response.data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.displayName || fallbackName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function saveHistoryWithDocuments({
  apiBase,
  equipId,
  form,
  mode,
  recordId,
}) {
  const body = historyRecordToApi(form);
  const savedDocs = (form.documents || []).filter((doc) => !doc.pending && doc.storageKey);
  const pendingDocs = (form.documents || []).filter((doc) => doc.pending && doc.file);

  body.documents = serializeHistoryDocumentsForApi(savedDocs);

  let historyId = recordId;
  if (mode === 'add') {
    const { data } = await api.post(`${apiBase}/${equipId}/history`, body);
    historyId = data.id;
  } else {
    await api.put(`${apiBase}/${equipId}/history/${historyId}`, body);
  }

  let uploadedCount = 0;
  for (const doc of pendingDocs) {
    if (savedDocs.length + uploadedCount >= MAX_HISTORY_DOCUMENTS) break;
    await uploadHistoryDocument(apiBase, equipId, historyId, doc.file, doc.displayName);
    uploadedCount += 1;
  }

  return historyId;
}

export { documentFileName };
