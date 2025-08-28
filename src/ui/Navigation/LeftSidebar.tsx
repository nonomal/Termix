import React, {useState} from 'react';
import {
    Computer,
    Server,
    File,
    Hammer, ChevronUp, User2, HardDrive, Trash2, Users, Shield, Settings, Menu, ChevronRight
} from "lucide-react";

import {
    Sidebar,
    SidebarContent, SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem, SidebarProvider, SidebarInset, SidebarHeader,
} from "@/components/ui/sidebar.tsx"

import {
    Separator,
} from "@/components/ui/separator.tsx"
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@radix-ui/react-dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose
} from "@/components/ui/sheet";
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
import {Card} from "@/components/ui/card.tsx";
import {FolderCard} from "@/ui/Navigation/Hosts/FolderCard.tsx";
import {getSSHHosts} from "@/ui/main-axios.ts";
import {useTabs} from "@/ui/Navigation/Tabs/TabContext.tsx";
import { 
    getOIDCConfig, 
    getUserList, 
    makeUserAdmin, 
    removeAdminStatus, 
    deleteUser, 
    deleteAccount 
} from "@/ui/main-axios.ts";

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

interface SidebarProps {
    onSelectView: (view: string) => void;
    getView?: () => string;
    disabled?: boolean;
    isAdmin?: boolean;
    username?: string | null;
    children?: React.ReactNode;
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



export function LeftSidebar({
                                onSelectView,
                                getView,
                                disabled,
                                isAdmin,
                                username,
                                children,
                            }: SidebarProps): React.ReactElement {
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

    const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

    const {tabs: tabList, addTab, setCurrentTab, allSplitScreenTab} = useTabs() as any;
    const isSplitScreenActive = Array.isArray(allSplitScreenTab) && allSplitScreenTab.length > 0;
    const sshManagerTab = tabList.find((t) => t.type === 'ssh_manager');
    const openSshManagerTab = () => {
        if (sshManagerTab || isSplitScreenActive) return;
        const id = addTab({type: 'ssh_manager', title: 'SSH Manager'} as any);
        setCurrentTab(id);
    };
    const adminTab = tabList.find((t) => t.type === 'admin');
    const openAdminTab = () => {
        if (isSplitScreenActive) return;
        if (adminTab) {
            setCurrentTab(adminTab.id);
            return;
        }
        const id = addTab({type: 'admin', title: 'Admin'} as any);
        setCurrentTab(id);
    };

    const [hosts, setHosts] = useState<SSHHost[]>([]);
    const [hostsLoading, setHostsLoading] = useState(false);
    const [hostsError, setHostsError] = useState<string | null>(null);
    const prevHostsRef = React.useRef<SSHHost[]>([]);
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    React.useEffect(() => {
        if (adminSheetOpen) {
            const jwt = getCookie("jwt");
            if (jwt && isAdmin) {
                getOIDCConfig().then(res => {
                    if (res) {
                        setOidcConfig(res);
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

    React.useEffect(() => {
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

    React.useEffect(() => {
        fetchHosts();
        const interval = setInterval(fetchHosts, 300000); // 5 minutes instead of 10 seconds
        return () => clearInterval(interval);
    }, [fetchHosts]);

    React.useEffect(() => {
        const handleHostsChanged = () => {
            fetchHosts();
        };
        window.addEventListener('ssh-hosts:changed', handleHostsChanged as EventListener);
        return () => window.removeEventListener('ssh-hosts:changed', handleHostsChanged as EventListener);
    }, [fetchHosts]);

    React.useEffect(() => {
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
            await deleteAccount(deletePassword);

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
            const response = await getUserList();
            setUsers(response.users);

            const adminUsers = response.users.filter((user: any) => user.is_admin);
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
            const response = await getUserList();
            const adminUsers = response.users.filter((user: any) => user.is_admin);
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
            await makeUserAdmin(newAdminUsername.trim());
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
            await removeAdminStatus(username);
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
            await deleteUser(username);
            fetchUsers();
        } catch (err: any) {
        }
    };

    return (
        <div className="min-h-svh">
            <SidebarProvider open={isSidebarOpen}>
                <Sidebar variant="floating" className="">
                    <SidebarHeader>
                        <SidebarGroupLabel className="text-lg font-bold text-white">
                            Termix
                            <Button
                                variant="outline"
                                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                                className="w-[28px] h-[28px] absolute right-5"
                            >
                                <Menu className="h-4 w-4"/>
                            </Button>
                        </SidebarGroupLabel>
                    </SidebarHeader>
                    <Separator className="p-0.25"/>
                    <SidebarContent>
                        <SidebarGroup className="!m-0 !p-0 !-mb-2">
                            <Button className="m-2 flex flex-row font-semibold" variant="outline"
                                    onClick={openSshManagerTab} disabled={!!sshManagerTab || isSplitScreenActive}
                                    title={sshManagerTab ? 'SSH Manager already open' : isSplitScreenActive ? 'Disabled during split screen' : undefined}>
                                <HardDrive strokeWidth="2.5"/>
                                Host Manager
                            </Button>
                        </SidebarGroup>
                        <Separator className="p-0.25"/>
                        <SidebarGroup className="flex flex-col gap-y-2 !-mt-2">
                            <div className="bg-[#131316] rounded-lg">
                                <Input
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Search hosts by any info..."
                                    className="w-full h-8 text-sm border-2 border-[#272728] rounded-lg"
                                    autoComplete="off"
                                />
                            </div>

                            {hostsError && (
                                <div className="px-1">
                                    <div
                                        className="text-xs text-red-500 bg-red-500/10 rounded-lg px-2 py-1 border w-full">
                                        {hostsError}
                                    </div>
                                </div>
                            )}

                            {hostsLoading && (
                                <div className="px-4 pb-2">
                                    <div className="text-xs text-muted-foreground text-center">
                                        Loading hosts...
                                    </div>
                                </div>
                            )}

                            {sortedFolders.map((folder, idx) => (
                                <FolderCard
                                    key={`folder-${folder}-${hostsByFolder[folder]?.length || 0}`}
                                    folderName={folder}
                                    hosts={getSortedHosts(hostsByFolder[folder])}
                                    isFirst={idx === 0}
                                    isLast={idx === sortedFolders.length - 1}
                                />
                            ))}
                        </SidebarGroup>
                    </SidebarContent>
                    <Separator className="p-0.25 mt-1 mb-1"/>
                    <SidebarFooter>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <SidebarMenuButton
                                            className="data-[state=open]:opacity-90 w-full"
                                            style={{width: '100%'}}
                                            disabled={disabled}
                                        >
                                            <User2/> {username ? username : 'Signed out'}
                                            <ChevronUp className="ml-auto"/>
                                        </SidebarMenuButton>
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
                                                    if (isAdmin) openAdminTab();
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
                                            <span
                                                className={isAdmin && adminCount <= 1 ? "text-muted-foreground" : "text-red-400"}>
                                                Delete Account
                                                {isAdmin && adminCount <= 1 && " (Last Admin)"}
                                            </span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>


                </Sidebar>
                <SidebarInset>
                    {children}
                </SidebarInset>
            </SidebarProvider>

            {!isSidebarOpen && (
                <div
                    onClick={() => setIsSidebarOpen(true)}
                    className="absolute top-0 left-0 w-[10px] h-full bg-[#18181b] cursor-pointer z-20 flex items-center justify-center rounded-tr-md rounded-br-md">
                    <ChevronRight size={10}/>
                </div>
            )}

            {deleteAccountOpen && (
                <div
                    className="fixed inset-0 z-[999999] flex"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 999999,
                        pointerEvents: 'auto',
                        isolation: 'isolate',
                        transform: 'translateZ(0)',
                        willChange: 'z-index'
                    }}
                >
                    <div
                        className="w-[400px] h-full bg-[#18181b] border-r-2 border-[#303032] flex flex-col shadow-2xl"
                        style={{
                            backgroundColor: '#18181b',
                            boxShadow: '4px 0 20px rgba(0, 0, 0, 0.5)',
                            zIndex: 9999999,
                            position: 'relative',
                            isolation: 'isolate',
                            transform: 'translateZ(0)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
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
                                className="h-8 w-8 p-0 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center"
                                title="Close Delete Account"
                            >
                                <span className="text-lg font-bold leading-none">×</span>
                            </Button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4">
                            <div className="space-y-4">
                                <div className="text-sm text-gray-300">
                                    This action cannot be undone. This will permanently delete your account and all
                                    associated data.
                                </div>

                                <Alert variant="destructive">
                                    <AlertTitle>Warning</AlertTitle>
                                    <AlertDescription>
                                        Deleting your account will remove all your data including SSH hosts,
                                        configurations, and settings.
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
                                                You are the last admin user. You cannot delete your account as this
                                                would leave the system without any administrators.
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

                    <div
                        className="flex-1"
                        onClick={() => {
                            setDeleteAccountOpen(false);
                            setDeletePassword("");
                            setDeleteError(null);
                        }}
                        style={{cursor: 'pointer'}}
                    />
                </div>
            )}
        </div>
    )
}