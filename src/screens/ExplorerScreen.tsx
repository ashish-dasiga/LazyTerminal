import React, { useState, useEffect } from 'react';
import { useRelay } from '../context/RelayContext';
import { ProjectFile } from '../types/relay';
import {
  Folder,
  FileText,
  FileCode,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Save,
  Eye,
  Edit3,
  Check,
  X,
  FilePlus,
  FolderPlus,
  ArrowLeft,
  Terminal,
  ExternalLink,
  AlertCircle,
  Trash2,
  Loader2,
  RefreshCw,
  Pencil,
} from 'lucide-react';

export function ExplorerScreen() {
  const {
    activeProject,
    activeFile,
    setActiveFile,
    saveFileContent,
    createFile,
    createFolder,
    renameProjectFile,
    unsavedFiles,
    setUnsavedDraft,
    fileModal,
    setFileModal,
    setMobileNav,
    setIsWorkspacePickerOpen,
    executeCommand,
    loadFileContent,
    deleteProjectFile,
    fileLoading,
    fileError,
    clearFileError,
    refreshFiles,
  } = useRelay();

  // Navigation path stack inside current project
  const [currentDirStack, setCurrentDirStack] = useState<string[]>([]);
  const [editingContent, setEditingContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // New file modal local state
  const [showNewFileModal, setShowNewFileModal] = useState<boolean>(false);
  const [newFileName, setNewFileName] = useState<string>('');
  const [isTextFileOnly, setIsTextFileOnly] = useState<boolean>(false);

  // New folder modal local state
  const [newFolderName, setNewFolderName] = useState<string>('');

  // Three-dot item action menu
  const [activeFileMenu, setActiveFileMenu] = useState<ProjectFile | null>(null);

  // Rename modal state
  const [itemToRename, setItemToRename] = useState<ProjectFile | null>(null);
  const [renameInput, setRenameInput] = useState<string>('');
  const [isRenaming, setIsRenaming] = useState<boolean>(false);

  // Deletion confirmation state
  const [fileToDelete, setFileToDelete] = useState<ProjectFile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Reset directory stack when active workspace changes
  useEffect(() => {
    setCurrentDirStack([]);
    setActiveFile(null);
  }, [activeProject.id, activeProject.path, setActiveFile]);

  // Fetch real directory contents from host when Explorer opens or folder stack changes
  const currentSubDir = currentDirStack.join('/');
  useEffect(() => {
    if (activeProject.path) {
      refreshFiles(currentSubDir || undefined).catch(() => {});
    }
  }, [activeProject.id, activeProject.path, currentSubDir, refreshFiles]);

  // Sync editor content when activeFile changes or unsaved drafts exist
  useEffect(() => {
    if (activeFile) {
      const draft = unsavedFiles[activeFile.path];
      setEditingContent(draft !== undefined ? draft : (activeFile.content ?? ''));
    }
  }, [activeFile, unsavedFiles]);

  // Current folder items based on currentDirStack
  const getCurrentItems = (): ProjectFile[] => {
    let items = activeProject.files;
    for (const dirName of currentDirStack) {
      const found = items.find((f) => f.name === dirName && f.isDir);
      if (found && found.children) {
        items = found.children;
      } else {
        return [];
      }
    }
    return items;
  };

  const currentItems = getCurrentItems();

  const handleOpenFolder = (folderName: string) => {
    setCurrentDirStack((prev) => [...prev, folderName]);
  };

  const handleGoBack = () => {
    setCurrentDirStack((prev) => prev.slice(0, prev.length - 1));
  };

  const handleOpenFile = async (file: ProjectFile, startEditing = false) => {
    const draft = unsavedFiles[file.path];
    if (draft !== undefined) {
      setActiveFile(file);
      setEditingContent(draft);
      setIsEditing(startEditing);
      return;
    }

    try {
      const loaded = await loadFileContent(file.path);
      setActiveFile({ ...file, content: loaded });
      setEditingContent(loaded);
      setIsEditing(startEditing);
    } catch {
      // Leave activeFile null so the user sees the real host error banner instead of fake file content
      setActiveFile(null);
    }
  };

  const handleEditorChange = (newVal: string) => {
    setEditingContent(newVal);
    if (activeFile) {
      setUnsavedDraft(activeFile.path, newVal, activeFile.content ?? '');
    }
  };

  const handleSaveFile = async () => {
    if (!activeFile) return;
    try {
      await saveFileContent(activeFile.path, editingContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Unsaved indicator & fileError banner remain visible
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToRename || !renameInput.trim()) return;
    setIsRenaming(true);
    try {
      await renameProjectFile(itemToRename.path, renameInput.trim(), currentSubDir || undefined);
      setItemToRename(null);
      setRenameInput('');
    } catch {
      // fileError banner surfaces exact error
    } finally {
      setIsRenaming(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProjectFile(fileToDelete.path, currentSubDir || undefined);
      setFileToDelete(null);
    } catch {
      // fileError banner surfaces exact error
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const targetName = newFileName.trim();
    setNewFileName('');
    setShowNewFileModal(false);
    setFileModal('none');
    await createFile(targetName, isTextFileOnly, currentSubDir || undefined);
  };

  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const targetName = newFolderName.trim();
    setNewFolderName('');
    setFileModal('none');
    await createFolder(targetName, currentSubDir || undefined);
  };

  const handleOpenWithAction = (appName: string, file: ProjectFile) => {
    setActiveFileMenu(null);
    setFileModal('none');
    if (appName === 'Terminal') {
      const escaped = file.path.replace(/'/g, "''");
      executeCommand(`Get-Content -LiteralPath '${escaped}'`);
      setMobileNav('terminal');
    } else if (appName === 'Editor') {
      handleOpenFile(file, true);
    }
  };

  const isCurrentFileUnsaved = activeFile ? Boolean(unsavedFiles[activeFile.path]) : false;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#121419] text-zinc-100 overflow-hidden font-sans">
      {/* 1. Header with Breadcrumb and Actions */}
      <div className="p-3 bg-[#16181e] border-b border-[#252831] flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {currentDirStack.length > 0 ? (
            <button
              onClick={handleGoBack}
              className="p-1 text-zinc-400 hover:text-white rounded hover:bg-[#22252e] cursor-pointer mr-1"
              title="Back to parent folder"
            >
              <ChevronLeft className="w-4 h-4 text-blue-400" />
            </button>
          ) : (
            <Folder className="w-4 h-4 text-zinc-400 shrink-0" />
          )}

          <div className="flex items-center gap-1 text-xs font-mono truncate">
            <button
              type="button"
              onClick={() => {
                if (currentDirStack.length > 0) {
                  setCurrentDirStack([]);
                } else {
                  setIsWorkspacePickerOpen(true);
                }
              }}
              className="text-zinc-300 hover:text-white font-medium truncate cursor-pointer"
              title={activeProject.path || 'Select Windows workspace folder'}
            >
              {activeProject.name}
            </button>
            {currentDirStack.map((seg, idx) => (
              <React.Fragment key={idx}>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-200">{seg}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Action Buttons: Refresh / New File / New Folder */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => refreshFiles(currentSubDir || undefined)}
            disabled={fileLoading}
            data-testid="explorer-refresh-btn"
            className="h-7 w-7 bg-[#1c1f26] hover:bg-[#232731] text-zinc-300 border border-[#2b303b] rounded flex items-center justify-center cursor-pointer transition-colors"
            title="Refresh directory from Windows PC"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${fileLoading ? 'animate-spin text-blue-400' : 'text-zinc-400'}`} />
          </button>
          <button
            onClick={() => {
              setIsTextFileOnly(false);
              setShowNewFileModal(true);
            }}
            data-testid="explorer-new-file-btn"
            className="h-7 px-2 bg-[#1c1f26] hover:bg-[#232731] text-zinc-200 border border-[#2b303b] rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Create a new code file"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px]">File</span>
          </button>
          <button
            onClick={() => {
              setFileModal('new_folder');
            }}
            data-testid="explorer-new-folder-btn"
            className="h-7 px-2 bg-[#1c1f26] hover:bg-[#232731] text-zinc-300 border border-[#2b303b] rounded text-xs flex items-center gap-1 cursor-pointer transition-colors"
            title="Create a new folder"
          >
            <FolderPlus className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-[11px]">Folder</span>
          </button>
        </div>
      </div>

      {/* Host Filesystem Error Banner */}
      {fileError && (
        <div
          className="px-3 py-2 bg-red-950/80 border-b border-red-800/60 flex items-center justify-between text-xs font-mono text-red-200 shrink-0"
          data-testid="explorer-error-banner"
        >
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate" title={fileError}>{fileError}</span>
          </div>
          <button
            onClick={clearFileError}
            className="p-1 text-red-400 hover:text-white rounded cursor-pointer"
            title="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. Main Content: Split between File List & File Editor/Viewer */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {activeFile ? (
          <div className="flex-1 flex flex-col min-h-0 bg-[#111318]">
            {/* File Viewer Toolbar */}
            <div className="px-3 py-1.5 bg-[#16181e] border-b border-[#252831] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setActiveFile(null)}
                  data-testid="explorer-close-file-btn"
                  className="p-1 text-zinc-400 hover:text-white rounded hover:bg-[#22252e] cursor-pointer"
                  title="Close file and return to folder"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-zinc-300" />
                </button>
                <div className="flex items-center gap-1.5 truncate">
                  <FileCode className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-xs font-mono font-medium text-zinc-100 truncate">
                    {activeFile.name}
                  </span>
                  {isCurrentFileUnsaved && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0 inline-block"
                      title="Unsaved changes"
                      aria-label="Unsaved changes"
                    />
                  )}
                  {activeFile.gitStatus && activeFile.gitStatus !== 'clean' && (
                    <span className="text-[10px] font-mono text-amber-400 font-semibold ml-1">
                      [{activeFile.gitStatus}]
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  data-testid="explorer-edit-toggle-btn"
                  className={`h-7 px-2.5 rounded text-xs flex items-center gap-1 cursor-pointer transition-colors ${
                    isEditing
                      ? 'bg-[#222631] text-blue-400 border border-blue-500/40'
                      : 'bg-[#1c1f26] text-zinc-300 hover:text-white border border-[#2b303b]'
                  }`}
                  title={isEditing ? 'Viewing mode' : 'Edit file contents'}
                >
                  <Edit3 className="w-3 h-3" />
                  <span>{isEditing ? 'Editing' : 'Edit'}</span>
                </button>

                <button
                  onClick={handleSaveFile}
                  data-testid="explorer-save-btn"
                  className="h-7 px-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded text-xs flex items-center gap-1 cursor-pointer transition-colors shadow-xs"
                  title="Save changes to Windows PC"
                >
                  {saveSuccess ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      <span>Save</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Editor Textarea / Viewer */}
            <div className="flex-1 p-3 overflow-y-auto font-mono text-xs leading-relaxed bg-[#111318]">
              {isEditing ? (
                <textarea
                  value={editingContent}
                  onChange={(e) => handleEditorChange(e.target.value)}
                  data-testid="explorer-editor-textarea"
                  className="w-full h-full min-h-[300px] bg-transparent text-zinc-200 outline-none resize-none font-mono selection:bg-blue-600/30"
                  spellCheck="false"
                  placeholder="Enter file contents..."
                />
              ) : (
                <pre
                  data-testid="explorer-file-viewer"
                  className="text-zinc-300 whitespace-pre-wrap font-mono"
                >
                  {editingContent !== '' ? editingContent : (activeFile.content || '// Empty file')}
                </pre>
              )}
            </div>

            {/* Editor Footer Status */}
            <div className="px-3 py-1 bg-[#14161c] border-t border-[#23262f] text-[10.5px] font-mono text-zinc-500 flex items-center justify-between shrink-0">
              <span className="truncate max-w-[220px]">{activeFile.path}</span>
              <span>UTF-8 | {isCurrentFileUnsaved ? 'Unsaved edits' : activeFile.size || 'Saved'}</span>
            </div>
          </div>
        ) : (
          /* File & Folder List */
          <div className="flex-1 overflow-y-auto divide-y divide-[#1e2129]">
            {currentItems.length === 0 ? (
              <div
                className="py-12 text-center text-xs text-zinc-500 font-mono space-y-2"
                data-testid="explorer-empty-state"
              >
                <Folder className="w-8 h-8 mx-auto text-zinc-600" />
                <p>This directory is empty</p>
                <button
                  onClick={() => setShowNewFileModal(true)}
                  className="text-blue-400 hover:underline cursor-pointer"
                >
                  Create first file
                </button>
              </div>
            ) : (
              currentItems.map((item) => {
                const isItemUnsaved = Boolean(unsavedFiles[item.path]);

                return (
                  <div
                    key={item.path || item.name}
                    data-testid={`explorer-item-${item.name}`}
                    className="group px-3.5 py-2.5 hover:bg-[#181a21] flex items-center justify-between transition-colors cursor-pointer"
                    onClick={() => {
                      if (item.isDir) {
                        handleOpenFolder(item.name);
                      } else {
                        handleOpenFile(item);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {item.isDir ? (
                        <Folder className="w-4 h-4 text-zinc-400 shrink-0" />
                      ) : item.name.endsWith('.txt') || item.name.endsWith('.md') ? (
                        <FileText className="w-4 h-4 text-zinc-400 shrink-0" />
                      ) : (
                        <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-zinc-200 group-hover:text-white truncate">
                            {item.name}
                          </span>

                          {isItemUnsaved && (
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0 inline-block"
                              title="Unsaved changes"
                              aria-label="Unsaved changes"
                            />
                          )}

                          {item.gitStatus === 'M' && (
                            <span className="text-[10px] font-mono text-amber-400 font-semibold">[M]</span>
                          )}
                          {item.gitStatus === 'U' && (
                            <span className="text-[10px] font-mono text-zinc-500 font-semibold">[?]</span>
                          )}
                        </div>
                        <div className="text-[10px] font-mono text-zinc-500 flex items-center gap-2 mt-0.5">
                          {item.size && <span>{item.size}</span>}
                          <span>{item.modified}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button
                          onClick={() =>
                            setActiveFileMenu(activeFileMenu?.path === item.path ? null : item)
                          }
                          data-testid={`explorer-menu-${item.name}`}
                          className="p-1 text-zinc-500 hover:text-white rounded hover:bg-[#232731] cursor-pointer"
                          title={item.isDir ? 'Folder actions' : 'File actions'}
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {activeFileMenu?.path === item.path && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setActiveFileMenu(null)}
                            />
                            <div className="absolute right-0 top-7 w-48 bg-[#181a21] border border-[#2b303b] rounded-md shadow-xl p-1 z-40 text-xs font-mono space-y-0.5 animate-in fade-in duration-100">
                              <div className="px-2 py-1 text-[10px] uppercase font-semibold text-zinc-400 border-b border-[#242732]">
                                {item.isDir ? 'Folder Actions' : 'File Actions'}
                              </div>

                              {item.isDir ? (
                                <button
                                  onClick={() => {
                                    handleOpenFolder(item.name);
                                    setActiveFileMenu(null);
                                  }}
                                  className="w-full px-2 py-1.5 text-left rounded hover:bg-[#22252e] text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer"
                                >
                                  <Folder className="w-3.5 h-3.5 text-zinc-400" />
                                  <span>Open Folder</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      handleOpenFile(item);
                                      setActiveFileMenu(null);
                                    }}
                                    className="w-full px-2 py-1.5 text-left rounded hover:bg-[#22252e] text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>View & Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenWithAction('Terminal', item)}
                                    className="w-full px-2 py-1.5 text-left rounded hover:bg-[#22252e] text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer"
                                  >
                                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Open With… Terminal</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleOpenFile(item, true);
                                      setActiveFileMenu(null);
                                    }}
                                    className="w-full px-2 py-1.5 text-left rounded hover:bg-[#22252e] text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                                    <span>Edit Content</span>
                                  </button>
                                </>
                              )}

                              <button
                                onClick={() => {
                                  setItemToRename(item);
                                  setRenameInput(item.name);
                                  setActiveFileMenu(null);
                                }}
                                data-testid={`explorer-rename-action-${item.name}`}
                                className="w-full px-2 py-1.5 text-left rounded hover:bg-[#22252e] text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5 text-zinc-400" />
                                <span>{item.isDir ? 'Rename Folder' : 'Rename File'}</span>
                              </button>

                              <button
                                onClick={() => {
                                  setFileToDelete(item);
                                  setActiveFileMenu(null);
                                }}
                                data-testid={`explorer-delete-action-${item.name}`}
                                className="w-full px-2 py-1.5 text-left rounded hover:bg-red-900/30 text-red-400 hover:text-red-300 flex items-center gap-2 cursor-pointer border-t border-[#242732]"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                <span>{item.isDir ? 'Delete Folder' : 'Delete File'}</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>

                      {item.isDir && (
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 3. Create File Modal */}
      {(showNewFileModal || fileModal === 'new_file') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-zinc-300" />
                <h3 className="text-sm font-semibold text-white">
                  {isTextFileOnly ? 'Create New Text File' : 'Create New File'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setShowNewFileModal(false);
                  setFileModal('none');
                }}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFileSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">File Name</label>
                <input
                  type="text"
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder={isTextFileOnly ? 'notes.txt' : 'service.ts'}
                  data-testid="explorer-new-file-input"
                  required
                  autoFocus
                  className="w-full h-9 px-3 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewFileModal(false);
                    setFileModal('none');
                  }}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="explorer-create-file-submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md cursor-pointer transition-colors shadow-xs"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Create Folder Modal */}
      {fileModal === 'new_folder' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-zinc-300" />
                <h3 className="text-sm font-semibold text-white">Create New Folder</h3>
              </div>
              <button
                onClick={() => setFileModal('none')}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFolderSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">Folder Name</label>
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="components"
                  data-testid="explorer-new-folder-input"
                  required
                  autoFocus
                  className="w-full h-9 px-3 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setFileModal('none')}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="explorer-create-folder-submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md cursor-pointer transition-colors shadow-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Rename File/Folder Modal */}
      {itemToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-4 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Pencil className="w-4 h-4 text-zinc-300" />
                <h3 className="text-sm font-semibold text-white">
                  {itemToRename.isDir ? 'Rename Folder' : 'Rename File'}
                </h3>
              </div>
              <button
                onClick={() => setItemToRename(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300">New Name</label>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  data-testid="explorer-rename-input"
                  required
                  autoFocus
                  className="w-full h-9 px-3 bg-[#111318] border border-[#2b303b] focus:border-blue-500 rounded-md text-xs font-mono text-zinc-100 outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setItemToRename(null)}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRenaming}
                  data-testid="explorer-rename-submit"
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md cursor-pointer transition-colors shadow-xs flex items-center gap-1.5"
                >
                  {isRenaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Rename</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Open With Modal */}
      {fileModal === 'open_with' && activeFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-md w-full p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#242730] pb-2">
              <div className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-zinc-300" />
                <h3 className="text-sm font-semibold text-white">Open With…</h3>
              </div>
              <button
                onClick={() => setFileModal('none')}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Select application handler for{' '}
              <span className="text-zinc-200 font-mono font-medium">{activeFile.name}</span>:
            </p>

            <div className="space-y-1.5">
              <button
                onClick={() => handleOpenWithAction('Editor', activeFile)}
                className="w-full p-2.5 rounded-md bg-[#13151b] hover:bg-[#1c1f28] border border-[#242732] flex items-center justify-between text-left cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-medium text-zinc-100">Built-in Code Editor</div>
                    <div className="text-[11px] text-zinc-400">Mobile editor with live PC save</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">Default</span>
              </button>

              <button
                onClick={() => handleOpenWithAction('Terminal', activeFile)}
                className="w-full p-2.5 rounded-md bg-[#13151b] hover:bg-[#1c1f28] border border-[#242732] flex items-center justify-between text-left cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-zinc-300" />
                  <div>
                    <div className="text-xs font-medium text-zinc-100">Terminal Output (`Get-Content`)</div>
                    <div className="text-[11px] text-zinc-400">Print file contents in active PowerShell session</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">Ready</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. No File Selected Dialog */}
      {fileModal === 'no_file_selected' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-300">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">No File Selected</h3>
              </div>
              <button
                onClick={() => setFileModal('none')}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Please select a file in Explorer first to choose an application to open it with.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242730]">
              <button
                onClick={() => setFileModal('none')}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Dismiss
              </button>
              <button
                onClick={() => {
                  setFileModal('none');
                  setActiveFile(null);
                  setMobileNav('explorer');
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-md text-xs cursor-pointer"
              >
                Browse Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. Delete File/Folder Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400">
                <Trash2 className="w-4 h-4" />
                <h3 className="text-sm font-semibold text-white">
                  {fileToDelete.isDir ? 'Delete Folder' : 'Delete File'}
                </h3>
              </div>
              <button
                onClick={() => setFileToDelete(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to delete{' '}
              <span className="font-mono text-white font-medium">{fileToDelete.name}</span> on the
              Windows PC? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#242730]">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                data-testid="explorer-delete-confirm-btn"
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-md text-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
