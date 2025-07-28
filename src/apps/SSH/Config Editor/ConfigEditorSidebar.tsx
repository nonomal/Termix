import React, {useEffect, useState, useRef, forwardRef, useImperativeHandle} from 'react';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel, SidebarMenu, SidebarMenuItem,
    SidebarProvider
} from '@/components/ui/sidebar.tsx';
import {Separator} from '@/components/ui/separator.tsx';
import {CornerDownLeft, Folder, File, Server, ArrowUp, Pin} from 'lucide-react';
import {ScrollArea} from '@/components/ui/scroll-area.tsx';
import { cn } from '@/lib/utils.ts';
import {Input} from '@/components/ui/input.tsx';
import {Button} from '@/components/ui/button.tsx';
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from '@/components/ui/accordion.tsx';
import { 
    getSSHHosts, 
    listSSHFiles, 
    connectSSH, 
    getSSHStatus,
    getConfigEditorPinned,
    addConfigEditorPinned,
    removeConfigEditorPinned
} from '@/apps/SSH/ssh-axios-fixed.ts';

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

const ConfigEditorSidebar = forwardRef(function ConfigEditorSidebar(
    { onSelectView, onOpenFile, tabs, onHostChange }: { 
        onSelectView: (view: string) => void; 
        onOpenFile: (file: any) => void; 
        tabs: any[];
        onHostChange?: (host: SSHHost | null) => void;
    },
    ref
) {
    const [sshConnections, setSSHConnections] = useState<SSHHost[]>([]);
    const [loadingSSH, setLoadingSSH] = useState(false);
    const [errorSSH, setErrorSSH] = useState<string | undefined>(undefined);
    const [view, setView] = useState<'servers' | 'files'>('servers');
    const [activeServer, setActiveServer] = useState<SSHHost | null>(null);
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<any[]>([]);
    const pathInputRef = useRef<HTMLInputElement>(null);
    
    // Add search bar state
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [fileSearch, setFileSearch] = useState('');
    const [debouncedFileSearch, setDebouncedFileSearch] = useState('');
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(handler);
    }, [search]);
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedFileSearch(fileSearch), 200);
        return () => clearTimeout(handler);
    }, [fileSearch]);

    // Add state for SSH sessionId and loading/error
    const [sshSessionId, setSshSessionId] = useState<string | null>(null);
    const [filesLoading, setFilesLoading] = useState(false);
    const [filesError, setFilesError] = useState<string | null>(null);
    const [connectingSSH, setConnectingSSH] = useState(false);
    const [connectionCache, setConnectionCache] = useState<Record<string, { sessionId: string; timestamp: number }>>({});
    const [fetchingFiles, setFetchingFiles] = useState(false);

    useEffect(() => {
        fetchSSH();
    }, []);

    async function fetchSSH() {
        setLoadingSSH(true);
        setErrorSSH(undefined);
        try {
            const hosts = await getSSHHosts();
            console.log('Loaded SSH hosts:', hosts);
            // Filter hosts to only show those with enableConfigEditor: true
            const configEditorHosts = hosts.filter(host => host.enableConfigEditor);
            console.log('Config Editor hosts:', configEditorHosts);
            
            // Debug: Log the first host's credentials
            if (configEditorHosts.length > 0) {
                const firstHost = configEditorHosts[0];
                console.log('First host credentials:', {
                    id: firstHost.id,
                    name: firstHost.name,
                    ip: firstHost.ip,
                    username: firstHost.username,
                    authType: firstHost.authType,
                    hasPassword: !!firstHost.password,
                    hasKey: !!firstHost.key,
                    passwordLength: firstHost.password?.length,
                    keyLength: firstHost.key?.length
                });
            }
            
            setSSHConnections(configEditorHosts);
        } catch (err: any) {
            console.error('Failed to load SSH hosts:', err);
            setErrorSSH('Failed to load SSH connections');
        } finally {
            setLoadingSSH(false);
        }
    }

    // Helper to connect to SSH and set sessionId
    async function connectToSSH(server: SSHHost): Promise<string | null> {
        const sessionId = server.id.toString();
        
        // Check if we already have a recent connection to this server
        const cached = connectionCache[sessionId];
        if (cached && Date.now() - cached.timestamp < 30000) { // 30 second cache
            console.log('Using cached SSH connection for session:', sessionId);
            setSshSessionId(cached.sessionId);
            return cached.sessionId;
        }
        
        // Prevent multiple simultaneous connections
        if (connectingSSH) {
            console.log('SSH connection already in progress, skipping...');
            return null;
        }
        
        setConnectingSSH(true);
        
        try {
            console.log('Attempting SSH connection:', {
                sessionId,
                ip: server.ip,
                port: server.port,
                username: server.username,
                hasPassword: !!server.password,
                hasKey: !!server.key,
                authType: server.authType,
                passwordLength: server.password?.length,
                keyLength: server.key?.length
            });
            
            // Check if we have the necessary credentials
            if (!server.password && !server.key) {
                console.error('No authentication credentials available for SSH host');
                setFilesError('No authentication credentials available for this SSH host');
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
            
            console.log('SSH connection config:', {
                ...connectionConfig,
                password: connectionConfig.password ? '[REDACTED]' : undefined,
                sshKey: connectionConfig.sshKey ? '[REDACTED]' : undefined
            });
            
            await connectSSH(sessionId, connectionConfig);
            
            console.log('SSH connection successful for session:', sessionId);
            setSshSessionId(sessionId);
            
            // Cache the successful connection
            setConnectionCache(prev => ({
                ...prev,
                [sessionId]: { sessionId, timestamp: Date.now() }
            }));
            
            return sessionId;
        } catch (err: any) {
            console.error('SSH connection failed:', {
                sessionId,
                error: err?.response?.data?.error || err?.message,
                status: err?.response?.status,
                data: err?.response?.data
            });
            setFilesError(err?.response?.data?.error || 'Failed to connect to SSH');
            setSshSessionId(null);
            return null;
        } finally {
            setConnectingSSH(false);
        }
    }

    // Modified fetchFiles to handle SSH connect if needed
    async function fetchFiles() {
        // Prevent multiple simultaneous fetches
        if (fetchingFiles) {
            console.log('Already fetching files, skipping...');
            return;
        }
        
        setFetchingFiles(true);
        setFiles([]);
        setFilesLoading(true);
        setFilesError(null);
        
        try {
            // Get pinned files to check against for current host
            let pinnedFiles: any[] = [];
            try {
                if (activeServer) {
                    pinnedFiles = await getConfigEditorPinned(activeServer.id);
                    console.log('Fetched pinned files:', pinnedFiles);
                }
            } catch (err) {
                console.error('Failed to fetch pinned files:', err);
            }
            
            if (activeServer && sshSessionId) {
                console.log('Fetching files for path:', currentPath, 'sessionId:', sshSessionId);
                
                let res: any[] = [];
                
                // Check if SSH session is still valid
                try {
                    const status = await getSSHStatus(sshSessionId);
                    console.log('SSH session status:', status);
                    if (!status.connected) {
                        console.log('SSH session not connected, reconnecting...');
                        const newSessionId = await connectToSSH(activeServer);
                        if (newSessionId) {
                            setSshSessionId(newSessionId);
                            // Retry with new session
                            res = await listSSHFiles(newSessionId, currentPath);
                            console.log('Retry - Raw SSH files response:', res);
                            console.log('Retry - Files count:', res?.length || 0);
                        } else {
                            throw new Error('Failed to reconnect SSH session');
                        }
                    } else {
                        res = await listSSHFiles(sshSessionId, currentPath);
                        console.log('Raw SSH files response:', res);
                        console.log('Files count:', res?.length || 0);
                        console.log('Response type:', typeof res, 'Is array:', Array.isArray(res));
                    }
                } catch (sessionErr) {
                    console.error('SSH session check failed:', sessionErr);
                    // Try to reconnect and retry
                    const newSessionId = await connectToSSH(activeServer);
                    if (newSessionId) {
                        setSshSessionId(newSessionId);
                        res = await listSSHFiles(newSessionId, currentPath);
                        console.log('Reconnect - Raw SSH files response:', res);
                        console.log('Reconnect - Files count:', res?.length || 0);
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
                
                console.log('Processed files with pin states:', processedFiles);
                setFiles(processedFiles);
            }
        } catch (err: any) {
            console.error('Error in fetchFiles:', err);
            console.error('Error details:', {
                message: err?.message,
                response: err?.response?.data,
                status: err?.response?.status,
                statusText: err?.response?.statusText
            });
            setFiles([]);
            setFilesError(err?.response?.data?.error || err?.message || 'Failed to list files');
        } finally {
            setFilesLoading(false);
            setFetchingFiles(false);
        }
    }

    // When activeServer, currentPath, or sshSessionId changes, fetch files
    useEffect(() => {
        console.log('useEffect triggered:', { view, activeServer: !!activeServer, sshSessionId, currentPath });
        
        // Only fetch files if we're in files view, have an active server, and a valid session
        if (view === 'files' && activeServer && sshSessionId && !connectingSSH && !fetchingFiles) {
            console.log('Calling fetchFiles...');
            // Add a small delay to prevent rapid reconnections
            const timeoutId = setTimeout(() => {
                fetchFiles();
            }, 100);
            return () => clearTimeout(timeoutId);
        }
        // eslint-disable-next-line
    }, [currentPath, view, activeServer, sshSessionId]);

    // When switching servers, reset sessionId and errors
    async function handleSelectServer(server: SSHHost) {
        // Prevent multiple rapid server selections
        if (connectingSSH) {
            console.log('SSH connection in progress, ignoring server selection');
            return;
        }
        
        // Reset all states when switching servers
        setFetchingFiles(false);
        setFilesLoading(false);
        setFilesError(null);
        setFiles([]); // Clear files immediately to show loading state
        
        setActiveServer(server);
        setCurrentPath(server.defaultPath || '/');
        setView('files');
        
        // Establish SSH connection immediately when server is selected
        const sessionId = await connectToSSH(server);
        if (sessionId) {
            setSshSessionId(sessionId);
            // Notify parent component about host change
            if (onHostChange) {
                onHostChange(server);
            }
        } else {
            // If SSH connection fails, stay in servers view
            setView('servers');
            setActiveServer(null);
        }
    }

    useImperativeHandle(ref, () => ({
        openFolder: async (server: SSHHost, path: string) => {
            console.log('openFolder called:', { serverId: server.id, path, currentPath, activeServerId: activeServer?.id });
            
            // Prevent multiple simultaneous folder opens
            if (connectingSSH || fetchingFiles) {
                console.log('SSH connection or file fetch in progress, skipping folder open');
                return;
            }
            
            // If we're already on the same server and path, just refresh files
            if (activeServer?.id === server.id && currentPath === path) {
                console.log('Already on same server and path, just refreshing files');
                // Add a small delay to prevent rapid successive calls
                setTimeout(() => fetchFiles(), 100);
                return;
            }
            
            // Reset all states when opening a folder
            setFetchingFiles(false);
            setFilesLoading(false);
            setFilesError(null);
            setFiles([]);
            
            setActiveServer(server);
            setCurrentPath(path);
            setView('files');
            
            // Only establish SSH connection if we don't already have one for this server
            if (!sshSessionId || activeServer?.id !== server.id) {
                console.log('Establishing new SSH connection for server:', server.id);
                const sessionId = await connectToSSH(server);
                if (sessionId) {
                    setSshSessionId(sessionId);
                    // Only notify parent component about host change if the server actually changed
                    if (onHostChange && activeServer?.id !== server.id) {
                        onHostChange(server);
                    }
                } else {
                    // If SSH connection fails, stay in servers view
                    setView('servers');
                    setActiveServer(null);
                }
            } else {
                console.log('Using existing SSH session for server:', server.id);
                // Only notify parent component about host change if the server actually changed
                if (onHostChange && activeServer?.id !== server.id) {
                    onHostChange(server);
                }
            }
        },
        fetchFiles: () => {
            if (activeServer && sshSessionId) {
                fetchFiles();
            }
        }
    }));

    // Path input focus scroll
    useEffect(() => {
        if (pathInputRef.current) {
            pathInputRef.current.scrollLeft = pathInputRef.current.scrollWidth;
        }
    }, [currentPath]);

    // Group SSH connections by folder
    const sshByFolder: Record<string, SSHHost[]> = {};
    sshConnections.forEach(conn => {
        const folder = conn.folder && conn.folder.trim() ? conn.folder : 'No Folder';
        if (!sshByFolder[folder]) sshByFolder[folder] = [];
        sshByFolder[folder].push(conn);
    });
    // Move 'No Folder' to the top
    const sortedFolders = Object.keys(sshByFolder);
    if (sortedFolders.includes('No Folder')) {
        sortedFolders.splice(sortedFolders.indexOf('No Folder'), 1);
        sortedFolders.unshift('No Folder');
    }

    // Filter hosts by search
    const filteredSshByFolder: Record<string, SSHHost[]> = {};
    Object.entries(sshByFolder).forEach(([folder, hosts]) => {
        filteredSshByFolder[folder] = hosts.filter(conn => {
            const q = debouncedSearch.trim().toLowerCase();
            if (!q) return true;
            return (conn.name || '').toLowerCase().includes(q) || (conn.ip || '').toLowerCase().includes(q) ||
                   (conn.username || '').toLowerCase().includes(q) || (conn.folder || '').toLowerCase().includes(q) ||
                   (conn.tags || []).join(' ').toLowerCase().includes(q);
        });
    });

    // Filter files by search
    const filteredFiles = files.filter(file => {
        const q = debouncedFileSearch.trim().toLowerCase();
        if (!q) return true;
        return file.name.toLowerCase().includes(q);
    });

    // --- Render ---
    return (
        <SidebarProvider>
            <Sidebar style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
                <SidebarContent style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
                    <SidebarGroup className="flex flex-col flex-grow h-full overflow-hidden">
                        <SidebarGroupLabel className="text-lg font-bold text-white flex items-center gap-2">
                            Termix / Config
                        </SidebarGroupLabel>
                        <Separator className="p-0.25 mt-1 mb-1"/>
                        <SidebarGroupContent className="flex flex-col flex-grow min-h-0">
                            <SidebarMenu>
                                <SidebarMenuItem key={"Homepage"}>
                                    <Button className="w-full mt-2 mb-2 h-8" onClick={() => onSelectView("homepage")}
                                            variant="outline">
                                        <CornerDownLeft/>
                                        Return
                                    </Button>
                                    <Separator className="p-0.25 mt-1 mb-1"/>
                                </SidebarMenuItem>
                            </SidebarMenu>
                            {/* Main black div: servers list or file/folder browser */}
                            <div className="flex-1 w-full flex flex-col rounded-md bg-[#09090b] border border-[#434345] overflow-hidden p-0 relative min-h-0 mt-1">
                                {view === 'servers' && (
                                    <>
                                        {/* Search bar - outside ScrollArea so it's always visible */}
                                        <div className="w-full px-2 pt-2 pb-2 bg-[#09090b] z-10 border-b border-[#23232a]">
                                            <Input
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                placeholder="Search hosts by name, username, IP, folder, tags..."
                                                className="w-full h-8 text-sm bg-[#18181b] border border-[#23232a] text-white placeholder:text-muted-foreground rounded"
                                                autoComplete="off"
                                            />
                                        </div>
                                        <ScrollArea className="flex-1 w-full h-full" style={{ height: '100%', maxHeight: '100%' }}>
                                            <div className="flex flex-col h-full">
                                                {/* SSH hosts/folders section */}
                                                <div className="w-full flex-grow overflow-hidden p-0 m-0 relative flex flex-col min-h-0">
                                                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                        <Separator className="w-full h-px bg-[#434345] my-2" style={{ maxWidth: 213, margin: '0 auto' }} />
                                                    </div>
                                                    {/* Host list */}
                                                    <div className="mx-auto" style={{maxWidth: '213px', width: '100%'}}>
                                                        {/* Accordion for folders/hosts */}
                                                        <div className="flex-1 min-h-0">
                                                            <Accordion type="multiple" className="w-full" value={sortedFolders}>
                                                                {sortedFolders.map((folder, idx) => (
                                                                    <React.Fragment key={folder}>
                                                                        <AccordionItem value={folder} className="mt-0 w-full !border-b-transparent">
                                                                            <AccordionTrigger
                                                                                className="text-base font-semibold rounded-t-none py-2 w-full">{folder}</AccordionTrigger>
                                                                            <AccordionContent
                                                                                className="flex flex-col gap-1 pb-2 pt-1 w-full">
                                                                                {filteredSshByFolder[folder].map(conn => (
                                                                                    <Button
                                                                                        key={conn.id}
                                                                                        variant="outline"
                                                                                        className="w-full h-10 px-2 bg-[#18181b] border border-[#434345] hover:bg-[#2d2d30] transition-colors text-left justify-start"
                                                                                        onClick={() => handleSelectServer(conn)}
                                                                                    >
                                                                                        <div className="flex items-center w-full">
                                                                                            {conn.pin && <Pin
                                                                                                className="w-0.5 h-0.5 text-yellow-400 mr-1 flex-shrink-0" />}
                                                                                            <span className="font-medium truncate">{conn.name || conn.ip}</span>
                                                                                        </div>
                                                                                    </Button>
                                                                                ))}
                                                                            </AccordionContent>
                                                                        </AccordionItem>
                                                                        {idx < sortedFolders.length - 1 && (
                                                                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                                <Separator className="h-px bg-[#434345] my-1" style={{ width: 213 }} />
                                                                            </div>
                                                                        )}
                                                                    </React.Fragment>
                                                                ))}
                                                            </Accordion>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </ScrollArea>
                                    </>
                                )}
                                {view === 'files' && activeServer && (
                                    <div className="flex flex-col h-full w-full" style={{ maxWidth: 260 }}>
                                        {/* Sticky path input bar - outside ScrollArea */}
                                        <div className="flex items-center gap-2 px-2 py-2 border-b border-[#23232a] bg-[#18181b] z-20" style={{ maxWidth: 260 }}>
                                            <Button
                                                size="icon"
                                                variant="outline"
                                                className="h-8 w-8 bg-[#18181b] border border-[#23232a] rounded-md hover:bg-[#2d2d30] focus:outline-none focus:ring-2 focus:ring-ring"
                                                onClick={() => {
                                                    // If not at root, go up one directory; else, go back to servers view
                                                    let path = currentPath;
                                                    if (path && path !== '/' && path !== '') {
                                                        // Remove trailing slash if present
                                                        if (path.endsWith('/')) path = path.slice(0, -1);
                                                        const lastSlash = path.lastIndexOf('/');
                                                        if (lastSlash > 0) {
                                                            setCurrentPath(path.slice(0, lastSlash));
                                                        } else {
                                                            setCurrentPath('/');
                                                        }
                                                    } else {
                                                        setView('servers');
                                                        if (onHostChange) {
                                                            onHostChange(null);
                                                        }
                                                    }
                                                }}
                                            >
                                                <ArrowUp className="w-4 h-4"/>
                                            </Button>
                                            <Input ref={pathInputRef} value={currentPath}
                                                   onChange={e => setCurrentPath(e.target.value)}
                                                   className="flex-1 bg-[#18181b] border border-[#434345] text-white truncate rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring hover:border-[#5a5a5d]"
                                            />
                                        </div>
                                        {/* File search bar */}
                                        <div className="px-2 py-2 border-b border-[#23232a] bg-[#18181b]">
                                            <Input
                                                placeholder="Search files and folders..."
                                                className="w-full h-7 text-sm bg-[#23232a] border border-[#434345] text-white placeholder:text-muted-foreground rounded"
                                                autoComplete="off"
                                                value={fileSearch}
                                                onChange={e => setFileSearch(e.target.value)}
                                            />
                                        </div>
                                        {/* File list with proper scroll area - separate from topbar */}
                                        <div className="flex-1 w-full h-full bg-[#09090b] border-t border-[#23232a]">
                                            <ScrollArea className="w-full h-full bg-[#09090b]" style={{ height: '100%', maxHeight: '100%', paddingRight: 8, scrollbarGutter: 'stable', background: '#09090b' }}>
                                                <div className="p-2 pr-2">
                                                    {connectingSSH || filesLoading ? (
                                                        <div className="text-xs text-muted-foreground">Loading...</div>
                                                    ) : filesError ? (
                                                        <div className="text-xs text-red-500">{filesError}</div>
                                                    ) : filteredFiles.length === 0 ? (
                                                        <div className="text-xs text-muted-foreground">No files or folders found.</div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            {filteredFiles.map((item: any) => {
                                                                const isOpen = (tabs || []).some((t: any) => t.id === item.path);
                                                                return (
                                                                    <div
                                                                        key={item.path}
                                                                        className={cn(
                                                                            "flex items-center gap-2 px-3 py-2 bg-[#18181b] border border-[#23232a] rounded group max-w-full",
                                                                            isOpen && "opacity-60 cursor-not-allowed pointer-events-none"
                                                                        )}
                                                                        style={{ maxWidth: 220, marginBottom: 8 }}
                                                                    >
                                                                        <div
                                                                            className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                                                                            onClick={() => !isOpen && (item.type === 'directory' ? setCurrentPath(item.path) : onOpenFile({
                                                name: item.name,
                                                path: item.path,
                                                isSSH: item.isSSH,
                                                sshSessionId: item.sshSessionId
                                            }))}
                                                                        >
                                                                            {item.type === 'directory' ?
                                                                                <Folder className="w-4 h-4 text-blue-400"/> :
                                                                                <File className="w-4 h-4 text-muted-foreground"/>}
                                                                            <span className="text-sm text-white truncate max-w-[120px]">{item.name}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-1">
                                                                            {item.type === 'file' && (
                                                                                <Button size="icon" variant="ghost"
                                                                                        className="h-7 w-7"
                                                                                        disabled={isOpen}
                                                                                        onClick={async (e) => {
                                                                                            e.stopPropagation();
                                                                                            try {
                                                                                                if (item.isPinned) {
                                                                                                    await removeConfigEditorPinned({ 
                                                                                                        name: item.name, 
                                                                                                        path: item.path,
                                                                                                        hostId: activeServer?.id,
                                                                                                        isSSH: true,
                                                                                                        sshSessionId: activeServer?.id.toString()
                                                                                                    });
                                                                                                    // Update local state without refreshing
                                                                                                    setFiles(files.map(f => 
                                                                                                        f.path === item.path ? { ...f, isPinned: false } : f
                                                                                                    ));
                                                                                                } else {
                                                                                                    await addConfigEditorPinned({ 
                                                                                                        name: item.name, 
                                                                                                        path: item.path,
                                                                                                        hostId: activeServer?.id,
                                                                                                        isSSH: true,
                                                                                                        sshSessionId: activeServer?.id.toString()
                                                                                                    });
                                                                                                    // Update local state without refreshing
                                                                                                    setFiles(files.map(f => 
                                                                                                        f.path === item.path ? { ...f, isPinned: true } : f
                                                                                                    ));
                                                                                                }
                                                                                            } catch (err) {
                                                                                                console.error('Failed to pin/unpin file:', err);
                                                                                            }
                                                                                        }}
                                                                                >
                                                                                    <Pin className={`w-1 h-1 ${item.isPinned ? 'text-yellow-400 fill-current' : 'text-muted-foreground'}`}/>
                                                                                </Button>
                                                                            )}
                                                                        </div>
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
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
        </SidebarProvider>
    );
});
export { ConfigEditorSidebar };