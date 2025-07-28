import React, { useState, useEffect, useRef } from "react";
import { ConfigEditorSidebar } from "@/apps/SSH/Config Editor/ConfigEditorSidebar.tsx";
import { ConfigTabList } from "@/apps/SSH/Config Editor/ConfigTabList.tsx";
import { ConfigHomeView } from "@/apps/SSH/Config Editor/ConfigHomeView.tsx";
import { ConfigCodeEditor } from "@/apps/SSH/Config Editor/ConfigCodeEditor.tsx";
import { Button } from '@/components/ui/button.tsx';
import { ConfigTopbar } from "@/apps/SSH/Config Editor/ConfigTopbar.tsx";
import { cn } from '@/lib/utils.ts';
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
} from '@/apps/SSH/ssh-axios-fixed.ts';

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

export function ConfigEditor({ onSelectView }: { onSelectView: (view: string) => void }): React.ReactElement {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTab, setActiveTab] = useState<string | number>('home');
    const [recent, setRecent] = useState<any[]>([]);
    const [pinned, setPinned] = useState<any[]>([]);
    const [shortcuts, setShortcuts] = useState<any[]>([]);

    const [currentHost, setCurrentHost] = useState<SSHHost | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const sidebarRef = useRef<any>(null);

    // Fetch home data when host changes
    useEffect(() => {
        if (currentHost) {
            fetchHomeData();
        } else {
            // Clear data when no host is selected
            setRecent([]);
            setPinned([]);
            setShortcuts([]);
        }
    }, [currentHost]);

    // Refresh home data when switching to home view
    useEffect(() => {
        if (activeTab === 'home' && currentHost) {
            fetchHomeData();
        }
    }, [activeTab, currentHost]);



    // Periodic refresh of home data when on home view
    useEffect(() => {
        if (activeTab === 'home' && currentHost) {
            const interval = setInterval(() => {
                fetchHomeData();
            }, 2000); // Refresh every 2 seconds when on home view
            
            return () => clearInterval(interval);
        }
    }, [activeTab, currentHost]);

    async function fetchHomeData() {
        if (!currentHost) return;
        
        try {
            console.log('Fetching home data for host:', currentHost.id);
            
            const homeDataPromise = Promise.all([
                getConfigEditorRecent(currentHost.id),
                getConfigEditorPinned(currentHost.id),
                getConfigEditorShortcuts(currentHost.id),
            ]);
            
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Fetch home data timed out')), 15000)
            );
            
            const [recentRes, pinnedRes, shortcutsRes] = await Promise.race([homeDataPromise, timeoutPromise]);
            
            console.log('Home data fetched successfully:', { 
                recentCount: recentRes?.length || 0, 
                pinnedCount: pinnedRes?.length || 0, 
                shortcutsCount: shortcutsRes?.length || 0 
            });
            
            // Process recent files to add isPinned property and type
            const recentWithPinnedStatus = (recentRes || []).map(file => ({
                ...file,
                type: 'file', // Assume all recent files are files, not directories
                isPinned: (pinnedRes || []).some(pinnedFile => 
                    pinnedFile.path === file.path && pinnedFile.name === file.name
                )
            }));
            
            // Process pinned files to add type
            const pinnedWithType = (pinnedRes || []).map(file => ({
                ...file,
                type: 'file' // Assume all pinned files are files, not directories
            }));
            
            setRecent(recentWithPinnedStatus);
            setPinned(pinnedWithType);
            setShortcuts((shortcutsRes || []).map(shortcut => ({
                ...shortcut,
                type: 'directory' // Shortcuts are always directories
            })));
        } catch (err: any) {
            console.error('Failed to fetch home data:', err);
        }
    }

    // Helper function for consistent error handling
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

    // Home view actions
    const handleOpenFile = async (file: any) => {
        const tabId = file.path;
        console.log('Opening file:', { file, currentHost, tabId });
        
        if (!tabs.find(t => t.id === tabId)) {
            // Use the current host's SSH session ID instead of the stored one
            const currentSshSessionId = currentHost?.id.toString();
            console.log('Using SSH session ID:', currentSshSessionId, 'for file path:', file.path);
            
            setTabs([...tabs, { id: tabId, title: file.name, fileName: file.name, content: '', filePath: file.path, isSSH: true, sshSessionId: currentSshSessionId, loading: true }]);
            try {
                const res = await readSSHFile(currentSshSessionId, file.path);
                console.log('File read successful:', { path: file.path, contentLength: res.content?.length });
                setTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, content: res.content, loading: false, error: undefined } : t));
                // Mark as recent
                await addConfigEditorRecent({ 
                    name: file.name, 
                    path: file.path, 
                    isSSH: true, 
                    sshSessionId: currentSshSessionId,
                    hostId: currentHost?.id 
                });
                // Refresh immediately after opening file
                fetchHomeData();
            } catch (err: any) {
                console.error('Failed to read file:', { path: file.path, sessionId: currentSshSessionId, error: err });
                const errorMessage = formatErrorMessage(err, 'Cannot read file');
                setTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, loading: false, error: errorMessage } : t));
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
            // Refresh immediately after removing
            fetchHomeData();
        } catch (err) {
            console.error('Failed to remove recent file:', err);
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
            // Refresh immediately after pinning
            fetchHomeData();
            // Refresh sidebar files to update pin states immediately
            if (sidebarRef.current && sidebarRef.current.fetchFiles) {
                sidebarRef.current.fetchFiles();
            }
        } catch (err) {
            console.error('Failed to pin file:', err);
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
            // Refresh immediately after unpinning
            fetchHomeData();
            // Refresh sidebar files to update pin states immediately
            if (sidebarRef.current && sidebarRef.current.fetchFiles) {
                sidebarRef.current.fetchFiles();
            }
        } catch (err) {
            console.error('Failed to unpin file:', err);
        }
    };

    const handleOpenShortcut = async (shortcut: any) => {
        console.log('Opening shortcut:', { shortcut, currentHost });
        
        // Prevent multiple rapid clicks
        if (sidebarRef.current?.isOpeningShortcut) {
            console.log('Shortcut opening already in progress, ignoring click');
            return;
        }
        
        if (sidebarRef.current && sidebarRef.current.openFolder) {
            try {
                // Set flag to prevent multiple simultaneous opens
                sidebarRef.current.isOpeningShortcut = true;
                
                // Normalize the path to ensure it starts with /
                const normalizedPath = shortcut.path.startsWith('/') ? shortcut.path : `/${shortcut.path}`;
                console.log('Normalized path:', normalizedPath);
                
                await sidebarRef.current.openFolder(currentHost, normalizedPath);
                console.log('Shortcut opened successfully');
            } catch (err) {
                console.error('Failed to open shortcut:', err);
                // Could show error to user here if needed
            } finally {
                // Clear flag after operation completes
                if (sidebarRef.current) {
                    sidebarRef.current.isOpeningShortcut = false;
                }
            }
        } else {
            console.error('Sidebar ref or openFolder function not available');
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
            // Refresh immediately after adding shortcut
            fetchHomeData();
        } catch (err) {
            console.error('Failed to add shortcut:', err);
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
            // Refresh immediately after removing shortcut
            fetchHomeData();
        } catch (err) {
            console.error('Failed to remove shortcut:', err);
        }
    };

    // Tab actions
    const closeTab = (tabId: string | number) => {
        const idx = tabs.findIndex(t => t.id === tabId);
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);
        if (activeTab === tabId) {
            if (newTabs.length > 0) setActiveTab(newTabs[Math.max(0, idx - 1)].id);
            else setActiveTab('home');
        }
        // Refresh home data when closing tabs to update recent list
        if (currentHost) {
            fetchHomeData();
        }
    };

    const setTabContent = (tabId: string | number, content: string) => {
        setTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, content, dirty: true, error: undefined, success: undefined } : t));
    };

    const handleSave = async (tab: Tab) => {
        // Prevent multiple simultaneous saves
        if (isSaving) {
            console.log('Save already in progress, ignoring save request');
            return;
        }
        
        setIsSaving(true);
        
        try {
            console.log('Saving file:', { 
                tabId: tab.id, 
                fileName: tab.fileName, 
                filePath: tab.filePath, 
                sshSessionId: tab.sshSessionId,
                contentLength: tab.content?.length,
                currentHost: currentHost?.id 
            });
            
            if (!tab.sshSessionId) {
                throw new Error('No SSH session ID available');
            }
            
            if (!tab.filePath) {
                throw new Error('No file path available');
            }
            
            if (!currentHost?.id) {
                throw new Error('No current host available');
            }
            
            // Check SSH connection status first with timeout
            try {
                const statusPromise = getSSHStatus(tab.sshSessionId);
                const statusTimeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('SSH status check timed out')), 10000)
                );
                
                const status = await Promise.race([statusPromise, statusTimeoutPromise]);
                
                if (!status.connected) {
                    console.log('SSH session disconnected, attempting to reconnect...');
                    // Try to reconnect using current host credentials with timeout
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
                    console.log('SSH reconnection successful');
                }
            } catch (statusErr) {
                console.warn('Could not check SSH status or reconnect, proceeding with save attempt:', statusErr);
            }
            
            // Add timeout to prevent hanging
            console.log('Starting save operation with 30 second timeout...');
            const savePromise = writeSSHFile(tab.sshSessionId, tab.filePath, tab.content);
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => {
                    console.log('Save operation timed out after 30 seconds');
                    reject(new Error('Save operation timed out'));
                }, 30000)
            );
            
            const result = await Promise.race([savePromise, timeoutPromise]);
            console.log('Save operation completed successfully:', result);
            setTabs(tabs => tabs.map(t => t.id === tab.id ? { ...t, dirty: false, success: 'File saved successfully' } : t));
            console.log('File saved successfully - main save operation complete');
            
            // Auto-hide success message after 3 seconds
            setTimeout(() => {
                setTabs(tabs => tabs.map(t => t.id === tab.id ? { ...t, success: undefined } : t));
            }, 3000);
            
            // Mark as recent and refresh home data in background (non-blocking)
            Promise.allSettled([
                (async () => {
                    try {
                        console.log('Adding file to recent...');
                        await addConfigEditorRecent({ 
                            name: tab.fileName, 
                            path: tab.filePath, 
                            isSSH: true, 
                            sshSessionId: tab.sshSessionId,
                            hostId: currentHost.id 
                        });
                        console.log('File added to recent successfully');
                    } catch (recentErr) {
                        console.warn('Failed to add file to recent:', recentErr);
                    }
                })(),
                (async () => {
                    try {
                        console.log('Refreshing home data...');
                        await fetchHomeData();
                        console.log('Home data refreshed successfully');
                    } catch (refreshErr) {
                        console.warn('Failed to refresh home data:', refreshErr);
                    }
                })()
            ]).then(() => {
                console.log('Background operations completed');
            });
            
            console.log('File saved successfully - main operation complete, background operations started');
        } catch (err) {
            console.error('Failed to save file:', err);
            
            let errorMessage = formatErrorMessage(err, 'Cannot save file');
            
            // Check if this is a timeout error (which might mean the save actually worked)
            if (errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
                errorMessage = `Save operation timed out. The file may have been saved successfully, but the operation took too long to complete. Check the Docker logs for confirmation.`;
            }
            
            console.log('Final error message:', errorMessage);
            
            setTabs(tabs => {
                const updatedTabs = tabs.map(t => t.id === tab.id ? { ...t, error: `Failed to save file: ${errorMessage}` } : t);
                console.log('Updated tabs with error:', updatedTabs.find(t => t.id === tab.id));
                return updatedTabs;
            });
            
            // Force a re-render to ensure error is displayed
            setTimeout(() => {
                console.log('Forcing re-render to show error');
                setTabs(currentTabs => [...currentTabs]);
            }, 100);
        } finally {
            console.log('Save operation completed, setting isSaving to false');
            setIsSaving(false);
            console.log('isSaving state after setting to false:', false);
        }
    };

    const handleHostChange = (host: SSHHost | null) => {
        setCurrentHost(host);
        // Close all tabs when switching hosts
        setTabs([]);
        setActiveTab('home');
    };

    // Show connection message when no host is selected
    if (!currentHost) {
        return (
            <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, width: 256, height: '100vh', zIndex: 20 }}>
                    <ConfigEditorSidebar 
                        onSelectView={onSelectView} 
                        onOpenFile={handleOpenFile} 
                        tabs={tabs} 
                        ref={sidebarRef}
                        onHostChange={handleHostChange}
                    />
                </div>
                <div style={{ position: 'absolute', top: 0, left: 256, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#09090b' }}>
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-white mb-2">Connect to a Server</h2>
                        <p className="text-muted-foreground">Select a server from the sidebar to start editing files</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 256, height: '100vh', zIndex: 20 }}>
                <ConfigEditorSidebar 
                    onSelectView={onSelectView} 
                    onOpenFile={handleOpenFile} 
                    tabs={tabs} 
                    ref={sidebarRef}
                    onHostChange={handleHostChange}
                />
            </div>
            <div style={{ position: 'absolute', top: 0, left: 256, right: 0, height: 44, zIndex: 30 }}>
                <div className="flex items-center w-full bg-[#18181b] border-b border-[#222224] h-11 relative px-4" style={{ height: 44 }}>
                    {/* Tab list scrollable area */}
                    <div className="flex-1 min-w-0 h-full flex items-center">
                        <div className="h-9 w-full bg-[#09090b] border border-[#23232a] rounded-md flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent" style={{ minWidth: 0 }}>
                            <ConfigTopbar
                                tabs={tabs.map(t => ({ id: t.id, title: t.title }))}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                closeTab={closeTab}
                                onHomeClick={() => {
                                    setActiveTab('home');
                                    // Immediately refresh home data when clicking home
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
                        style={{ height: 36, alignSelf: 'center' }}
                    >
                        {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                </div>
            </div>
            <div style={{ position: 'absolute', top: 44, left: 256, right: 0, bottom: 0, overflow: 'hidden', zIndex: 10, background: '#101014', display: 'flex', flexDirection: 'column' }}>
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
                            <div className="flex flex-col h-full" style={{ flex: 1, minHeight: 0 }}>
                                {/* Error display */}
                                {tab.error && (
                                    <div className="bg-red-900/20 border border-red-500/30 text-red-300 px-4 py-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-red-400">⚠️</span>
                                                <span>{tab.error}</span>
                                            </div>
                                            <button
                                                onClick={() => setTabs(tabs => tabs.map(t => t.id === tab.id ? { ...t, error: undefined } : t))}
                                                className="text-red-400 hover:text-red-300 transition-colors"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </div>
                                )}
                                {/* Success display */}
                                {tab.success && (
                                    <div className="bg-green-900/20 border border-green-500/30 text-green-300 px-4 py-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-green-400">✓</span>
                                                <span>{tab.success}</span>
                                            </div>
                                            <button
                                                onClick={() => setTabs(tabs => tabs.map(t => t.id === tab.id ? { ...t, success: undefined } : t))}
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