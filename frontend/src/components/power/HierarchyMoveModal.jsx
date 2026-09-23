import { useEffect, useMemo, useState } from 'react';
import {
  MdCheckCircle,
  MdChevronRight,
  MdClose,
  MdDriveFileMove,
  MdFolder,
  MdRadioButtonUnchecked,
} from 'react-icons/md';
import {
  findNodeById,
  findNodeByPath,
  hierarchyMoveBlockReason,
  hierarchyMoveParentDepth,
  isHierarchyGroup,
  pathIdsForNodeId,
  pathLabels,
} from '../../utils/hierarchyTreeUtils';

function folderDepth(tree, node) {
  if (!tree || !node) return 0;
  return pathIdsForNodeId(tree, node.id).length;
}

export default function HierarchyMoveModal({
  tree,
  sourceNodes = [],
  onClose,
  onConfirm,
  saving = false,
}) {
  const [browsePathIds, setBrowsePathIds] = useState(() => (tree ? [tree.id] : []));
  const [selectedId, setSelectedId] = useState(null);

  const sourceDepth = sourceNodes[0] ? folderDepth(tree, sourceNodes[0]) : 0;
  const requiredParentDepth = hierarchyMoveParentDepth(sourceDepth);

  useEffect(() => {
    if (tree) setBrowsePathIds([tree.id]);
    setSelectedId(null);
  }, [tree, sourceNodes]);

  useEffect(() => {
    if (saving) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [saving, onClose]);

  const browseFolder = useMemo(
    () => findNodeByPath(tree, browsePathIds) || tree,
    [tree, browsePathIds],
  );

  useEffect(() => {
    if (!browseFolder) return;
    if (folderDepth(tree, browseFolder) !== requiredParentDepth) return;
    setSelectedId((prev) => prev || String(browseFolder.id));
  }, [browseFolder, tree, requiredParentDepth]);

  const crumbs = pathLabels(tree, browsePathIds);
  const browseDepth = folderDepth(tree, browseFolder);

  const childFolders = useMemo(
    () => (browseFolder?.children || []).filter(isHierarchyGroup),
    [browseFolder],
  );

  const listedFolders = childFolders.filter((node) => {
    const depth = folderDepth(tree, node);
    return depth <= requiredParentDepth;
  });

  const selectedNode = selectedId ? findNodeById(tree, selectedId) : null;
  const selectedReason = selectedNode
    ? hierarchyMoveBlockReason(tree, sourceNodes, selectedNode)
    : 'Select a destination folder.';

  const count = sourceNodes.length;
  const thisFolderReason = browseFolder
    ? hierarchyMoveBlockReason(tree, sourceNodes, browseFolder)
    : 'Select a destination folder.';
  const canSelectThisFolder = browseDepth === requiredParentDepth;

  const goToPath = (nextPathIds) => {
    setBrowsePathIds(nextPathIds);
    setSelectedId(null);
  };

  const selectFolder = (node) => {
    if (!node) return;
    setSelectedId(String(node.id));
  };

  const handleFolderClick = (node) => {
    const depth = folderDepth(tree, node);
    if (depth < requiredParentDepth) {
      goToPath(pathIdsForNodeId(tree, node.id));
      return;
    }
    if (depth === requiredParentDepth) selectFolder(node);
  };

  const handleMoveHere = () => {
    if (selectedReason || !selectedNode || saving) return;
    onConfirm(Number(selectedNode.dbId || selectedNode.id));
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-[1px]"
        aria-label="Close"
        onClick={() => !saving && onClose()}
      />
      <div className="relative flex max-h-[min(80vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-gray-900">
              <MdDriveFileMove className="h-5 w-5 text-amber-600" />
              Move items
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {count === 1 ? '1 item selected' : `${count} items selected`}
              {' · '}
              Select a destination folder, then click Move here.
            </p>
          </div>
          <button
            type="button"
            onClick={() => !saving && onClose()}
            disabled={saving}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40"
            aria-label="Close"
          >
            <MdClose className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-5 py-2.5 text-xs">
          {crumbs.map((label, index) => {
            const path = browsePathIds.slice(0, index + 1);
            const isLast = index === crumbs.length - 1;
            return (
              <span key={`${path.join('-')}-${label}`} className="flex items-center gap-1 min-w-0">
                {index > 0 ? <MdChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" /> : null}
                {isLast ? (
                  <span className="truncate font-semibold text-slate-800">{label}</span>
                ) : (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => goToPath(path)}
                    className="truncate text-amber-700 hover:underline disabled:opacity-50"
                  >
                    {label}
                  </button>
                )}
              </span>
            );
          })}
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {canSelectThisFolder ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => selectFolder(browseFolder)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left ${
                String(selectedId) === String(browseFolder?.id)
                  ? 'bg-amber-50 ring-1 ring-amber-200'
                  : 'hover:bg-slate-50'
              }`}
            >
              {String(selectedId) === String(browseFolder?.id) ? (
                <MdCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              ) : (
                <MdRadioButtonUnchecked className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
              )}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">
                  This folder · {browseFolder?.name}
                </span>
                <span className="text-xs text-slate-500">
                  {thisFolderReason || 'Move selected items into this folder.'}
                </span>
              </span>
            </button>
          ) : null}

          {listedFolders.length === 0 && !canSelectThisFolder ? (
            <p className="px-3 py-8 text-center text-sm text-slate-500">
              No folders here. Use the path above to go back.
            </p>
          ) : (
            listedFolders.map((node) => {
              const depth = folderDepth(tree, node);
              const canSelect = depth === requiredParentDepth;
              const reason = canSelect ? hierarchyMoveBlockReason(tree, sourceNodes, node) : null;
              const selected = String(selectedId) === String(node.id);
              const childCount = node.children?.length ?? 0;
              return (
                <button
                  key={node.id}
                  type="button"
                  disabled={saving}
                  onClick={() => handleFolderClick(node)}
                  className={`flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left ${
                    selected ? 'bg-amber-50 ring-1 ring-amber-200' : 'hover:bg-slate-50'
                  }`}
                >
                  {canSelect ? (
                    selected ? (
                      <MdCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    ) : (
                      <MdRadioButtonUnchecked className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                    )
                  ) : (
                    <MdFolder className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">{node.name}</span>
                    <span className="text-xs text-slate-500">
                      {canSelect
                        ? (reason || 'Select this folder, then click Move here.')
                        : `${childCount} item${childCount !== 1 ? 's' : ''} · Open to choose a destination`}
                    </span>
                  </span>
                  {!canSelect ? (
                    <MdChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-slate-300" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
          <p className="min-w-0 text-xs text-slate-500">
            {selectedReason || `Move into ${selectedNode?.name || 'this folder'}.`}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || Boolean(selectedReason)}
              onClick={handleMoveHere}
              className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-50 disabled:text-slate-400 enabled:border-amber-200 enabled:bg-amber-50 enabled:text-amber-800 enabled:hover:bg-amber-100"
            >
              <MdDriveFileMove className="h-3.5 w-3.5" />
              Move here
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
