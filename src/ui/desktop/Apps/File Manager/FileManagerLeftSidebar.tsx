import React, {useEffect, useState, useRef, forwardRef, useImperativeHandle} from 'react';
import {Separator} from '@/components/ui/separator.tsx';
import {CornerDownLeft, Folder, File, Server, ArrowUp, Pin, MoreVertical, Trash2, Edit3} from 'lucide-react';
import {ScrollArea} from '@/components/ui/scroll-area.tsx';
import {cn} from '@/lib/utils.ts';
import {Input} from '@/components/ui/input.tsx';
import {Button} from '@/components/ui/button.tsx';
import {toast} from 'sonner';
import {
    listSSHFiles,
    renameSSHItem,
    deleteSSHItem,
    getFileManagerRecent,
    getFileManagerPinned,
    addFileManagerPinned,
    removeFileManagerPinned,
    readSSHFile,
    getSSHStatus,
    connectSSH
} from '@/ui/main-axios.ts';

interface SSHHost {
    id: number;
    name: string;
    ip: string;
    port: number;
    username: string;
    folder: string;
    tags: string[];
    pin: boolean;
    authType: string;
    password?: string;
    key?: string;
    keyPassword?: string;
    keyType?: string;
    enableTerminal: boolean;
    enableTunnel: boolean;
    enableFileManager: boolean;
    defaultPath: string;
    tunnelConnections: any[];
    createdAt: string;
    updatedAt: string;
}

const FileManagerLeftSidebar = forwardRef(function FileManagerSidebar(
    {onSelectView, onOpenFile, tabs, host, onOperationComplete, onError, onSuccess, onPathChange, onDeleteItem}: {
        onSelectView?: (view: string) => void;
        onOpenFile: (file: any) => void;
        tabs: any[];
        host: SSHHost;
        onOperationComplete?: () => void;
        onError?: (error: string) => void;
        onSuccess?: (message: string) => void;
        onPathChange?: (path: string) => void;
        onDeleteItem?: (item: any) => void;
    },
    ref
) {
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<any[]>([]);
    const pathInputRef = useRef<HTMLInputElement>(null);

    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [fileSearch, setFileSearch] = useState('');
    const [debouncedFileSearch, setDebouncedFileSearch] = useState('');
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(handler);
    }, [search]);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(fileSearch), 200);
        return () => clearTimeout(handler);
    }, [fileSearch]);

    const [sshSessionId, setSshSessionId] = useState<string | null>(null);
    const [filesLoading, setFilesLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [connectingSSH, setConnectingSSH] = useState(false);
    const [connectionCache, setConnectionCache] = useState<Record<string, {
        sessionId: string;
        timestamp: number
    }>>({});
    const [fetchingFiles, setFetchingFiles] = useState(false);

    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        x: number;
        y: number;
        item: any;
    }>({
        visible: false,
        x: 0,
        y: 0,
        item: null
    });

    const [renamingItem, setRenamingItem] = useState<{
        item: any;
        newName: string;
    } | null>(null);

    useEffect(() => {
        const nextPath = host?.defaultPath || '/';
        setCurrentPath(nextPath);
        onPathChange?.(nextPath);
        (async () => {
            await connectToSSH(host);
        })();
    }, [host?.id]);

    async function connectToSSH(server: SSHHost): Promise<string | null> {
        const sessionId = server.id.toString();

        const cached = connectionCache[sessionId];
        if (cached && Date.now() - cached.timestamp < 30000) {
            setSshSessionId(cached.sessionId);
            return cached.sessionId;
        }

        if (connectingSSH) {
            return null;
        }

        setConnectingSSH(true);

        try {
            if (!server.password && !server.key) {
                toast.error('No authentication credentials available for this SSH host');
                return null;
            }

            const connectionConfig = {
                ip: server.ip,
                port: server.port,
                username: server.username,
                password: server.password,
                sshKey: server.key,
                keyPassword: server.keyPassword,
            };

            await connectSSH(sessionId, connectionConfig);

            setSshSessionId(sessionId);

            setConnectionCache(prev => ({
                ...prev,
                [sessionId]: {sessionId, timestamp: Date.now()}
            }));

            return sessionId;
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to connect to SSH');
            setSshSessionId(null);
            return null;
        } finally {
            setConnectingSSH(false);
        }
    }

    async function fetchFiles() {
        if (fetchingFiles) {
            return;
        }

        setFetchingFiles(true);
        setFiles([]);
        setFilesLoading(true);

        try {
            let pinnedFiles: any[] = [];
            try {
                if (host) {
                    pinnedFiles = await getFileManagerPinned(host.id);
                }
            } catch (err) {
            }

            if (host && sshSessionId) {
                let res: any[] = [];

                try {
                    const status = await getSSHStatus(sshSessionId);
                    if (!status.connected) {
                        const newSessionId = await connectToSSH(host);
                        if (newSessionId) {
                            setSshSessionId(newSessionId);
                            res = await listSSHFiles(newSessionId, currentPath);
                        } else {
                            throw new Error('Failed to reconnect SSH session');
                        }
                    } else {
                        res = await listSSHFiles(sshSessionId, currentPath);
                    }
                } catch (sessionErr) {
                    const newSessionId = await connectToSSH(host);
                    if (newSessionId) {
                        setSshSessionId(newSessionId);
                        res = await listSSHFiles(newSessionId, currentPath);
                    } else {
                        throw sessionErr;
                    }
                }

                const processedFiles = (res || []).map((f: any) => {
                    const filePath = currentPath + (currentPath.endsWith('/') ? '' : '/') + f.name;
                    const isPinned = pinnedFiles.some(pinned => pinned.path === filePath);
                    return {
                        ...f,
                        path: filePath,
                        isPinned,
                        isSSH: true,
                        sshSessionId: sshSessionId
                    };
                });

                setFiles(processedFiles);
            }
        } catch (err: any) {
            setFiles([]);
            toast.error(err?.response?.data?.error || err?.message || 'Failed to list files');
        } finally {
            setFilesLoading(false);
            setFetchingFiles(false);
        }
    }

    useEffect(() => {
        if (host && sshSessionId && !connectingSSH && !fetchingFiles) {
            const timeoutId = setTimeout(() => {
                fetchFiles();
            }, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [currentPath, host, sshSessionId]);

    useImperativeHandle(ref, () => ({
        openFolder: async (_server: SSHHost, path: string) => {
            if (connectingSSH || fetchingFiles) {
                return;
            }

            if (currentPath === path) {
                setTimeout(() => fetchFiles(), 100);
                return;
            }

            setFetchingFiles(false);
            setFilesLoading(false);
            setFiles([]);

            setCurrentPath(path);
            onPathChange?.(path);
            if (!sshSessionId) {
                const sessionId = await connectToSSH(host);
                if (sessionId) setSshSessionId(sessionId);
            }
        },
        fetchFiles: () => {
            if (host && sshSessionId) {
                fetchFiles();
            }
        },
        getCurrentPath: () => currentPath
    }));

    useEffect(() => {
        if (pathInputRef.current) {
            pathInputRef.current.scrollLeft = pathInputRef.current.scrollWidth;
        }
    }, [currentPath]);

    const filteredFiles = files.filter(file => {
        const q = debouncedFileSearch.trim().toLowerCase();
        if (!q) return true;
        return file.name.toLowerCase().includes(q);
    });

    const handleContextMenu = (e: React.MouseEvent, item: any) => {
        e.preventDefault();

        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const menuWidth = 160;
        const menuHeight = 80;

        let x = e.clientX;
        let y = e.clientY;

        if (x + menuWidth > viewportWidth) {
            x = e.clientX - menuWidth;
        }

        if (y + menuHeight > viewportHeight) {
            y = e.clientY - menuHeight;
        }

        if (x < 0) {
            x = 0;
        }

        if (y < 0) {
            y = 0;
        }
        
        setContextMenu({
            visible: true,
            x,
            y,
            item
        });
    };

    const closeContextMenu = () => {
        setContextMenu({ visible: false, x: 0, y: 0, item: null });
    };

    const handleRename = async (item: any, newName: string) => {
        if (!sshSessionId || !newName.trim() || newName === item.name) {
            setRenamingItem(null);
            return;
        }

        try {
            await renameSSHItem(sshSessionId, item.path, newName.trim());
            toast.success(`${item.type === 'directory' ? 'Folder' : 'File'} renamed successfully`);
            setRenamingItem(null);
            if (onOperationComplete) {
                onOperationComplete();
            } else {
                fetchFiles();
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to rename item');
        }
    };

    const handleDelete = async (item: any) => {
        if (!sshSessionId) return;

        try {
            await deleteSSHItem(sshSessionId, item.path, item.type === 'directory');
            toast.success(`${item.type === 'directory' ? 'Folder' : 'File'} deleted successfully`);
            if (onOperationComplete) {
                onOperationComplete();
            } else {
                fetchFiles();
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'Failed to delete item');
        }
    };

    const startRename = (item: any) => {
        setRenamingItem({ item, newName: item.name });
        closeContextMenu();
    };

    const startDelete = (item: any) => {
        onDeleteItem?.(item);
        closeContextMenu();
    };

    useEffect(() => {
        const handleClickOutside = () => closeContextMenu();
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handlePathChange = (newPath: string) => {
        setCurrentPath(newPath);
        onPathChange?.(newPath);
    };

    return (
        <div className="flex flex-col h-full w-[256px]" style={{maxWidth: 256}}>
            <div className="flex flex-col flex-grow min-h-0">
                <div className="flex-1 w-full h-full flex flex-col bg-[#09090b] border-r-2 border-[#303032] overflow-hidden p-0 relative min-h-0">
                    {host && (
                        <div className="flex flex-col h-full w-full" style={{maxWidth: 260}}>
                            <div className="flex items-center gap-2 px-2 py-1.5 border-b-2 border-[#303032] bg-[#18181b] z-20" style={{maxWidth: 260}}>
                                <Button
                                    size="icon"
                                    variant="outline"
                                    className="h-9 w-9 bg-[#18181b] border-2 border-[#303032] rounded-md hover:bg-[#2d2d30] focus:outline-none focus:ring-2 focus:ring-ring"
                                    onClick={() => {
                                        let path = currentPath;
                                        if (path && path !== '/' && path !== '') {
                                            if (path.endsWith('/')) path = path.slice(0, -1);
                                            const lastSlash = path.lastIndexOf('/');
                                            if (lastSlash > 0) {
                                                handlePathChange(path.slice(0, lastSlash));
                                            } else {
                                                handlePathChange('/');
                                            }
                                        } else {
                                            handlePathChange('/');
                                        }
                                    }}
                                >
                                    <ArrowUp className="w-4 h-4"/>
                                </Button>
                                <Input ref={pathInputRef} value={currentPath}
                                       onChange={e => handlePathChange(e.target.value)}
                                       className="flex-1 bg-[#18181b] border-2 border-[#434345] text-white truncate rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring hover:border-[#5a5a5d]"
                                />
                            </div>
                            <div className="px-2 py-2 border-b-1 border-[#303032] bg-[#18181b]">
                                <Input
                                    placeholder="Search files and folders..."
                                    className="w-full h-7 text-sm bg-[#23232a] border-2 border-[#434345] text-white placeholder:text-muted-foreground rounded-md"
                                    autoComplete="off"
                                    value={fileSearch}
                                    onChange={e => setFileSearch(e.target.value)}
                                />
                            </div>
                            <div className="flex-1 min-h-0 w-full bg-[#09090b] border-t-1 border-[#303032]">
                                <ScrollArea className="h-full w-full bg-[#09090b]">
                                    <div className="p-2 pb-0">
                                        {connectingSSH || filesLoading ? (
                                            <div className="text-xs text-muted-foreground">Loading...</div>
                                        ) : filteredFiles.length === 0 ? (
                                            <div className="text-xs text-muted-foreground">No files or folders found.</div>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                {filteredFiles.map((item: any) => {
                                                    const isOpen = (tabs || []).some((t: any) => t.id === item.path);
                                                    const isRenaming = renamingItem?.item?.path === item.path;
                                                    const isDeleting = false;
                                                    
                                                    return (
                                                        <div
                                                            key={item.path}
                                                            className={cn(
                                                                "flex items-center gap-2 px-3 py-2 bg-[#18181b] border-2 border-[#303032] rounded group max-w-full relative",
                                                                isOpen && "opacity-60 cursor-not-allowed pointer-events-none"
                                                            )}
                                                            style={{maxWidth: 220, marginBottom: 8}}
                                                            onContextMenu={(e) => !isOpen && handleContextMenu(e, item)}
                                                        >
                                                            {isRenaming ? (
                                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                                    {item.type === 'directory' ?
                                                                        <Folder className="w-4 h-4 text-blue-400 flex-shrink-0"/> :
                                                                        <File className="w-4 h-4 text-muted-foreground flex-shrink-0"/>}
                                                                    <Input
                                                                        value={renamingItem.newName}
                                                                        onChange={(e) => setRenamingItem(prev => prev ? {...prev, newName: e.target.value} : null)}
                                                                        className="flex-1 h-6 text-sm bg-[#23232a] border border-[#434345] text-white"
                                                                        autoFocus
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                handleRename(item, renamingItem.newName);
                                                                            } else if (e.key === 'Escape') {
                                                                                                setRenamingItem(null);
                                                                            }
                                                                        }}
                                                                        onBlur={() => handleRename(item, renamingItem.newName)}
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <div
                                                                        className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                                                                        onClick={() => !isOpen && (item.type === 'directory' ? handlePathChange(item.path) : onOpenFile({
                                                                            name: item.name,
                                                                            path: item.path,
                                                                            isSSH: item.isSSH,
                                                                            sshSessionId: item.sshSessionId
                                                                        }))}
                                                                    >
                                                                        {item.type === 'directory' ?
                                                                            <Folder className="w-4 h-4 text-blue-400 flex-shrink-0"/> :
                                                                            <File className="w-4 h-4 text-muted-foreground flex-shrink-0"/>}
                                                                        <span className="text-sm text-white truncate flex-1 min-w-0">{item.name}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        {item.type === 'file' && (
                                                                            <Button size="icon" variant="ghost" className="h-7 w-7"
                                                                                    disabled={isOpen}
                                                                                    onClick={async (e) => {
                                                                                        e.stopPropagation();
                                                                                        try {
                                                                                            if (item.isPinned) {
                                                                                                await removeFileManagerPinned({
                                                                                                    name: item.name,
                                                                                                    path: item.path,
                                                                                                    hostId: host?.id,
                                                                                                    isSSH: true,
                                                                                                    sshSessionId: host?.id.toString()
                                                                                                });
                                                                                                setFiles(files.map(f =>
                                                                                                    f.path === item.path ? { ...f, isPinned: false } : f
                                                                                                ));
                                                                                            } else {
                                                                                                await addFileManagerPinned({
                                                                                                    name: item.name,
                                                                                                    path: item.path,
                                                                                                    hostId: host?.id,
                                                                                                    isSSH: true,
                                                                                                    sshSessionId: host?.id.toString()
                                                                                                });
                                                                                                setFiles(files.map(f =>
                                                                                                    f.path === item.path ? { ...f, isPinned: true } : f
                                                                                                ));
                                                                                            }
                                                                                        } catch (err) {
                                                                                        }
                                                                                    }}
                                                                            >
                                                                                <Pin className={`w-1 h-1 ${item.isPinned ? 'text-yellow-400 fill-current' : 'text-muted-foreground'}`}/>
                                                                            </Button>
                                                                        )}
                                                                        {!isOpen && (
                                                                            <Button
                                                                                size="icon"
                                                                                variant="ghost"
                                                                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleContextMenu(e, item);
                                                                                }}
                                                                            >
                                                                                <MoreVertical className="w-4 h-4" />
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </ScrollArea>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {contextMenu.visible && contextMenu.item && (
                <div
                    className="fixed z-[99998] bg-[#18181b] border-2 border-[#303032] rounded-lg shadow-xl py-1 min-w-[160px]"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                    }}
                >
                    <button
                        className="w-full px-3 py-2 text-left text-sm text-white hover:bg-[#2d2d30] flex items-center gap-2"
                        onClick={() => startRename(contextMenu.item)}
                    >
                        <Edit3 className="w-4 h-4" />
                        Rename
                    </button>
                    <button
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#2d2d30] flex items-center gap-2"
                        onClick={() => startDelete(contextMenu.item)}
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                </div>
            )}
        </div>
    );
});

export {FileManagerLeftSidebar};