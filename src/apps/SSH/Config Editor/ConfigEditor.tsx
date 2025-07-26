import React, { useState, useEffect, useRef } from "react";
import { ConfigEditorSidebar } from "@/apps/SSH/Config Editor/ConfigEditorSidebar.tsx";
import { ConfigTabList } from "@/apps/SSH/Config Editor/ConfigTabList.tsx";
import { ConfigHomeView } from "@/apps/SSH/Config Editor/ConfigHomeView.tsx";
import { ConfigCodeEditor } from "@/apps/SSH/Config Editor/ConfigCodeEditor.tsx";
import axios from 'axios';
import { Button } from '@/components/ui/button.tsx';
import { ConfigTopbar } from "@/apps/SSH/Config Editor/ConfigTopbar.tsx";
import { cn } from '@/lib/utils.ts';

function getJWT() {
    return document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
}

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
    dirty?: boolean;
}

export function ConfigEditor({ onSelectView }: { onSelectView: (view: string) => void }): React.ReactElement {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [activeTab, setActiveTab] = useState<string | number>('home');
    const [recent, setRecent] = useState<any[]>([]);
    const [pinned, setPinned] = useState<any[]>([]);
    const [shortcuts, setShortcuts] = useState<any[]>([]);
    const [loadingHome, setLoadingHome] = useState(false);
    const [errorHome, setErrorHome] = useState<string | undefined>(undefined);

    const API_BASE_DB = 'http://localhost:8081'; // For database-backed endpoints
    const API_BASE = 'http://localhost:8084'; // For stateless file/ssh operations

    const sidebarRef = useRef<any>(null);

    // Fetch home data
    useEffect(() => {
        fetchHomeData();
    }, []);
    async function fetchHomeData() {
        setLoadingHome(true);
        setErrorHome(undefined);
        try {
            const jwt = getJWT();
            const [recentRes, pinnedRes, shortcutsRes] = await Promise.all([
                axios.get(`${API_BASE_DB}/config_editor/recent`, { headers: { Authorization: `Bearer ${jwt}` } }),
                axios.get(`${API_BASE_DB}/config_editor/pinned`, { headers: { Authorization: `Bearer ${jwt}` } }),
                axios.get(`${API_BASE_DB}/config_editor/shortcuts`, { headers: { Authorization: `Bearer ${jwt}` } }),
            ]);
            setRecent(recentRes.data || []);
            setPinned(pinnedRes.data || []);
            setShortcuts(shortcutsRes.data || []);
        } catch (err: any) {
            setErrorHome('Failed to load home data');
        } finally {
            setLoadingHome(false);
        }
    }

    // Home view actions
    const handleOpenFile = async (file: any) => {
        const tabId = file.path;
        if (!tabs.find(t => t.id === tabId)) {
            setTabs([...tabs, { id: tabId, title: file.name, fileName: file.name, content: '', filePath: file.path, isSSH: file.isSSH, sshSessionId: file.sshSessionId, loading: true }]);
            try {
                let content = '';
                const jwt = getJWT();
                if (file.isSSH) {
                    const res = await axios.get(`${API_BASE}/ssh/readFile`, { params: { sessionId: file.sshSessionId, path: file.path }, headers: { Authorization: `Bearer ${jwt}` } });
                    content = res.data.content;
                } else {
                    const folder = file.path.substring(0, file.path.lastIndexOf('/'));
                    const res = await axios.get(`${API_BASE}/file`, { params: { folder, name: file.name }, headers: { Authorization: `Bearer ${jwt}` } });
                    content = res.data;
                }
                setTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, content, loading: false, error: undefined } : t));
                // Mark as recent
                await axios.post(`${API_BASE_DB}/config_editor/recent`, { name: file.name, path: file.path }, { headers: { Authorization: `Bearer ${jwt}` } });
                fetchHomeData();
            } catch (err: any) {
                setTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, loading: false, error: err?.message || 'Failed to load file' } : t));
            }
        }
        setActiveTab(tabId);
    };
    const handleRemoveRecent = async (file: any) => {
        // Implement backend delete if needed
        setRecent(recent.filter(f => f.path !== file.path));
    };
    const handlePinFile = async (file: any) => {
        const jwt = getJWT();
        await axios.post(`${API_BASE_DB}/config_editor/pinned`, { name: file.name, path: file.path }, { headers: { Authorization: `Bearer ${jwt}` } });
        fetchHomeData();
    };
    const handleOpenShortcut = async (shortcut: any) => {
        // Find the server for this shortcut (local or SSH)
        let server: any = { isLocal: true, name: 'Local Files', id: 'local', defaultPath: '/' };
        if (shortcut.server) {
            server = shortcut.server;
        }
        // Use the sidebar's openFolder method
        if ((window as any).configSidebarRef && (window as any).configSidebarRef.openFolder) {
            (window as any).configSidebarRef.openFolder(server, shortcut.path);
        }
    };
    // Add add/remove shortcut logic
    const handleAddShortcut = async (folderPath: string) => {
        try {
            const jwt = getJWT();
            await axios.post(`${API_BASE_DB}/config_editor/shortcuts`, { name: folderPath.split('/').pop(), path: folderPath });
            fetchHomeData();
        } catch {}
    };
    const handleRemoveShortcut = async (shortcut: any) => {
        try {
            const jwt = getJWT();
            await axios.post(`${API_BASE_DB}/config_editor/shortcuts/delete`, { path: shortcut.path });
            fetchHomeData();
        } catch {}
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
    };
    const setTabContent = (tabId: string | number, content: string) => {
        setTabs(tabs => tabs.map(t => t.id === tabId ? { ...t, content, dirty: true } : t));
    };
    const handleSave = async (tab: Tab) => {
        try {
            const jwt = getJWT();
            if (tab.isSSH) {
                await axios.post(`${API_BASE}/ssh/writeFile`, { sessionId: tab.sshSessionId, path: tab.filePath, content: tab.content }, { headers: { Authorization: `Bearer ${jwt}` } });
            } else {
                await axios.post(`${API_BASE}/file?folder=${encodeURIComponent(tab.filePath?.substring(0, tab.filePath?.lastIndexOf('/')) || '')}&name=${encodeURIComponent(tab.fileName)}`, { content: tab.content }, { headers: { Authorization: `Bearer ${jwt}` } });
            }
            setTabs(tabs => tabs.map(t => t.id === tab.id ? { ...t, dirty: false } : t));
            // Mark as recent
            await axios.post(`${API_BASE_DB}/config_editor/recent`, { name: tab.fileName, path: tab.filePath }, { headers: { Authorization: `Bearer ${jwt}` } });
            fetchHomeData();
        } catch (err) {
            setTabs(tabs => tabs.map(t => t.id === tab.id ? { ...t, error: 'Failed to save file' } : t));
        }
    };

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 256, height: '100vh', zIndex: 20 }}>
                <ConfigEditorSidebar onSelectView={onSelectView} onOpenFile={handleOpenFile} tabs={tabs} ref={sidebarRef} />
            </div>
            <div style={{ position: 'absolute', top: 0, left: 256, right: 0, height: 44, zIndex: 30 }}>
                <div className="flex items-center w-full bg-[#18181b] border-b border-[#222224] h-11 relative" style={{ height: 44 }}>
                    {/* Tab list scrollable area, full width except for Save button */}
                    <div className="flex-1 min-w-0 h-full flex items-center pr-0">
                        <div className="h-9 w-full bg-[#09090b] border border-[#23232a] rounded-md flex items-center overflow-x-auto scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent" style={{ minWidth: 0 }}>
                            <ConfigTopbar
                                tabs={tabs.map(t => ({ id: t.id, title: t.title }))}
                                activeTab={activeTab}
                                setActiveTab={setActiveTab}
                                closeTab={closeTab}
                                onHomeClick={() => setActiveTab('home')}
                            />
                        </div>
                    </div>
                    {/* Save button only for file tabs, stationary at right */}
                    {activeTab !== 'home' && (() => {
                        const tab = tabs.find(t => t.id === activeTab);
                        if (!tab) return null;
                        return (
                            <button
                                className={cn(
                                    'ml-2 mr-2 px-3 py-1.5 border rounded-md text-base font-medium transition-colors',
                                    'border-[#2d2d30] text-white bg-transparent hover:bg-[#23232a] active:bg-[#23232a] focus:bg-[#23232a]',
                                    !tab.dirty ? 'opacity-60 cursor-not-allowed' : 'hover:border-[#2d2d30]'
                                )}
                                disabled={!tab.dirty}
                                onClick={() => handleSave(tab)}
                                type="button"
                                style={{ height: 36, alignSelf: 'center' }}
                            >
                                Save
                            </button>
                        );
                    })()}
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
                                <div className="flex-1 min-h-0">
                <ConfigCodeEditor
                                        content={tab.content}
                                        fileNameOld={tab.fileName}
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