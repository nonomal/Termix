import React, {useState, useEffect} from 'react';
import {
    Computer,
    Server,
    File,
    Hammer, ChevronUp, User2, HardDrive, Trash2, Users, Shield, Settings, Menu, ChevronRight, X
} from "lucide-react";

import {
    Separator,
} from "@/components/ui/separator.tsx"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@radix-ui/react-dropdown-menu";
import {Checkbox} from "@/components/ui/checkbox.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Label} from "@/components/ui/label.tsx";
import {Button} from "@/components/ui/button.tsx";
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
import {Card} from "@/components/ui/card.tsx";
import {getSSHHosts} from "@/ui/main-axios.ts";

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

export function MobileLeftSidebar({
    isOpen,
    onClose,
    onSelectView,
    isAdmin,
    username,
}: MobileLeftSidebarProps): React.ReactElement {
    const [adminSheetOpen, setAdminSheetOpen] = React.useState(false);
    const [deleteAccountOpen, setDeleteAccountOpen] = React.useState(false);
    const [deletePassword, setDeletePassword] = React.useState("");
    const [deleteLoading, setDeleteLoading] = React.useState(false);
    const [deleteError, setDeleteError] = React.useState<string | null>(null);
    const [adminCount, setAdminCount] = React.useState(0);

    const [users, setUsers] = React.useState<Array<{
        id: string;
        username: string;
        is_admin: boolean;
        is_oidc: boolean;
    }>>([]);
    const [newAdminUsername, setNewAdminUsername] = React.useState("");
    const [usersLoading, setUsersLoading] = React.useState(false);
    const [makeAdminLoading, setMakeAdminLoading] = React.useState(false);
    const [makeAdminError, setMakeAdminError] = React.useState<string | null>(null);
    const [makeAdminSuccess, setMakeAdminSuccess] = React.useState<string | null>(null);
    const [oidcConfig, setOidcConfig] = React.useState<any>(null);

    const [hosts, setHosts] = useState<SSHHost[]>([]);
    const [hostsLoading, setHostsLoading] = useState(false);
    const [hostsError, setHostsError] = useState<string | null>(null);
    const prevHostsRef = React.useRef<SSHHost[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    useEffect(() => {
        if (adminSheetOpen) {
            const jwt = getCookie("jwt");
            if (jwt && isAdmin) {
                API.get("/oidc-config").then(res => {
                    if (res.data) {
                        setOidcConfig(res.data);
                    }
                }).catch((error) => {
                });
                fetchUsers();
            }
        } else {
            const jwt = getCookie("jwt");
            if (jwt && isAdmin) {
                fetchAdminCount();
            }
        }
    }, [adminSheetOpen, isAdmin]);

    useEffect(() => {
        if (!isAdmin) {
            setAdminSheetOpen(false);
            setUsers([]);
            setAdminCount(0);
        }
    }, [isAdmin]);

    const fetchHosts = React.useCallback(async () => {
        try {
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
        }
    }, []);

    useEffect(() => {
        fetchHosts();
        const interval = setInterval(fetchHosts, 10000);
        return () => clearInterval(interval);
    }, [fetchHosts]);

    useEffect(() => {
        const handleHostsChanged = () => {
            fetchHosts();
        };
        window.addEventListener('ssh-hosts:changed', handleHostsChanged as EventListener);
        return () => window.removeEventListener('ssh-hosts:changed', handleHostsChanged as EventListener);
    }, [fetchHosts]);

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

    const handleDeleteAccount = async (e: React.FormEvent) => {
        e.preventDefault();
        setDeleteLoading(true);
        setDeleteError(null);

        if (!deletePassword.trim()) {
            setDeleteError("Password is required");
            setDeleteLoading(false);
            return;
        }

        const jwt = getCookie("jwt");
        try {
            await API.delete("/delete-account", {
                headers: {Authorization: `Bearer ${jwt}`},
                data: {password: deletePassword}
            });

            handleLogout();
        } catch (err: any) {
            setDeleteError(err?.response?.data?.error || "Failed to delete account");
            setDeleteLoading(false);
        }
    };

    const fetchUsers = async () => {
        const jwt = getCookie("jwt");

        if (!jwt || !isAdmin) {
            return;
        }

        setUsersLoading(true);
        try {
            const response = await API.get("/list", {
                headers: {Authorization: `Bearer ${jwt}`}
            });
            setUsers(response.data.users);

            const adminUsers = response.data.users.filter((user: any) => user.is_admin);
            setAdminCount(adminUsers.length);
        } catch (err: any) {
        } finally {
            setUsersLoading(false);
        }
    };

    const fetchAdminCount = async () => {
        const jwt = getCookie("jwt");

        if (!jwt || !isAdmin) {
            return;
        }

        try {
            const response = await API.get("/list", {
                headers: {Authorization: `Bearer ${jwt}`}
            });
            const adminUsers = response.data.users.filter((user: any) => user.is_admin);
            setAdminCount(adminUsers.length);
        } catch (err: any) {
        }
    };

    const makeUserAdmin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAdminUsername.trim()) return;

        if (!isAdmin) {
            return;
        }

        setMakeAdminLoading(true);
        setMakeAdminError(null);
        setMakeAdminSuccess(null);

        const jwt = getCookie("jwt");
        try {
            await API.post("/make-admin",
                {username: newAdminUsername.trim()},
                {headers: {Authorization: `Bearer ${jwt}`}}
            );
            setMakeAdminSuccess(`User ${newAdminUsername} is now an admin`);
            setNewAdminUsername("");
            fetchUsers();
        } catch (err: any) {
            setMakeAdminError(err?.response?.data?.error || "Failed to make user admin");
        } finally {
            setMakeAdminLoading(false);
        }
    };

    const removeAdminStatus = async (username: string) => {
        if (!confirm(`Are you sure you want to remove admin status from ${username}?`)) return;

        if (!isAdmin) {
            return;
        }

        const jwt = getCookie("jwt");
        try {
            await API.post("/remove-admin",
                {username},
                {headers: {Authorization: `Bearer ${jwt}`}}
            );
            fetchUsers();
        } catch (err: any) {
        }
    };

    const deleteUser = async (username: string) => {
        if (!confirm(`Are you sure you want to delete user ${username}? This action cannot be undone.`)) return;

        if (!isAdmin) {
            return;
        }

        const jwt = getCookie("jwt");
        try {
            await API.delete("/delete-user", {
                headers: {Authorization: `Bearer ${jwt}`},
                data: {username}
            });
            fetchUsers();
        } catch (err: any) {
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 z-40"
                onClick={onClose}
            />
            
            {/* Sidebar */}
            <div className="fixed left-0 top-0 h-full w-80 max-w-[85vw] bg-[#18181b] border-r-2 border-[#303032] z-50 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[#303032]">
                    <h1 className="text-lg font-bold text-white">Termix</h1>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onClose}
                        className="h-8 w-8 p-0"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">
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
                            <div className="text-xs text-red-500 bg-red-500/10 rounded-lg px-2 py-1 border w-full">
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
                    {sortedFolders.map((folder, idx) => (
                        <div key={`folder-${folder}-${hostsByFolder[folder]?.length || 0}`} className="space-y-2">
                            <h3 className="text-sm font-medium text-gray-300 px-2">
                                {folder}
                            </h3>
                            <div className="space-y-1">
                                {getSortedHosts(hostsByFolder[folder]).map(host => (
                                    <div
                                        key={host.id}
                                        className="flex items-center justify-between p-2 bg-[#272728] rounded-lg hover:bg-[#303032] cursor-pointer active:bg-[#404040] transition-colors"
                                        onClick={() => {
                                            onSelectView('terminal', host);
                                            onClose();
                                        }}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                {host.pin && <span className="text-yellow-400">📍</span>}
                                                <span className="font-medium text-white truncate">
                                                    {host.name || host.username}
                                                </span>
                                            </div>
                                            <div className="text-xs text-gray-400 truncate">
                                                {host.username}@{host.ip}:{host.port}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {host.enableTerminal && (
                                                <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">
                                                    Terminal
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="border-t border-[#303032] p-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="w-full justify-between"
                                disabled={false}
                            >
                                <div className="flex items-center gap-2">
                                    <User2 className="h-4 w-4" />
                                    <span>{username ? username : 'Signed out'}</span>
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
                            {isAdmin && (
                                <DropdownMenuItem
                                    className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none"
                                    onClick={() => {
                                        onSelectView('admin');
                                        onClose();
                                    }}>
                                    <span>Admin Settings</span>
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                                className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none"
                                onClick={handleLogout}>
                                <span>Sign out</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none"
                                onClick={() => setDeleteAccountOpen(true)}
                                disabled={isAdmin && adminCount <= 1}
                            >
                                <span className={isAdmin && adminCount <= 1 ? "text-muted-foreground" : "text-red-400"}>
                                    Delete Account
                                    {isAdmin && adminCount <= 1 && " (Last Admin)"}
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Delete Account Modal */}
            {deleteAccountOpen && (
                <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4">
                    <div className="w-full max-w-md bg-[#18181b] border-2 border-[#303032] rounded-lg shadow-2xl">
                        <div className="flex items-center justify-between p-4 border-b border-[#303032]">
                            <h2 className="text-lg font-semibold text-white">Delete Account</h2>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setDeleteAccountOpen(false);
                                    setDeletePassword("");
                                    setDeleteError(null);
                                }}
                                className="h-8 w-8 p-0 hover:bg-red-500 hover:text-white transition-colors"
                            >
                                <span className="text-lg font-bold leading-none">×</span>
                            </Button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="text-sm text-gray-300">
                                This action cannot be undone. This will permanently delete your account and all associated data.
                            </div>

                            <Alert variant="destructive">
                                <AlertTitle>Warning</AlertTitle>
                                <AlertDescription>
                                    Deleting your account will remove all your data including SSH hosts, configurations, and settings.
                                    This action is irreversible.
                                </AlertDescription>
                            </Alert>

                            {deleteError && (
                                <Alert variant="destructive">
                                    <AlertTitle>Error</AlertTitle>
                                    <AlertDescription>{deleteError}</AlertDescription>
                                </Alert>
                            )}

                            <form onSubmit={handleDeleteAccount} className="space-y-4">
                                {isAdmin && adminCount <= 1 && (
                                    <Alert variant="destructive">
                                        <AlertTitle>Cannot Delete Account</AlertTitle>
                                        <AlertDescription>
                                            You are the last admin user. You cannot delete your account as this would leave the system without any administrators.
                                            Please make another user an admin first, or contact system support.
                                        </AlertDescription>
                                    </Alert>
                                )}

                                <div className="space-y-2">
                                    <Label htmlFor="delete-password">Confirm Password</Label>
                                    <Input
                                        id="delete-password"
                                        type="password"
                                        value={deletePassword}
                                        onChange={(e) => setDeletePassword(e.target.value)}
                                        placeholder="Enter your password to confirm"
                                        required
                                        disabled={isAdmin && adminCount <= 1}
                                    />
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        type="submit"
                                        variant="destructive"
                                        className="flex-1"
                                        disabled={deleteLoading || !deletePassword.trim() || (isAdmin && adminCount <= 1)}
                                    >
                                        {deleteLoading ? "Deleting..." : "Delete Account"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setDeleteAccountOpen(false);
                                            setDeletePassword("");
                                            setDeleteError(null);
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
