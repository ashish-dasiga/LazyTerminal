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
  Loader2
} from 'lucide-react';

export function ExplorerScreen() {
  const { 
    activeProject, 
    activeFile, 
    setActiveFile, 
    saveFileContent, 
    createFile,
    createFolder,
    unsavedFiles,
    setUnsavedDraft,
    fileModal,
    setFileModal,
    setMobileNav,
    executeCommand,
    loadFileContent,
    deleteProjectFile,
    fileLoading,
    fileError,
    clearFileError,
    refreshFiles
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

  // Three-dot file action menu
  const [activeFileMenu, setActiveFileMenu] = useState<ProjectFile | null>(null);

  // File deletion state
  const [fileToDelete, setFileToDelete] = useState<ProjectFile | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Sync editor content when activeFile changes or unsaved drafts exist
  useEffect(() => {
    if (activeFile) {
      const draft = unsavedFiles[activeFile.path];
      setEditingContent(draft !== undefined ? draft : (activeFile.content || `// Content of ${activeFile.name}\n`));
    }
  }, [activeFile]);

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

  const handleOpenFile = async (file: ProjectFile) => {
    setActiveFile(file);
    const draft = unsavedFiles[file.path];
    if (draft !== undefined) {
      setEditingContent(draft);
    } else if (file.content !== undefined) {
      setEditingContent(file.content);
    } else {
      try {
        const loaded = await loadFileContent(file.path);
        setEditingContent(loaded);
      } catch {
        setEditingContent(`// Content of ${file.name}\n`);
      }
    }
    setIsEditing(false);
  };

  const handleEditorChange = (newVal: string) => {
    setEditingContent(newVal);
    if (activeFile) {
      setUnsavedDraft(activeFile.path, newVal, activeFile.content || '');
    }
  };

  const handleSaveFile = async () => {
    if (!activeFile) return;
    try {
      await saveFileContent(activeFile.path, editingContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      // If saving fails, unsaved indicator remains intact
      console.error('Save failed:', err);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteProjectFile(fileToDelete.path);
      setFileToDelete(null);
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateFileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    createFile(newFileName.trim(), isTextFileOnly);
    setNewFileName('');
    setShowNewFileModal(false);
    setFileModal('none');
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createFolder(newFolderName.trim());
    setNewFolderName('');
    setFileModal('none');
  };

  const handleOpenWithAction = (appName: string, file: ProjectFile) => {
    setActiveFileMenu(null);
    setFileModal('none');
    if (appName === 'Terminal') {
      executeCommand(`cat ${file.name}`);
      setMobileNav('terminal');
    } else if (appName === 'Editor') {
      handleOpenFile(file);
      setIsEditing(true);
    }
  };

  const isCurrentFileUnsaved = activeFile ? Boolean(unsavedFiles[activeFile.path]) : false;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#121419] text-zinc-100 overflow-hidden font-sans">
      {/* 1. Header with Breadcrumb and Actions */}
      <div className="p-3 bg-[#16181e] border-b border-[#252831] flex items-center justify-between shrink-0">
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
            <span className="text-zinc-400 font-medium">{activeProject.name}</span>
            {currentDirStack.map((seg, idx) => (
              <React.Fragment key={idx}>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-200">{seg}</span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Action Buttons: New File / New Folder */}
        <div className="flex items-center gap-1.5">
          {fileLoading && (
            <span title="Host file system syncing...">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400 mr-1" />
            </span>
          )}
          <button
            onClick={() => {
              setIsTextFileOnly(false);
              setShowNewFileModal(true);
            }}
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
        <div className="px-3 py-2 bg-red-950/80 border-b border-red-800/60 flex items-center justify-between text-xs font-mono text-red-200 shrink-0">
          <div className="flex items-center gap-2 truncate">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span className="truncate">{fileError}</span>
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
        {/* If a file is selected for viewing/editing */}
        {activeFile ? (
          <div className="flex-1 flex flex-col min-h-0 bg-[#111318]">
            {/* File Viewer Toolbar */}
            <div className="px-3 py-1.5 bg-[#16181e] border-b border-[#252831] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  onClick={() => setActiveFile(null)}
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
                  {/* Subtle grey dot in editor toolbar when file has unsaved changes */}
                  {isCurrentFileUnsaved && (
                    <span 
                      className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0 inline-block" 
                      title="Unsaved changes"
                      aria-label="Unsaved changes"
                    />
                  )}
                  {activeFile.gitStatus && (
                    <span className="text-[10px] font-mono text-amber-400 font-semibold ml-1">
                      [{activeFile.gitStatus}]
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEditing(!isEditing)}
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
                  className="w-full h-full min-h-[300px] bg-transparent text-zinc-200 outline-none resize-none font-mono selection:bg-blue-600/30"
                  spellCheck="false"
                  placeholder="Enter file contents..."
                />
              ) : (
                <pre className="text-zinc-300 whitespace-pre-wrap font-mono">
                  {editingContent || activeFile.content || '// Empty file'}
                </pre>
              )}
            </div>

            {/* Editor Footer Status */}
            <div className="px-3 py-1 bg-[#14161c] border-t border-[#23262f] text-[10.5px] font-mono text-zinc-500 flex items-center justify-between shrink-0">
              <span className="truncate max-w-[200px]">{activeFile.path}</span>
              <span>UTF-8 | {isCurrentFileUnsaved ? 'Unsaved edits' : activeFile.size || 'Saved'}</span>
            </div>
          </div>
        ) : (
          /* File & Folder List: Clean, unboxed list items */
          <div className="flex-1 overflow-y-auto divide-y divide-[#1e2129]">
            {currentItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-zinc-500 font-mono space-y-2">
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
                    key={item.name}
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

                          {/* Requirement 5: Small subtle grey dot beside filename only when unsaved */}
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

                    {/* Three-Dot Menu for File-Specific Actions */}
                    {!item.isDir && (
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setActiveFileMenu(activeFileMenu?.name === item.name ? null : item)}
                          className="p-1 text-zinc-500 hover:text-white rounded hover:bg-[#232731] cursor-pointer"
                          title="File actions"
                        >
                          <MoreVertical className="w-3.5 h-3.5" />
                        </button>

                        {/* Dropdown for File Actions */}
                        {activeFileMenu?.name === item.name && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setActiveFileMenu(null)} />
                            <div className="absolute right-0 top-7 w-48 bg-[#181a21] border border-[#2b303b] rounded-md shadow-xl p-1 z-40 text-xs font-mono space-y-0.5 animate-in fade-in duration-100">
                              <div className="px-2 py-1 text-[10px] uppercase font-semibold text-zinc-400 border-b border-[#242732]">
                                File Actions
                              </div>
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
                                  handleOpenFile(item);
                                  setIsEditing(true);
                                  setActiveFileMenu(null);
                                }}
                                className="w-full px-2 py-1.5 text-left rounded hover:bg-[#22252e] text-zinc-200 hover:text-white flex items-center gap-2 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-zinc-400" />
                                <span>Edit Content</span>
                              </button>
                              <button
                                onClick={() => {
                                  setFileToDelete(item);
                                  setActiveFileMenu(null);
                                }}
                                className="w-full px-2 py-1.5 text-left rounded hover:bg-red-900/30 text-red-400 hover:text-red-300 flex items-center gap-2 cursor-pointer border-t border-[#242732]"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                <span>Delete File</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {item.isDir && (
                      <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* 3. Create File Modal (triggered from Explorer header or Hamburger menu) */}
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
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md cursor-pointer transition-colors shadow-xs"
                >
                  Create File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Create Folder Modal (triggered from Hamburger menu or Explorer) */}
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
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-md cursor-pointer transition-colors shadow-xs"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Open With Modal (triggered from Hamburger menu) */}
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
              Select application handler for <span className="text-zinc-200 font-mono font-medium">{activeFile.name}</span>:
            </p>

            <div className="space-y-1.5">
              {/* Option 1: Built-in Code Editor */}
              <button
                onClick={() => handleOpenWithAction('Editor', activeFile)}
                className="w-full p-2.5 rounded-md bg-[#13151b] hover:bg-[#1c1f28] border border-[#242732] flex items-center justify-between text-left cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Edit3 className="w-4 h-4 text-blue-400" />
                  <div>
                    <div className="text-xs font-medium text-zinc-100">Built-in Code Editor</div>
                    <div className="text-[11px] text-zinc-400">Mobile editor with syntax and save</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">Default</span>
              </button>

              {/* Option 2: Terminal Pager (cat) */}
              <button
                onClick={() => handleOpenWithAction('Terminal', activeFile)}
                className="w-full p-2.5 rounded-md bg-[#13151b] hover:bg-[#1c1f28] border border-[#242732] flex items-center justify-between text-left cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Terminal className="w-4 h-4 text-zinc-300" />
                  <div>
                    <div className="text-xs font-medium text-zinc-100">Terminal Pager (`cat`)</div>
                    <div className="text-[11px] text-zinc-400">Stream file contents into active shell</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">Ready</span>
              </button>

              {/* Option 3: Hex / Binary Inspector */}
              <div className="w-full p-2.5 rounded-md bg-[#13151b]/60 border border-[#242732] flex items-center justify-between text-left opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-2.5">
                  <Eye className="w-4 h-4 text-zinc-500" />
                  <div>
                    <div className="text-xs font-medium text-zinc-400">Hex / Binary Inspector</div>
                    <div className="text-[11px] text-zinc-500">Requires native desktop debugger plugin</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Unavailable</span>
              </div>

              {/* Option 4: External Desktop Default */}
              <div className="w-full p-2.5 rounded-md bg-[#13151b]/60 border border-[#242732] flex items-center justify-between text-left opacity-60 cursor-not-allowed">
                <div className="flex items-center gap-2.5">
                  <ExternalLink className="w-4 h-4 text-zinc-500" />
                  <div>
                    <div className="text-xs font-medium text-zinc-400">External Windows Application</div>
                    <div className="text-[11px] text-zinc-500">Requires native desktop GUI forwarding</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-zinc-500">Unavailable</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. No File Selected Dialog (if Open With tapped with no active file) */}
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

      {/* 7. Delete File Confirmation Modal */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
          <div className="bg-[#181a21] border border-[#2b303b] rounded-lg max-w-sm w-full p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400">
                <Trash2 className="w-4 h-4" />
                <h3 className="text-sm font-semibold text-white">Delete File</h3>
              </div>
              <button
                onClick={() => setFileToDelete(null)}
                className="text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed">
              Are you sure you want to delete <span className="font-mono text-white font-medium">{fileToDelete.name}</span> on the Windows PC? This action cannot be undone.
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
                className="px-3.5 py-1.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-md text-xs cursor-pointer transition-colors flex items-center gap-1.5"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
