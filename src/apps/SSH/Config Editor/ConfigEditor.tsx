import React, {useState, useEffect, useRef} from "react";
import {ConfigEditorSidebar} from "@/apps/SSH/Config Editor/ConfigEditorSidebar.tsx";
import {ConfigTabList} from "@/apps/SSH/Config Editor/ConfigTabList.tsx";
import {ConfigHomeView} from "@/apps/SSH/Config Editor/ConfigHomeView.tsx";
import {ConfigCodeEditor} from "@/apps/SSH/Config Editor/ConfigCodeEditor.tsx";
import {Button} from '@/components/ui/button.tsx';
import {ConfigTopbar} from "@/apps/SSH/Config Editor/ConfigTopbar.tsx";
import {cn} from '@/lib/utils.ts';
import {
    getConfigEditorRecent,
    getConfigEditorPinned,
    getConfigEditorShortcuts,
    addConfigEditorRecent,
    removeConfigEditorRecent,
    addConfigEditorPinned,
    removeConfigEditorPinned,
    addConfigEditorShortcut,
    removeConfigEditorShortcut,
    readSSHFile,
    writeSSHFile,
    getSSHStatus,
    connectSSH
} from '@/apps/SSH/ssh-axios.ts';

interface Tab {
    id: string | number;
    title: string;
    fileName: string;
    content: string;
    isSSH?: boolean;
    sshSessionId?: string;
    filePath?: string;
    loading?: boolean;
    error?: string;
    success?: string;
    dirty?: boolean;
}

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
    enableConfigEditor: boolean;
    defaultPath: string;
    tunnelConnections: any[];
    createdAt: string;
    updatedAt: string;
}

export function ConfigEditor({onSelectView}: { onSelectView: (view: string) => void }): React.ReactElement {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTab, setActiveTab] = useState<string | number>('home');
    const [recent, setRecent] = useState<any[]>([]);
    const [pinned, setPinned] = useState<any[]>([]);
    const [shortcuts, setShortcuts] = useState<any[]>([]);

    const [currentHost, setCurrentHost] = useState<SSHHost | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const sidebarRef = useRef<any>(null);

    useEffect(() => {
        if (currentHost) {
            fetchHomeData();
        } else {
            setRecent([]);
            setPinned([]);
            setShortcuts([]);
        }
    }, [currentHost]);

    useEffect(() => {
        if (activeTab === 'home' && currentHost) {
            fetchHomeData();
        }
    }, [activeTab, currentHost]);

    useEffect(() => {
        if (activeTab === 'home' && currentHost) {
            const interval = setInterval(() => {
                fetchHomeData();
            }, 2000);

            return () => clearInterval(interval);
        }
    }, [activeTab, currentHost]);

    async function fetchHomeData() {
        if (!currentHost) return;

        try {
            const homeDataPromise = Promise.all([
                getConfigEditorRecent(currentHost.id),
                getConfigEditorPinned(currentHost.id),
                getConfigEditorShortcuts(currentHost.id),
            ]);

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Fetch home data timed out')), 15000)
            );

            const [recentRes, pinnedRes, shortcutsRes] = await Promise.race([homeDataPromise, timeoutPromise]);

            const recentWithPinnedStatus = (recentRes || []).map(file => ({
                ...file,
                type: 'file',
                isPinned: (pinnedRes || []).some(pinnedFile =>
                    pinnedFile.path === file.path && pinnedFile.name === file.name
                )
            }));

            const pinnedWithType = (pinnedRes || []).map(file => ({
                ...file,
                type: 'file'
            }));

            setRecent(recentWithPinnedStatus);
            setPinned(pinnedWithType);
            setShortcuts((shortcutsRes || []).map(shortcut => ({
                ...shortcut,
                type: 'directory'
            })));
        } catch (err: any) {
        }
    }

    const formatErrorMessage = (err: any, defaultMessage: string): string => {
        if (typeof err === 'object' && err !== null && 'response' in err) {
            const axiosErr = err as any;
            if (axiosErr.response?.status === 403) {
                return `Permission denied. ${defaultMessage}. Check the Docker logs for detailed error information.`;
            } else if (axiosErr.response?.status === 500) {
                const backendError = axiosErr.response?.data?.error || 'Internal server error occurred';
                return `Server Error (500): ${backendError}. Check the Docker logs for detailed error information.`;
            } else if (axiosErr.response?.data?.error) {
                const backendError = axiosErr.response.data.error;
                return `${axiosErr.response?.status ? `Error ${axiosErr.response.status}: ` : ''}${backendError}. Check the Docker logs for detailed error information.`;
            } else {
                return `Request failed with status code ${axiosErr.response?.status || 'unknown'}. Check the Docker logs for detailed error information.`;
            }
        } else if (err instanceof Error) {
            return `${err.message}. Check the Docker logs for detailed error information.`;
        } else {
            return `${defaultMessage}. Check the Docker logs for detailed error information.`;
        }
    };

    const handleOpenFile = async (file: any) => {
        const tabId = file.path;

        if (!tabs.find(t => t.id === tabId)) {
            const currentSshSessionId = currentHost?.id.toString();

            setTabs([...tabs, {
                id: tabId,
                title: file.name,
                fileName: file.name,
                content: '',
                filePath: file.path,
                isSSH: true,
                sshSessionId: currentSshSessionId,
                loading: true
            }]);
            try {
                const res = await readSSHFile(currentSshSessionId, file.path);
                setTabs(tabs => tabs.map(t => t.id === tabId ? {
                    ...t,
                    content: res.content,
                    loading: false,
                    error: undefined
                } : t));
                await addConfigEditorRecent({
                    name: file.name,
                    path: file.path,
                    isSSH: true,
                    sshSessionId: currentSshSessionId,
                    hostId: currentHost?.id
                });
                fetchHomeData();
            } catch (err: any) {
                const errorMessage = formatErrorMessage(err, 'Cannot read file');
                setTabs(tabs => tabs.map(t => t.id === tabId ? {...t, loading: false, error: errorMessage} : t));
            }
        }
        setActiveTab(tabId);
    };

    const handleRemoveRecent = async (file: any) => {
        try {
            await removeConfigEditorRecent({
                name: file.name,
                path: file.path,
                isSSH: true,
                sshSessionId: file.sshSessionId,
                hostId: currentHost?.id
            });
            fetchHomeData();
        } catch (err) {
        }
    };

    const handlePinFile = async (file: any) => {
        try {
            await addConfigEditorPinned({
                name: file.name,
                path: file.path,
                isSSH: true,
                sshSessionId: file.sshSessionId,
                hostId: currentHost?.id
            });
            fetchHomeData();
            if (sidebarRef.current && sidebarRef.current.fetchFiles) {
                sidebarRef.current.fetchFiles();
            }
        } catch (err) {
        }
    };

    const handleUnpinFile = async (file: any) => {
        try {
            await removeConfigEditorPinned({
                name: file.name,
                path: file.path,
                isSSH: true,
                sshSessionId: file.sshSessionId,
                hostId: currentHost?.id
            });
            fetchHomeData();
            if (sidebarRef.current && sidebarRef.current.fetchFiles) {
                sidebarRef.current.fetchFiles();
            }
        } catch (err) {
        }
    };

    const handleOpenShortcut = async (shortcut: any) => {
        if (sidebarRef.current?.isOpeningShortcut) {
            return;
        }

        if (sidebarRef.current && sidebarRef.current.openFolder) {
            try {
                sidebarRef.current.isOpeningShortcut = true;

                const normalizedPath = shortcut.path.startsWith('/') ? shortcut.path : `/${shortcut.path}`;

                await sidebarRef.current.openFolder(currentHost, normalizedPath);
            } catch (err) {
            } finally {
                if (sidebarRef.current) {
                    sidebarRef.current.isOpeningShortcut = false;
                }
            }
        } else {
        }
    };

    const handleAddShortcut = async (folderPath: string) => {
        try {
            const name = folderPath.split('/').pop() || folderPath;
            await addConfigEditorShortcut({
                name,
                path: folderPath,
                isSSH: true,
                sshSessionId: currentHost?.id.toString(),
                hostId: currentHost?.id
            });
            fetchHomeData();
        } catch (err) {
        }
    };

    const handleRemoveShortcut = async (shortcut: any) => {
        try {
            await removeConfigEditorShortcut({
                name: shortcut.name,
                path: shortcut.path,
                isSSH: true,
                sshSessionId: currentHost?.id.toString(),
                hostId: currentHost?.id
            });
            fetchHomeData();
        } catch (err) {
        }
    };

    const closeTab = (tabId: string | number) => {
        const idx = tabs.findIndex(t => t.id === tabId);
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);
        if (activeTab === tabId) {
            if (newTabs.length > 0) setActiveTab(newTabs[Math.max(0, idx - 1)].id);
            else setActiveTab('home');
        }
        if (currentHost) {
            fetchHomeData();
        }
    };

    const setTabContent = (tabId: string | number, content: string) => {
        setTabs(tabs => tabs.map(t => t.id === tabId ? {
            ...t,
            content,
            dirty: true,
            error: undefined,
            success: undefined
        } : t));
    };

    const handleSave = async (tab: Tab) => {
        if (isSaving) {
            return;
        }

        setIsSaving(true);

        try {
            if (!tab.sshSessionId) {
                throw new Error('No SSH session ID available');
            }

            if (!tab.filePath) {
                throw new Error('No file path available');
            }

            if (!currentHost?.id) {
                throw new Error('No current host available');
            }

            try {
                const statusPromise = getSSHStatus(tab.sshSessionId);
                const statusTimeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('SSH status check timed out')), 10000)
                );

                const status = await Promise.race([statusPromise, statusTimeoutPromise]);

                if (!status.connected) {
                    const connectPromise = connectSSH(tab.sshSessionId, {
                        ip: currentHost.ip,
                        port: currentHost.port,
                        username: currentHost.username,
                        password: currentHost.password,
                        sshKey: currentHost.key,
                        keyPassword: currentHost.keyPassword
                    });
                    const connectTimeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('SSH reconnection timed out')), 15000)
                    );

                    await Promise.race([connectPromise, connectTimeoutPromise]);
                }
            } catch (statusErr) {
            }

            const savePromise = writeSSHFile(tab.sshSessionId, tab.filePath, tab.content);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => {
                    reject(new Error('Save operation timed out'));
                }, 30000)
            );

            const result = await Promise.race([savePromise, timeoutPromise]);
            setTabs(tabs => tabs.map(t => t.id === tab.id ? {
                ...t,
                dirty: false,
                success: 'File saved successfully'
            } : t));

            setTimeout(() => {
                setTabs(tabs => tabs.map(t => t.id === tab.id ? {...t, success: undefined} : t));
            }, 3000);

            Promise.allSettled([
                (async () => {
                    try {
                        await addConfigEditorRecent({
                            name: tab.fileName,
                            path: tab.filePath,
                            isSSH: true,
                            sshSessionId: tab.sshSessionId,
                            hostId: currentHost.id
                        });
                    } catch (recentErr) {
                    }
                })(),
                (async () => {
                    try {
                        await fetchHomeData();
                    } catch (refreshErr) {
                    }
                })()
            ]).then(() => {
            });

        } catch (err) {
            let errorMessage = formatErrorMessage(err, 'Cannot save file');

            if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
                errorMessage = `Save operation timed out. The file may have been saved successfully, but the operation took too long to complete. Check the Docker logs for confirmation.`;
            }

            setTabs(tabs => {
                const updatedTabs = tabs.map(t => t.id === tab.id ? {
                    ...t,
                    error: `Failed to save file: ${errorMessage}`
                } : t);
                return updatedTabs;
            });

            setTimeout(() => {
                setTabs(currentTabs => [...currentTabs]);
            }, 100);
        } finally {
            setIsSaving(false);
        }
    };

    const handleHostChange = (host: SSHHost | null) => {
        setCurrentHost(host);
        setTabs([]);
        setActiveTab('home');
    };

    if (!currentHost) {
        return (
            <div style={{position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden'}}>
                <div style={{position: 'absolute', top: 0, left: 0, width: 256, height: '100vh', zIndex: 20}}>
                    <ConfigEditorSidebar
                        onSelectView={onSelectView}
                        onOpenFile={handleOpenFile}
                        tabs={tabs}
                        ref={sidebarRef}
                        onHostChange={handleHostChange}
                    />
                </div>
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 256,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#09090b'
                }}>
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-white mb-2">Connect to a Server</h2>
                        <p className="text-muted-foreground">Select a server from the sidebar to start editing files</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden'}}>
            <div style={{position: 'absolute', top: 0, left: 0, width: 256, height: '100vh', zIndex: 20}}>
                <ConfigEditorSidebar
                    onSelectView={onSelectView}
                    onOpenFile={handleOpenFile}
                    tabs={tabs}
                    ref={sidebarRef}
                    onHostChange={handleHostChange}
                />
            </div>
            <div style={{position: 'absolute', top: 0, left: 256, right: 0, height: 44, zIndex: 30}}>
                <div className="flex items-center w-full bg-[#18181b] border-b border-[#222224] h-11 relative px-4"
                     style={{height: 44}}>
                    {/* Tab list scrollable area */}
                    <div className="flex-1 min-w-0 h-full flex items-center">
                        <div
                            className="h-9 w-full bg-[#09090b] border border-[#23232a] rounded-md flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
                            style={{minWidth: 0}}>
                            <ConfigTopbar
                                tabs={tabs.map(t => ({id: t.id, title: t.title}))}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                closeTab={closeTab}
                                onHomeClick={() => {
                                    setActiveTab('home');
                                    if (currentHost) {
                                        fetchHomeData();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    {/* Save button - always visible */}
                    <Button
                        className={cn(
                            'ml-4 px-4 py-1.5 border rounded-md text-sm font-medium transition-colors',
                            'border-[#2d2d30] text-white bg-transparent hover:bg-[#23232a] active:bg-[#23232a] focus:bg-[#23232a]',
                            activeTab === 'home' || !tabs.find(t => t.id === activeTab)?.dirty || isSaving ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#2d2d30]'
                        )}
                        disabled={activeTab === 'home' || !tabs.find(t => t.id === activeTab)?.dirty || isSaving}
                        onClick={() => {
                            const tab = tabs.find(t => t.id === activeTab);
                            if (tab && !isSaving) handleSave(tab);
                        }}
                        type="button"
                        style={{height: 36, alignSelf: 'center'}}
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </div>
            <div style={{
                position: 'absolute',
                top: 44,
                left: 256,
                right: 0,
                bottom: 0,
                overflow: 'hidden',
                zIndex: 10,
                background: '#101014',
                display: 'flex',
                flexDirection: 'column'
            }}>
                {activeTab === 'home' ? (
                    <ConfigHomeView
                        recent={recent}
                        pinned={pinned}
                        shortcuts={shortcuts}
                        onOpenFile={handleOpenFile}
                        onRemoveRecent={handleRemoveRecent}
                        onPinFile={handlePinFile}
                        onUnpinFile={handleUnpinFile}
                        onOpenShortcut={handleOpenShortcut}
                        onRemoveShortcut={handleRemoveShortcut}
                        onAddShortcut={handleAddShortcut}
                    />
                ) : (
                    (() => {
                        const tab = tabs.find(t => t.id === activeTab);
                        if (!tab) return null;
                        return (
                            <div className="flex flex-col h-full" style={{flex: 1, minHeight: 0}}>
                                {/* Error display */}
                                {tab.error && (
                                    <div
                                        className="bg-red-900/20 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-red-400">⚠️</span>
                                                <span>{tab.error}</span>
                                            </div>
                                            <button
                                                onClick={() => setTabs(tabs => tabs.map(t => t.id === tab.id ? {
                                                    ...t,
                                                    error: undefined
                                                } : t))}
                                                className="text-red-400 hover:text-red-300 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {/* Success display */}
                                {tab.success && (
                                    <div
                                        className="bg-green-900/20 border border-green-500/30 text-green-300 px-4 py-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-400">✓</span>
                                                <span>{tab.success}</span>
                                            </div>
                                            <button
                                                onClick={() => setTabs(tabs => tabs.map(t => t.id === tab.id ? {
                                                    ...t,
                                                    success: undefined
                                                } : t))}
                                                className="text-green-400 hover:text-green-300 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <div className="flex-1 min-h-0">
                                    <ConfigCodeEditor
                                        content={tab.content}
                                        fileName={tab.fileName}
                                        onContentChange={content => setTabContent(tab.id, content)}
                                    />
                                </div>
                            </div>
                        );
                    })()
                )}
            </div>
        </div>
    );
}