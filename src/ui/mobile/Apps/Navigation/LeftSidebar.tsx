import React, {useState, useEffect} from 'react';
import {
    Computer,
    Server,
    File,
    Hammer, ChevronUp, User2, HardDrive, Trash2, Users, Shield, Settings, Menu, ChevronRight, X, Folder, ChevronDown, Terminal
} from "lucide-react";

import {
    Separator,
} from "@/components/ui/separator.tsx"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@radix-ui/react-dropdown-menu";
import {Checkbox} from "@/components/ui/checkbox.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Button} from "@/components/ui/button.tsx";
import {ButtonGroup} from "@/components/ui/button-group.tsx";
import {Alert, AlertTitle, AlertDescription} from "@/components/ui/alert.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table.tsx";
import axios from "axios";
import {Card, CardTitle} from "@/components/ui/card.tsx";
import {getSSHHosts, getServerStatusById} from "@/ui/main-axios.ts";
import {Status, StatusIndicator} from "@/components/ui/shadcn-io/status";

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

interface MobileLeftSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectView: (view: string, host?: SSHHost) => void;
    isAdmin?: boolean;
    username?: string | null;
    onLogout?: () => void;
}

function handleLogout() {
    document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.reload();
}

function getCookie(name: string) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, "");
}

const apiBase = import.meta.env.DEV ? "http://localhost:8081/users" : "/users";

const API = axios.create({
    baseURL: apiBase,
});

// Mobile-specific FolderCard component that matches desktop Host.tsx exactly
function MobileFolderCard({folderName, hosts, isFirst, isLast, onSelectView, onClose}: {
    folderName: string;
    hosts: SSHHost[];
    isFirst: boolean;
    isLast: boolean;
    onSelectView: (view: string, host?: SSHHost) => void;
    onClose: () => void;
}) {
    const [isExpanded, setIsExpanded] = useState(true);
    const [serverStatuses, setServerStatuses] = useState<Record<number, 'online' | 'offline'>>({});

    const toggleExpanded = () => {
        setIsExpanded(!isExpanded);
    };

    // Fetch server statuses for all hosts in this folder
    useEffect(() => {
        // Only fetch statuses if there are hosts
        if (!hosts || hosts.length === 0) {
            setServerStatuses({});
            return;
        }

        const fetchStatuses = async () => {
            const statuses: Record<number, 'online' | 'offline'> = {};
            
            for (const host of hosts) {
                try {
                    const res = await getServerStatusById(host.id);
                    statuses[host.id] = res?.status === 'online' ? 'online' : 'offline';
                } catch {
                    statuses[host.id] = 'offline';
                }
            }
            
            setServerStatuses(statuses);
        };

        fetchStatuses();
        
        // Set up interval to refresh statuses every 30 seconds
        const interval = setInterval(fetchStatuses, 30000);
        return () => clearInterval(interval);
    }, [hosts]);

    return (
        <div className="bg-[#0e0e10] border-2 border-[#303032] rounded-lg overflow-hidden"
             style={{padding: '0', margin: '0'}}>
            <div className={`px-4 py-3 relative ${isExpanded ? 'border-b-2' : ''} bg-[#131316]`}>
                <div className="flex gap-2 pr-10">
                    <div className="flex-shrink-0 flex items-center">
                        <Folder size={16} strokeWidth={3}/>
                    </div>
                    <div className="flex-1 min-w-0">
                        <CardTitle className="mb-0 leading-tight break-words text-md">{folderName}</CardTitle>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="w-[28px] h-[28px] absolute right-4 top-1/2 -translate-y-1/2 flex-shrink-0"
                    onClick={toggleExpanded}
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : 'rotate-180'}`}/>
                </Button>
            </div>
            {isExpanded && (
                <div className="flex flex-col p-2 gap-y-3">
                    {hosts.map((host, index) => (
                        <React.Fragment key={`${folderName}-host-${host.id}-${host.name || host.ip}`}>
                            <div className="p-1 cursor-pointer hover:bg-[#272728] rounded transition-colors" onClick={() => {
                                onSelectView('terminal', host);
                                onClose();
                            }}>
                                <div className="flex items-center gap-2">
                                    <Status status={serverStatuses[host.id] || 'offline'} className="!bg-transparent !p-0.75 flex-shrink-0">
                                        <StatusIndicator/>
                                    </Status>
                                    <p className="font-semibold flex-1 min-w-0 break-words text-sm text-white">
                                        {host.name || host.ip}
                                    </p>
                                    <ButtonGroup className="flex-shrink-0">
                                        <Button 
                                            variant="outline" 
                                            className="!px-2 border-1 border-[#303032]" 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectView('server', host);
                                                onClose();
                                            }}
                                        >
                                            <Server className="h-4 w-4"/>
                                        </Button>
                                        {host.enableTerminal && (
                                            <Button
                                                variant="outline"
                                                className="!px-2 border-1 border-[#303032]"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectView('terminal', host);
                                                    onClose();
                                                }}
                                            >
                                                <Terminal className="h-4 w-4"/>
                                            </Button>
                                        )}
                                    </ButtonGroup>
                                </div>
                                {host.tags && host.tags.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        {host.tags.map((tag: string) => (
                                            <div key={tag} className="bg-[#18181b] border-1 border-[#303032] pl-2 pr-2 rounded-[10px]">
                                                <p className="text-sm text-gray-300">{tag}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {index < hosts.length - 1 && (
                                <div className="relative -mx-2">
                                    <Separator className="p-0.25 absolute inset-x-0"/>
                                </div>
                            )}
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    )
}

export function MobileLeftSidebar({
    isOpen,
    onClose,
    onSelectView,
    isAdmin,
    username,
    onLogout,
}: MobileLeftSidebarProps): React.ReactElement {
    const [hosts, setHosts] = useState<SSHHost[]>([]);
    const [hostsLoading, setHostsLoading] = useState(false);
    const [hostsError, setHostsError] = useState<string | null>(null);
    const prevHostsRef = React.useRef<SSHHost[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const fetchHosts = React.useCallback(async () => {
        // Only fetch hosts if user is logged in (username exists)
        if (!username) {
            setHosts([]);
            setHostsError(null);
            return;
        }

        try {
            setHostsLoading(true);
            setHostsError(null);
            const newHosts = await getSSHHosts();
            const prevHosts = prevHostsRef.current;

            const existingHostsMap = new Map(prevHosts.map(h => [h.id, h]));
            const newHostsMap = new Map(newHosts.map(h => [h.id, h]));

            let hasChanges = false;

            if (newHosts.length !== prevHosts.length) {
                hasChanges = true;
            } else {
                for (const [id, newHost] of newHostsMap) {
                    const existingHost = existingHostsMap.get(id);
                    if (!existingHost) {
                        hasChanges = true;
                        break;
                    }

                    if (
                        newHost.name !== existingHost.name ||
                        newHost.folder !== existingHost.folder ||
                        newHost.ip !== existingHost.ip ||
                        newHost.port !== existingHost.port ||
                        newHost.username !== existingHost.username ||
                        newHost.pin !== existingHost.pin ||
                        newHost.enableTerminal !== existingHost.enableTerminal ||
                        JSON.stringify(newHost.tags) !== JSON.stringify(existingHost.tags)
                    ) {
                        hasChanges = true;
                        break;
                    }
                }
            }

            if (hasChanges) {
                setTimeout(() => {
                    setHosts(newHosts);
                    prevHostsRef.current = newHosts;
                }, 50);
            }
        } catch (err: any) {
            setHostsError('Failed to load hosts');
        } finally {
            setHostsLoading(false);
        }
    }, [username]);

    useEffect(() => {
        fetchHosts();
        // Only set up interval if user is logged in
        if (username) {
            const interval = setInterval(fetchHosts, 10000);
            return () => clearInterval(interval);
        }
    }, [fetchHosts, username]);

    useEffect(() => {
        const handleHostsChanged = () => {
            if (username) {
                fetchHosts();
            }
        };
        window.addEventListener('ssh-hosts:changed', handleHostsChanged as EventListener);
        return () => window.removeEventListener('ssh-hosts:changed', handleHostsChanged as EventListener);
    }, [fetchHosts, username]);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(handler);
    }, [search]);

    const filteredHosts = React.useMemo(() => {
        if (!debouncedSearch.trim()) return hosts;
        const q = debouncedSearch.trim().toLowerCase();
        return hosts.filter(h => {
            const searchableText = [
                h.name || '',
                h.username,
                h.ip,
                h.folder || '',
                ...(h.tags || []),
                h.authType,
                h.defaultPath || ''
            ].join(' ').toLowerCase();
            return searchableText.includes(q);
        });
    }, [hosts, debouncedSearch]);

    const hostsByFolder = React.useMemo(() => {
        const map: Record<string, SSHHost[]> = {};
        filteredHosts.forEach(h => {
            const folder = h.folder && h.folder.trim() ? h.folder : 'No Folder';
            if (!map[folder]) map[folder] = [];
            map[folder].push(h);
        });
        return map;
    }, [filteredHosts]);

    const sortedFolders = React.useMemo(() => {
        const folders = Object.keys(hostsByFolder);
        folders.sort((a, b) => {
            if (a === 'No Folder') return -1;
            if (b === 'No Folder') return 1;
            return a.localeCompare(b);
        });
        return folders;
    }, [hostsByFolder]);

    const getSortedHosts = React.useCallback((arr: SSHHost[]) => {
        const pinned = arr.filter(h => h.pin).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const rest = arr.filter(h => !h.pin).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return [...pinned, ...rest];
    }, []);

    if (!isOpen) return <></>;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />
            
            {/* Mobile Sidebar */}
            <div className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-[#131316] border-r-2 border-[#303032] z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#303032] bg-[#18181b] flex-shrink-0">
                    <h1 className="text-lg font-bold text-white">Termix</h1>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        className="w-[28px] h-[28px]"
                    >
                        <X className="h-4 w-4"/>
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Search */}
                    <div className="bg-[#131316] rounded-lg">
                        <Input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search hosts by any info..."
                            className="w-full h-8 text-sm border-2 border-[#272728] rounded-lg"
                            autoComplete="off"
                        />
                    </div>

                    {/* Error Display */}
                    {hostsError && (
                        <div className="px-1">
                            <div
                                className="text-xs text-red-500 bg-red-500/10 rounded-lg px-2 py-1 border w-full">
                                {hostsError}
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {hostsLoading && (
                        <div className="px-4 pb-2">
                            <div className="text-xs text-muted-foreground text-center">
                                Loading hosts...
                            </div>
                        </div>
                    )}

                    {/* Hosts by Folder */}
                    <div>
                        {!username ? (
                            <div className="text-center py-8">
                                <div className="text-muted-foreground">
                                    <p className="text-sm">Please log in to view your hosts</p>
                                </div>
                            </div>
                        ) : hosts.length === 0 && !hostsLoading ? (
                            <div className="text-center py-8">
                                <div className="text-muted-foreground">
                                    <p className="text-sm">No hosts found</p>
                                    <p className="text-xs mt-1">Add some hosts to get started</p>
                                </div>
                            </div>
                        ) : (
                            sortedFolders.map((folder, idx) => (
                                <div key={`folder-${folder}-${hostsByFolder[folder]?.length || 0}`} className={idx < sortedFolders.length - 1 ? "mb-4" : ""}>
                                    <MobileFolderCard
                                        folderName={folder}
                                        hosts={getSortedHosts(hostsByFolder[folder])}
                                        isFirst={idx === 0}
                                        isLast={idx === sortedFolders.length - 1}
                                        onSelectView={onSelectView}
                                        onClose={onClose}
                                    />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="border-t border-[#303032] p-4 bg-[#18181b] flex-shrink-0">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-full justify-between"
                                disabled={false}
                            >
                                <div className="flex items-center gap-2">
                                    <User2 className="h-4 w-4" />
                                    <span>{username || 'Signed out'}</span>
                                </div>
                                <ChevronUp className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            side="top"
                            align="start"
                            sideOffset={6}
                            className="min-w-[var(--radix-popper-anchor-width)] bg-sidebar-accent text-sidebar-accent-foreground border border-border rounded-md shadow-2xl p-1"
                        >
                            <DropdownMenuItem
                                className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none"
                                onClick={handleLogout}>
                                <span>Sign out</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </>
    );
}
