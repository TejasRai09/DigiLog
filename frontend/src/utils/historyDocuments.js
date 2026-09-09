import api from '../api/axios';
import {
  MAX_HISTORY_DOCUMENTS,
  getOversizedHistoryDocumentError,
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

export async function uploadApprovalHistoryDocument(apiBase, equipId, approvalRequestId, file, displayName) {
  const fd = new FormData();
  fd.append('document', file);
  fd.append('displayName', displayName || file.name);
  const { data } = await api.post(
    `${apiBase}/${equipId}/history-approval/${approvalRequestId}/documents`,
    fd,
  );
  return data.document;
}

export async function deleteApprovalStagedDocument(apiBase, equipId, approvalRequestId, stagedFileName) {
  const name = String(stagedFileName || '').trim();
  if (!name) throw new Error('Invalid document.');
  await api.delete(
    `${apiBase}/${equipId}/history-approval/${approvalRequestId}/documents/${encodeURIComponent(name)}`,
  );
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

/** Download a document still staged on a pending approval request. */
export async function downloadApprovalStagedDocument(doc, fallbackName = 'document') {
  const requestId = Number(doc.approvalRequestId);
  const name = String(doc.stagedFileName || '').trim();
  if (!requestId || !name) throw new Error('Invalid staged document.');
  const response = await api.get(`/approvals/${requestId}/documents`, {
    params: { source: 'staged', name, disposition: 'attachment' },
    responseType: 'blob',
  });
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

/**
 * Saves history first, then uploads pending documents.
 * Validates document size BEFORE creating/queuing the history row so a failed
 * upload cannot leave an orphaned DB row or approval request.
 */
export async function saveHistoryWithDocuments({
  apiBase,
  equipId,
  form,
  mode,
  recordId,
}) {
  const oversized = getOversizedHistoryDocumentError(form?.documents);
  if (oversized) {
    const err = new Error(oversized);
    err.status = 400;
    throw err;
  }

  const body = historyRecordToApi(form);
  const savedDocs = (form.documents || []).filter((doc) => (
    doc
    && !doc.pending
    && !doc.staged
    && doc.storageKey
    && !String(doc.storageKey).startsWith('staged:')
  ));
  const pendingDocs = (form.documents || []).filter((doc) => doc.pending && doc.file);
  const alreadyStagedCount = (form.documents || []).filter((doc) => doc.staged).length;

  body.documents = serializeHistoryDocumentsForApi(savedDocs);

  let historyId = recordId;
  let response;

  if (mode === 'add') {
    response = await api.post(`${apiBase}/${equipId}/history`, body);
    historyId = response.data.id;
  } else {
    response = await api.put(`${apiBase}/${equipId}/history/${historyId}`, body);
  }

  if (response.status === 202 || response.data?.pending) {
    const approvalRequestId = response.data.approvalRequestId;
    const uploadErrors = [];
    let uploadedCount = 0;
    for (const doc of pendingDocs) {
      if (savedDocs.length + alreadyStagedCount + uploadedCount >= MAX_HISTORY_DOCUMENTS) break;
      try {
        await uploadApprovalHistoryDocument(
          apiBase,
          equipId,
          approvalRequestId,
          doc.file,
          doc.displayName,
        );
        uploadedCount += 1;
      } catch (err) {
        uploadErrors.push(err.response?.data?.message || err.message || 'Upload failed');
      }
    }
    if (uploadErrors.length) {
      const err = new Error(
        pendingDocs.length > 1 && uploadedCount > 0
          ? `Sent for approval, but only ${uploadedCount} of ${pendingDocs.length} documents uploaded (${uploadErrors[0]}).`
          : `Sent for approval, but document upload failed: ${uploadErrors[0]}`,
      );
      err.pendingCreated = true;
      err.approvalRequestId = approvalRequestId;
      throw err;
    }
    return { pending: true, approvalRequestId };
  }

  let uploadedCount = 0;
  for (const doc of pendingDocs) {
    if (savedDocs.length + uploadedCount >= MAX_HISTORY_DOCUMENTS) break;
    await uploadHistoryDocument(apiBase, equipId, historyId, doc.file, doc.displayName);
    uploadedCount += 1;
  }

  return historyId;
}

/**
 * Resubmit a needs_modification request and sync staged documents
 * (delete removed staged files, upload newly added files) before flipping status.
 */
export async function resubmitHistoryWithDocuments({
  apiBase,
  equipId,
  form,
  approvalRequestId,
  previousDocuments = [],
}) {
  const oversized = getOversizedHistoryDocumentError(form?.documents);
  if (oversized) {
    const err = new Error(oversized);
    err.status = 400;
    throw err;
  }

  const keepStagedNames = new Set(
    (form.documents || [])
      .filter((doc) => doc?.staged && doc.stagedFileName)
      .map((doc) => String(doc.stagedFileName)),
  );
  const previousStaged = (previousDocuments || []).filter(
    (doc) => doc?.staged && doc.stagedFileName,
  );

  const deleteErrors = [];
  for (const doc of previousStaged) {
    const name = String(doc.stagedFileName);
    if (keepStagedNames.has(name)) continue;
    try {
      await deleteApprovalStagedDocument(apiBase, equipId, approvalRequestId, name);
    } catch (err) {
      deleteErrors.push(err.response?.data?.message || err.message || 'Delete failed');
    }
  }
  if (deleteErrors.length) {
    throw new Error(`Could not remove document(s): ${deleteErrors[0]}`);
  }

  const savedDocs = (form.documents || []).filter((doc) => (
    doc
    && !doc.pending
    && !doc.staged
    && doc.storageKey
    && !String(doc.storageKey).startsWith('staged:')
  ));
  const pendingDocs = (form.documents || []).filter((doc) => doc.pending && doc.file);
  let uploadedCount = 0;
  const uploadErrors = [];
  for (const doc of pendingDocs) {
    if (savedDocs.length + keepStagedNames.size + uploadedCount >= MAX_HISTORY_DOCUMENTS) break;
    try {
      await uploadApprovalHistoryDocument(
        apiBase,
        equipId,
        approvalRequestId,
        doc.file,
        doc.displayName,
      );
      uploadedCount += 1;
    } catch (err) {
      uploadErrors.push(err.response?.data?.message || err.message || 'Upload failed');
    }
  }
  if (uploadErrors.length) {
    throw new Error(
      pendingDocs.length > 1 && uploadedCount > 0
        ? `Only ${uploadedCount} of ${pendingDocs.length} new documents uploaded (${uploadErrors[0]}).`
        : `Document upload failed: ${uploadErrors[0]}`,
    );
  }

  const body = historyRecordToApi(form);
  body.documents = serializeHistoryDocumentsForApi(savedDocs);
  await api.put(`/change-requests/${approvalRequestId}/resubmit`, body);
  return { pending: true, approvalRequestId, resubmitted: true };
}

export { documentFileName };
