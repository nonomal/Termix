import React, {useEffect, useState, useRef, forwardRef, useImperativeHandle} from 'react';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel, SidebarMenu, SidebarMenuItem,
    SidebarProvider
} from '@/components/ui/sidebar';
import {Separator} from '@/components/ui/separator';
import Icon from '../../../public/icon.svg';
import {Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetClose} from '@/components/ui/sheet';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Plus, Folder, File, Star, Trash2, Edit, Link2, Server, ArrowUp, CornerDownLeft} from 'lucide-react';
import axios from 'axios';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';
import {Switch} from '@/components/ui/switch';
import {SheetDescription} from '@/components/ui/sheet';
import {Form, FormField, FormItem, FormLabel, FormControl, FormMessage} from '@/components/ui/form';
import {zodResolver} from '@hookform/resolvers/zod';
import {useForm, FormProvider} from 'react-hook-form';
import {z} from 'zod';
import {Popover, PopoverContent, PopoverTrigger} from '@/components/ui/popover';
import {MoreVertical} from 'lucide-react';
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from '@/components/ui/accordion';
import {ScrollArea} from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

function getJWT() {
    return document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
}

const initialSSHForm = {name: '', ip: '', port: 22, username: '', password: '', sshKey: '', isPinned: false};

const ConfigEditorSidebar = forwardRef(function ConfigEditorSidebar(
    { onSelectView, onOpenFile, tabs }: { onSelectView: (view: string) => void; onOpenFile: (file: any) => void; tabs: any[] },
    ref
) {
    const [addSheetOpen, setAddSheetOpen] = useState(false);
    const [addSubmitting, setAddSubmitting] = useState(false);
    const [addSubmitError, setAddSubmitError] = useState<string | null>(null);
    const addSSHForm = useForm({
        defaultValues: {
            name: '',
            ip: '',
            port: 22,
            username: '',
            password: '',
            sshKey: '',
            sshKeyFile: null,
            keyPassword: '',
            keyType: 'auto',
            isPinned: false,
            defaultPath: '/',
            folder: '',
            authMethod: 'password',
        }
    });
    React.useEffect(() => {
        if (!addSheetOpen) {
            setAddSubmitError(null);
            addSSHForm.reset();
        }
    }, [addSheetOpen]);
    const handleAddSSH = () => {
        setAddSheetOpen(true);
    };
    const onAddSSHSubmit = async (values: any) => {
        setAddSubmitError(null);
        setAddSubmitting(true);
        try {
            const jwt = getJWT();
            let sshKeyContent = values.sshKey;
            if (values.sshKeyFile instanceof File) {
                sshKeyContent = await values.sshKeyFile.text();
            }
            const payload = {
                name: values.name,
                ip: values.ip,
                port: values.port,
                username: values.username,
                password: values.password,
                sshKey: sshKeyContent,
                keyPassword: values.keyPassword,
                keyType: values.keyType,
                isPinned: values.isPinned,
                defaultPath: values.defaultPath,
                folder: values.folder,
                authMethod: values.authMethod,
            };
            await axios.post(`${API_BASE_DB}/config_editor/ssh/host`, payload, {headers: {Authorization: `Bearer ${jwt}`}});
            await fetchSSH();
            setAddSheetOpen(false);
            addSSHForm.reset();
        } catch (err: any) {
            setAddSubmitError(err?.response?.data?.error || 'Failed to add SSH connection');
        } finally {
            setAddSubmitting(false);
        }
    };
    const [sshConnections, setSSHConnections] = useState<any[]>([]);
    const [loadingSSH, setLoadingSSH] = useState(false);
    const [errorSSH, setErrorSSH] = useState<string | undefined>(undefined);
    const [view, setView] = useState<'servers' | 'files'>('servers');
    const [activeServer, setActiveServer] = useState<any | null>(null);
    const [currentPath, setCurrentPath] = useState('/');
    const [files, setFiles] = useState<any[]>([]);
    const [sshForm, setSSHForm] = useState<any>(initialSSHForm);
    const [editingSSH, setEditingSSH] = useState<any | null>(null);
    const [sshFormError, setSSHFormError] = useState<string | null>(null);
    const [sshFormLoading, setSSHFormLoading] = useState(false);
    const pathInputRef = useRef<HTMLInputElement>(null);
    const [showEditLocal, setShowEditLocal] = useState(false);
    const [localDefaultPath, setLocalDefaultPath] = useState('/');
    const [sshPopoverOpen, setSshPopoverOpen] = useState<Record<string, boolean>>({});
    const [folders, setFolders] = useState<string[]>([]);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [foldersError, setFoldersError] = useState<string | null>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const folderDropdownRef = useRef<HTMLDivElement>(null);
    const [folderInput, setFolderInput] = useState('');
    // Add search bar state
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(handler);
    }, [search]);

    const API_BASE_DB = 'http://localhost:8081'; // For database-backed endpoints
    const API_BASE = 'http://localhost:8084'; // For stateless file/ssh operations

    useEffect(() => {
        fetchSSH();
    }, []);

    async function fetchSSH() {
        setLoadingSSH(true);
        setErrorSSH(undefined);
        try {
            const jwt = getJWT();
            const res = await axios.get(`${API_BASE_DB}/config_editor/ssh/host`, {headers: {Authorization: `Bearer ${jwt}`}});
            setSSHConnections(res.data || []);
        } catch (err: any) {
            setErrorSSH('Failed to load SSH connections');
        } finally {
            setLoadingSSH(false);
        }
    }

    // Add state for SSH sessionId and loading/error
    const [sshSessionId, setSshSessionId] = useState<string | null>(null);
    const [filesLoading, setFilesLoading] = useState(false);
    const [filesError, setFilesError] = useState<string | null>(null);

    // Helper to connect to SSH and set sessionId
    async function connectSSH(server: any): Promise<string | null> {
        const jwt = getJWT();
        const sessionId = server.id || `${server.ip}_${server.port}_${server.username}`;
        try {
            await axios.post(`${API_BASE}/ssh/connect`, {
                sessionId,
                ip: server.ip,
                port: server.port,
                username: server.username,
                password: server.password,
                sshKey: server.sshKey,
                keyPassword: server.keyPassword,
            }, { headers: { Authorization: `Bearer ${jwt}` } });
            setSshSessionId(sessionId);
            return sessionId;
        } catch (err: any) {
            setFilesError(err?.response?.data?.error || 'Failed to connect to SSH');
            setSshSessionId(null);
            return null;
        }
    }

    // Modified fetchFiles to handle SSH connect if needed
    async function fetchFiles() {
        setFiles([]);
        setFilesLoading(true);
        setFilesError(null);
        try {
            const jwt = getJWT();
            if (activeServer?.isLocal) {
                const res = await axios.get(`${API_BASE}/files`, {
                    params: { folder: currentPath },
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                setFiles((res.data || []).map((f: any) => ({
                    ...f,
                    path: currentPath + (currentPath.endsWith('/') ? '' : '/') + f.name,
                    isStarred: false,
                    isSSH: false
                })));
            } else if (activeServer) {
                // Ensure SSH session is established
                let sessionId = sshSessionId;
                if (!sessionId || sessionId !== activeServer.id) {
                    sessionId = await connectSSH(activeServer);
                    if (!sessionId) {
                        setFiles([]);
                        setFilesLoading(false);
                        return;
                    }
                }
                const res = await axios.get(`${API_BASE}/ssh/listFiles`, {
                    params: { sessionId, path: currentPath },
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                setFiles((res.data || []).map((f: any) => ({
                    ...f,
                    path: currentPath + (currentPath.endsWith('/') ? '' : '/') + f.name,
                    isStarred: false,
                    isSSH: true,
                    sshSessionId: sessionId
                })));
            }
        } catch (err: any) {
            setFiles([]);
            setFilesError(err?.response?.data?.error || 'Failed to list files');
        } finally {
            setFilesLoading(false);
        }
    }

    // When activeServer or currentPath changes, fetch files
    useEffect(() => {
        if (view === 'files' && activeServer) fetchFiles();
        // eslint-disable-next-line
    }, [currentPath, view, activeServer]);

    // When switching servers, reset sessionId and errors
    function handleSelectServer(server: any) {
        setActiveServer(server);
        setCurrentPath(server.defaultPath || '/');
        setView('files');
        setSshSessionId(server.isLocal ? null : server.id);
        setFilesError(null);
    }

    useImperativeHandle(ref, () => ({
        openFolder: (server: any, path: string) => {
            setActiveServer(server);
            setCurrentPath(path);
            setView('files');
            setSshSessionId(server.isLocal ? null : server.id);
            setFilesError(null);
        }
    }));

    // SSH Handlers
    const handleEditSSH = (conn: any) => {
        setEditingSSH(conn);
        setSSHForm({...conn});
        // setShowAddSSH(true); // No longer used
    };
    const handleDeleteSSH = async (conn: any) => {
        try {
            const jwt = getJWT();
            await axios.delete(`${API_BASE_DB}/config_editor/ssh/host/${conn.id}`, {headers: {Authorization: `Bearer ${jwt}`}});
            setSSHConnections(sshConnections.filter(s => s.id !== conn.id));
        } catch {
        }
    };
    const handlePinSSH = async (conn: any) => {
        try {
            const jwt = getJWT();
            await axios.put(`${API_BASE_DB}/config_editor/ssh/host/${conn.id}`, {
                ...conn,
                isPinned: !conn.isPinned
            }, {headers: {Authorization: `Bearer ${jwt}`}});
            setSSHConnections(sshConnections.map(s => s.id === conn.id ? {...s, isPinned: !s.isPinned} : s));
        } catch {
        }
    };

    // Path input focus scroll
    useEffect(() => {
        if (pathInputRef.current) {
            pathInputRef.current.scrollLeft = pathInputRef.current.scrollWidth;
        }
    }, [currentPath]);

    // Fetch folders for popover
    useEffect(() => {
        async function fetchFolders() {
            setFoldersLoading(true);
            setFoldersError(null);
            try {
                const jwt = getJWT();
                const res = await axios.get(`${API_BASE_DB}/config_editor/ssh/folders`, {headers: {Authorization: `Bearer ${jwt}`}});
                setFolders(res.data || []);
            } catch (err: any) {
                setFoldersError('Failed to load folders');
            } finally {
                setFoldersLoading(false);
            }
        }

        fetchFolders();
    }, [addSheetOpen]);

    const form = useForm({
        defaultValues: {
            name: sshForm.name || '',
            ip: sshForm.ip || '',
            port: sshForm.port || 22,
            username: sshForm.username || '',
            password: sshForm.password || '',
            sshKey: sshForm.sshKey || '',
            sshKeyFile: null,
            keyPassword: sshForm.keyPassword || '',
            keyType: sshForm.keyType || 'auto',
            isPinned: sshForm.isPinned || false,
            defaultPath: sshForm.defaultPath || '/',
            folder: sshForm.folder || '',
            authMethod: sshForm.authMethod || 'password',
        }
    });

    // 1. SSH edit sheet autofill (debounced to after open, longer delay)
    // Remove the useEffect that resets the form on open
    // Add a useEffect that resets the form after the sheet is closed
    const prevShowAddSSH = React.useRef(addSheetOpen);
    useEffect(() => {
        if (prevShowAddSSH.current && !addSheetOpen) {
            setTimeout(() => {
                if (editingSSH) {
                    form.reset({
                        name: editingSSH.name || '',
                        ip: editingSSH.ip || '',
                        port: editingSSH.port || 22,
                        username: editingSSH.username || '',
                        password: editingSSH.password || '',
                        sshKey: editingSSH.sshKey || '',
                        sshKeyFile: null,
                        keyPassword: editingSSH.keyPassword || '',
                        keyType: editingSSH.keyType || 'auto',
                        isPinned: editingSSH.isPinned || false,
                        defaultPath: editingSSH.defaultPath || '/',
                        folder: editingSSH.folder || '',
                    });
                } else {
                    form.reset({
                        name: '',
                        ip: '',
                        port: 22,
                        username: '',
                        password: '',
                        sshKey: '',
                        sshKeyFile: null,
                        keyPassword: '',
                        keyType: 'auto',
                        isPinned: false,
                        defaultPath: '/',
                        folder: '',
                    });
                }
            }, 100);
        }
        prevShowAddSSH.current = addSheetOpen;
    }, [addSheetOpen, editingSSH]);

    // 2. Local Files default path persistence
    useEffect(() => {
        async function fetchLocalDefaultPath() {
            try {
                const jwt = getJWT();
                const res = await axios.get(`${API_BASE_DB}/config_editor/local_default_path`, {headers: {Authorization: `Bearer ${jwt}`}});
                setLocalDefaultPath(res.data?.defaultPath || '/');
            } catch {
                setLocalDefaultPath('/');
            }
        }

        fetchLocalDefaultPath();
    }, []);

    async function handleSaveLocalDefaultPath(e: React.FormEvent) {
        e.preventDefault();
        try {
            const jwt = getJWT();
            await axios.post(`${API_BASE_DB}/config_editor/local_default_path`, {defaultPath: localDefaultPath}, {headers: {Authorization: `Bearer ${jwt}`}});
            setShowEditLocal(false);
        } catch {
            setShowEditLocal(false);
        }
    }

    const onSubmit = async (values: any) => {
        setSSHFormError(null);
        setSSHFormLoading(true);
        try {
            const jwt = getJWT();
            let sshKeyContent = values.sshKey;
            if (values.sshKeyFile instanceof File) {
                sshKeyContent = await values.sshKeyFile.text();
            }
            const payload = {
                name: values.name,
                ip: values.ip,
                port: values.port,
                username: values.username,
                password: values.password,
                sshKey: sshKeyContent,
                keyPassword: values.keyPassword,
                keyType: values.keyType,
                isPinned: values.isPinned,
                defaultPath: values.defaultPath,
                folder: values.folder,
                authMethod: values.authMethod,
            };
            if (editingSSH) {
                await axios.put(`${API_BASE_DB}/config_editor/ssh/host/${editingSSH.id}`, payload, {headers: {Authorization: `Bearer ${jwt}`}});
            } else {
                await axios.post(`${API_BASE_DB}/config_editor/ssh/host`, payload, {headers: {Authorization: `Bearer ${jwt}`}});
            }
            await fetchSSH();
            // setShowAddSSH(false); // No longer used
        } catch (err: any) {
            setSSHFormError(err?.response?.data?.error || 'Failed to save SSH connection');
        } finally {
            setSSHFormLoading(false);
        }
    };

    // Group SSH connections by folder
    const sshByFolder: Record<string, any[]> = {};
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
    const filteredSshByFolder: Record<string, any[]> = {};
    Object.entries(sshByFolder).forEach(([folder, hosts]) => {
        filteredSshByFolder[folder] = hosts.filter(conn => {
            const q = debouncedSearch.trim().toLowerCase();
            if (!q) return true;
            return (conn.name || '').toLowerCase().includes(q) || (conn.ip || '').toLowerCase().includes(q);
        });
    });

    // Folder input logic (copy from SSHSidebar)
    const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                folderDropdownRef.current &&
                !folderDropdownRef.current.contains(event.target as Node) &&
                folderInputRef.current &&
                !folderInputRef.current.contains(event.target as Node)
            ) {
                setFolderDropdownOpen(false);
            }
        }
        if (folderDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [folderDropdownOpen]);

    // --- Render ---
    // Expect a prop: tabs: Tab[]
    // Use: props.tabs

    return (
        <SidebarProvider>
            <Sidebar style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
                <SidebarContent style={{ height: '100vh', maxHeight: '100vh', overflow: 'hidden' }}>
                    <SidebarGroup className="flex flex-col flex-grow h-full overflow-hidden">
                        <SidebarGroupLabel className="text-lg font-bold text-white flex items-center gap-2">
                            <img src={Icon} alt="Icon" className="w-6 h-6"/>
                            - Termix / Config
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
                                <SidebarMenuItem key={"AddSSH"}>
                                    <Button className="w-full mt-2 mb-2 h-8" onClick={handleAddSSH} variant="outline">
                                        <Plus/>
                                        Add SSH
                                    </Button>
                                    <Sheet open={addSheetOpen} onOpenChange={setAddSheetOpen}>
                                        <SheetContent side="left" className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col">
                                            <SheetHeader className="pb-0.5">
                                                <SheetTitle>Add SSH</SheetTitle>
                                                <SheetDescription>
                                                    Configure a new SSH connection for the config editor.
                                                </SheetDescription>
                                            </SheetHeader>
                                            <div className="flex-1 min-h-0 overflow-y-auto px-4">
                                                {addSubmitError && (
                                                    <div className="text-red-500 text-sm mb-2">{addSubmitError}</div>
                                                )}
                                                <FormProvider {...addSSHForm}>
                                                    <form id="add-host-form" onSubmit={addSSHForm.handleSubmit(onAddSSHSubmit)} className="space-y-4">
                                                    <FormField
                                                        control={addSSHForm.control}
                                                        name="name"
                                                        render={({field}) => (
                                                            <FormItem>
                                                                <FormLabel>Name</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Name" {...field} />
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={addSSHForm.control}
                                                        name="folder"
                                                        render={({field}) => (
                                                            <FormItem className="relative">
                                                                <FormLabel>Folder</FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        ref={el => {
                                                                            if (typeof field.ref === 'function') field.ref(el);
                                                                            (folderInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                                                                        }}
                                                                        placeholder="e.g. Work"
                                                                        autoComplete="off"
                                                                        value={field.value}
                                                                        onFocus={() => setFolderDropdownOpen(true)}
                                                                        onChange={e => {
                                                                            field.onChange(e);
                                                                            setFolderDropdownOpen(true);
                                                                        }}
                                                                        disabled={foldersLoading}
                                                                    />
                                                                </FormControl>
                                                                {folderDropdownOpen && folders.length > 0 && (
                                                                    <div
                                                                        ref={folderDropdownRef}
                                                                        className="absolute top-full left-0 z-50 mt-1 w-full bg-[#18181b] border border-input rounded-md shadow-lg max-h-40 overflow-y-auto p-1"
                                                                    >
                                                                        <div className="grid grid-cols-1 gap-1 p-0">
                                                                            {folders.map(folder => (
                                                                                <Button
                                                                                    key={folder}
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="sm"
                                                                                    className="w-full justify-start text-left rounded px-2 py-1.5 hover:bg-white/15 focus:bg-white/20 focus:outline-none"
                                                                                    onClick={() => {
                                                                                        field.onChange(folder);
                                                                                        setFolderDropdownOpen(false);
                                                                                    }}
                                                                                    disabled={foldersLoading}
                                                                                >
                                                                                    {folder}
                                                                                </Button>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                {foldersLoading &&
                                                                    <div className="text-xs text-muted-foreground mt-1">Loading folders...</div>}
                                                                {foldersError &&
                                                                    <div className="text-xs text-red-500 mt-1">{foldersError}</div>}
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <h3 className="text-sm font-semibold mb-2 mt-2">Connection Details</h3>
                                                    <Separator className="p-0.25 mb-2" />
                                                    <div className="mb-2" />
                                                    <FormField
                                                        control={addSSHForm.control}
                                                        name="username"
                                                        render={({field}) => (
                                                            <FormItem>
                                                                <FormLabel>Username</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Username" {...field} />
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={addSSHForm.control}
                                                        name="ip"
                                                        render={({field}) => (
                                                            <FormItem>
                                                                <FormLabel>IP Address</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="IP Address" {...field} />
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={addSSHForm.control}
                                                        name="port"
                                                        render={({field}) => (
                                                            <FormItem>
                                                                <FormLabel>Port</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="Port" type="number" {...field} />
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={addSSHForm.control}
                                                        name="authMethod"
                                                        render={({field}) => (
                                                            <FormItem>
                                                                <h3 className="text-sm font-semibold">Authentication</h3>
                                                                <Separator className="p-0.25 mb-1"/>
                                                                <Tabs value={field.value} onValueChange={field.onChange} className="w-full mt-0">
                                                                    <TabsList className="grid w-full grid-cols-2 !mb-0">
                                                                        <TabsTrigger value="password">Password</TabsTrigger>
                                                                        <TabsTrigger value="key">SSH Key</TabsTrigger>
                                                                    </TabsList>
                                                                    <TabsContent value="password" className="mt-1">
                                                                        <FormField
                                                                            control={addSSHForm.control}
                                                                            name="password"
                                                                            render={({field}) => (
                                                                                <FormItem>
                                                                                    <FormLabel>Password</FormLabel>
                                                                                    <FormControl>
                                                                                        <Input type="password" placeholder="Password" {...field} />
                                                                                    </FormControl>
                                                                                    <FormMessage/>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                    </TabsContent>
                                                                    <TabsContent value="key" className="mt-1">
                                                                        <FormField
                                                                            control={addSSHForm.control}
                                                                            name="sshKeyFile"
                                                                            render={({field}) => {
                                                                                const file = field.value as File | null;
                                                                                return (
                                                                                    <FormItem>
                                                                                        <FormLabel>SSH Key</FormLabel>
                                                                                        <FormControl>
                                                                                            <div className="relative">
                                                                                                <input
                                                                                                    id="file-upload"
                                                                                                    type="file"
                                                                                                    accept=".pem,.key,.txt,.ppk"
                                                                                                    onChange={e => {
                                                                                                        const file = e.target.files?.[0];
                                                                                                        field.onChange(file || null);
                                                                                                    }}
                                                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                                                />
                                                                                                <Button type="button" variant="outline" className="w-full">
                                                                                                    {file ? file.name : "Upload"}
                                                                                                </Button>
                                                                                            </div>
                                                                                        </FormControl>
                                                                                        <FormMessage/>
                                                                                    </FormItem>
                                                                                );
                                                                            }}
                                                                        />
                                                                        <FormField
                                                                            control={addSSHForm.control}
                                                                            name="keyPassword"
                                                                            render={({field}) => (
                                                                                <FormItem className="mt-3">
                                                                                    <FormLabel>Key Password (if protected)</FormLabel>
                                                                                    <FormControl>
                                                                                        <Input type="password" placeholder="Key Password" {...field} />
                                                                                    </FormControl>
                                                                                    <FormMessage/>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={addSSHForm.control}
                                                                            name="keyType"
                                                                            render={({field}) => {
                                                                                const keyTypeOptions = [
                                                                                    {value: 'auto', label: 'Auto-detect'},
                                                                                    {value: 'ssh-rsa', label: 'RSA'},
                                                                                    {value: 'ssh-ed25519', label: 'ED25519'},
                                                                                    {value: 'ecdsa-sha2-nistp256', label: 'ECDSA NIST P-256'},
                                                                                    {value: 'ecdsa-sha2-nistp384', label: 'ECDSA NIST P-384'},
                                                                                    {value: 'ecdsa-sha2-nistp521', label: 'ECDSA NIST P-521'},
                                                                                    {value: 'ssh-dss', label: 'DSA'},
                                                                                    {value: 'ssh-rsa-sha2-256', label: 'RSA SHA2-256'},
                                                                                    {value: 'ssh-rsa-sha2-512', label: 'RSA SHA2-512'},
                                                                                ];
                                                                                const [dropdownOpen, setDropdownOpen] = React.useState(false);
                                                                                const dropdownRef = React.useRef<HTMLDivElement>(null);
                                                                                const buttonRef = React.useRef<HTMLButtonElement>(null);
                                                                                React.useEffect(() => {
                                                                                    function handleClickOutside(event: MouseEvent) {
                                                                                        if (
                                                                                            dropdownRef.current &&
                                                                                            !dropdownRef.current.contains(event.target as Node) &&
                                                                                            buttonRef.current &&
                                                                                            !buttonRef.current.contains(event.target as Node)
                                                                                        ) {
                                                                                            setDropdownOpen(false);
                                                                                        }
                                                                                    }
                                                                                    if (dropdownOpen) {
                                                                                        document.addEventListener('mousedown', handleClickOutside);
                                                                                    } else {
                                                                                        document.removeEventListener('mousedown', handleClickOutside);
                                                                                    }
                                                                                    return () => {
                                                                                        document.removeEventListener('mousedown', handleClickOutside);
                                                                                    };
                                                                                }, [dropdownOpen]);
                                                                                return (
                                                                                    <FormItem className="mt-3 relative">
                                                                                        <FormLabel>Key Type</FormLabel>
                                                                                        <FormControl>
                                                                                            <div className="relative">
                                                                                                <Button
                                                                                                    ref={buttonRef}
                                                                                                    type="button"
                                                                                                    variant="outline"
                                                                                                    className="w-full justify-start text-left rounded-md px-2 py-2 bg-[#18181b] border border-input text-foreground"
                                                                                                    onClick={() => setDropdownOpen(open => !open)}
                                                                                                >
                                                                                                    {keyTypeOptions.find(opt => opt.value === field.value)?.label || 'Auto-detect'}
                                                                                                </Button>
                                                                                                {dropdownOpen && (
                                                                                                    <div
                                                                                                        ref={dropdownRef}
                                                                                                        className="absolute bottom-full left-0 z-50 mb-1 w-full bg-[#18181b] border border-input rounded-md shadow-lg max-h-40 overflow-y-auto p-1"
                                                                                                    >
                                                                                                        <div className="grid grid-cols-1 gap-1 p-0">
                                                                                                            {keyTypeOptions.map(opt => (
                                                                                                                <Button
                                                                                                                    key={opt.value}
                                                                                                                    type="button"
                                                                                                                    variant="ghost"
                                                                                                                    size="sm"
                                                                                                                    className="w-full justify-start text-left rounded-md px-2 py-1.5 bg-[#18181b] text-foreground hover:bg-white/15 focus:bg-white/20 focus:outline-none"
                                                                                                                    onClick={() => {
                                                                                                                        field.onChange(opt.value);
                                                                                                                        setDropdownOpen(false);
                                                                                                                    }}
                                                                                                                >
                                                                                                                    {opt.label}
                                                                                                                </Button>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        </FormControl>
                                                                                        <FormMessage/>
                                                                                    </FormItem>
                                                                                );
                                                                            }}
                                                                        />
                                                                    </TabsContent>
                                                                </Tabs>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <h3 className="text-sm font-semibold mb-2">Other</h3>
                                                    <Separator className="p-0.25 mt-1 mb-3"/>
                                                    <FormField
                                                        control={addSSHForm.control}
                                                        name="defaultPath"
                                                        render={({field}) => (
                                                            <FormItem>
                                                                <FormLabel>Default Path</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder="/home/user" {...field} />
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={addSSHForm.control}
                                                        name="isPinned"
                                                        render={({field}) => (
                                                            <FormItem>
                                                                <FormControl>
                                                                    <div className="flex flex-row items-center gap-2">
                                                                        <Switch checked={!!field.value} onCheckedChange={field.onChange}/>
                                                                        <FormLabel className="mb-0">Pin Connection</FormLabel>
                                                                    </div>
                                                                </FormControl>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </form>
                                            </div>
                                            <SheetFooter className="px-4 pt-1 pb-4">
                                                <Button type="submit" form="add-host-form" className="w-full" disabled={addSubmitting}>
                                                    {addSubmitting ? 'Adding...' : 'Add SSH'}
                                                </Button>
                                                <SheetClose asChild>
                                                    <Button type="button" variant="outline" className="w-full mt-1">
                                                        Close
                                                    </Button>
                                                </SheetClose>
                                            </SheetFooter>
                                        </SheetContent>
                                    </Sheet>
                                </SidebarMenuItem>
                            </SidebarMenu>
                            {/* Main black div: servers list or file/folder browser */}
                            <div className="flex-1 w-full flex flex-col rounded-md bg-[#09090b] border border-[#434345] overflow-hidden p-0 relative min-h-0 mt-1">
                                <ScrollArea className="flex-1 w-full h-full" style={{ height: '100%', maxHeight: '100%' }}>
                                    {view === 'servers' && (
                                        <div className="flex flex-col h-full">
                                            {/* SSH hosts/folders section, SSHSidebar-accurate */}
                                            <div className="w-full flex-grow overflow-hidden p-0 m-0 relative flex flex-col min-h-0">
                                                {/* Search bar (full width, no border/rounded on container) */}
                                                <div className="w-full px-2 pt-2 pb-2 bg-[#09090b] z-10">
                                                    <Input
                                                        value={search}
                                                        onChange={e => setSearch(e.target.value)}
                                                        placeholder="Search hosts..."
                                                        className="w-full h-8 text-sm bg-background border border-border rounded"
                                                        autoComplete="off"
                                                    />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                    <Separator className="w-full h-px bg-[#434345] my-2" style={{ maxWidth: 213, margin: '0 auto' }} />
                                                </div>
                                                {/* Host list, centered, max width, no border/rounded on container */}
                                                <div className="mx-auto" style={{maxWidth: '213px', width: '100%'}}>
                                                    {/* Local server */}
                                                    <div
                                                        className="w-full flex rounded overflow-hidden border border-[#434345] bg-[#18181b] h-10 mb-2 mt-2">
                                                        <div
                                                            className="flex items-center h-full px-2 flex-1 min-w-0 border-r border-[#434345] hover:bg-muted transition-colors cursor-pointer"
                                                            onClick={() => handleSelectServer({
                                                                isLocal: true,
                                                                name: 'Local Files',
                                                                id: 'local',
                                                                defaultPath: localDefaultPath
                                                            })}
                                                            style={{minWidth: 0}}
                                                        >
                                                            <Server className="w-4 h-4 mr-2"/>
                                                            <span className="font-medium truncate">Local Files</span>
                                                        </div>
                                                        <div
                                                            className="flex items-center justify-center h-full border-l border-[#434345]"
                                                            style={{width: 32, minWidth: 32, maxWidth: 32, flexShrink: 0}}>
                                                            <Button size="icon" variant="ghost"
                                                                    className="h-full w-full flex items-center justify-center p-0"
                                                                    onClick={() => setShowEditLocal(true)}>
                                                                <Edit className="w-4 h-4"/>
                                                            </Button>
                                                        </div>
                                                    </div>
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
                                                                                <div key={conn.id}
                                                                                     className="relative group flex flex-col mb-1 w-full overflow-hidden"
                                                                                     style={{
                                                                                         height: 40,
                                                                                         maxWidth: '213px'
                                                                                     }}>
                                                                                    <div
                                                                                        className="flex flex-col w-full rounded overflow-hidden border border-[#434345] bg-[#18181b] h-full"
                                                                                        style={{maxWidth: '213px'}}>
                                                                                        <div className="flex w-full h-10">
                                                                                            <div
                                                                                                className="flex items-center h-full px-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent min-w-0 border-r border-[#434345] hover:bg-muted transition-colors cursor-pointer"
                                                                                                style={{
                                                                                                    flex: '0 1 calc(100% - 32px)',
                                                                                                    maxWidth: 'calc(100% - 32px)'
                                                                                                }}
                                                                                                onClick={() => handleSelectServer(conn)}
                                                                                            >
                                                                                                <div
                                                                                                    className="flex items-center whitespace-nowrap"
                                                                                                    style={{minWidth: 'max-content'}}>
                                                                                                    {conn.isPinned && <span
                                                                                                        className="text-yellow-400 mr-1 flex-shrink-0">★</span>}
                                                                                                    <span
                                                                                                        className="font-medium">{conn.name || conn.ip}</span>
                                                                                                </div>
                                                                                            </div>
                                                                                            <div
                                                                                                className="flex items-center justify-center h-full border-l border-[#434345] hover:bg-muted transition-colors"
                                                                                                style={{
                                                                                                    width: 32,
                                                                                                    minWidth: 32,
                                                                                                    maxWidth: 32,
                                                                                                    flexShrink: 0
                                                                                                }}>
                                                                                                <Popover
                                                                                                    open={!!sshPopoverOpen[conn.id]}
                                                                                                    onOpenChange={open => setSshPopoverOpen(prev => ({
                                                                                                        ...prev,
                                                                                                        [conn.id]: open
                                                                                                    }))}>
                                                                                                    <PopoverTrigger asChild>
                                                                                                        <Button size="icon"
                                                                                                                variant="ghost"
                                                                                                                className="h-full w-full flex items-center justify-center p-0">
                                                                                                            <MoreVertical
                                                                                                                className="w-4 h-4"/>
                                                                                                        </Button>
                                                                                                    </PopoverTrigger>
                                                                                                    <PopoverContent
                                                                                                        align="start"
                                                                                                        side="right"
                                                                                                        sideOffset={8}
                                                                                                        className="w-36 p-2">
                                                                                                        <Button
                                                                                                            variant="outline"
                                                                                                            className="w-full mb-2"
                                                                                                            onClick={() => {
                                                                                                                setSshPopoverOpen(prev => ({
                                                                                                                    ...prev,
                                                                                                                    [conn.id]: false
                                                                                                                }));
                                                                                                                handleEditSSH(conn);
                                                                                                            }}
                                                                                                        >
                                                                                                            Edit
                                                                                                        </Button>
                                                                                                        <Button
                                                                                                            variant="destructive"
                                                                                                            className="w-full"
                                                                                                            onClick={() => {
                                                                                                                setSshPopoverOpen(prev => ({
                                                                                                                    ...prev,
                                                                                                                    [conn.id]: false
                                                                                                                }));
                                                                                                                handleDeleteSSH(conn);
                                                                                                            }}
                                                                                                        >
                                                                                                            Delete
                                                                                                        </Button>
                                                                                                    </PopoverContent>
                                                                                                </Popover>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
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
                                    )}
                                    {view === 'files' && activeServer && (
                                        <div className="flex flex-col h-full w-full" style={{ maxWidth: 260 }}>
                                            {/* Sticky path input bar */}
                                            <div className="flex items-center gap-2 px-2 py-2 border-b border-[#23232a] bg-[#18181b] sticky top-0 z-20" style={{ maxWidth: 260 }}>
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-8 w-8 bg-background border border-border rounded-md hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
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
                                                        }
                                                    }}
                                                >
                                                    <ArrowUp className="w-4 h-4"/>
                                                </Button>
                                                <Input ref={pathInputRef} value={currentPath}
                                                       onChange={e => setCurrentPath(e.target.value)}
                                                       className="flex-1 bg-background border border-border text-white max-w-[170px] truncate rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-ring"
                                                       style={{ background: '#18181b' }}
                                                />
                                            </div>
                                            {/* File list with always-visible scrollbar, border at top */}
                                            <div className="flex-1 w-full h-full bg-[#09090b] border-t border-[#23232a]">
                                                <ScrollArea className="w-full h-full bg-[#09090b]" style={{ height: '100%', maxHeight: '100%', paddingRight: 8, scrollbarGutter: 'stable', background: '#09090b' }}>
                                                    <div className="p-2 pr-2">
                                                        {filesLoading ? (
                                                            <div className="text-xs text-muted-foreground">Loading...</div>
                                                        ) : filesError ? (
                                                            <div className="text-xs text-red-500">{filesError}</div>
                                                        ) : files.length === 0 ? (
                                                            <div className="text-xs text-muted-foreground">No files or folders found.</div>
                                                        ) : (
                                                            <div className="flex flex-col gap-1">
                                                                {files.map((item: any) => {
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
                                                                                onClick={() => !isOpen && (item.type === 'directory' ? setCurrentPath(item.path) : onOpenFile(item))}
                                                                            >
                                                                                {item.type === 'directory' ?
                                                                                    <Folder className="w-4 h-4 text-blue-400"/> :
                                                                                    <File className="w-4 h-4 text-muted-foreground"/>}
                                                                                <span className="text-sm text-white truncate max-w-[120px]">{item.name}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                <Button size="icon" variant="ghost"
                                                                                        className="h-7 w-7"
                                                                                        disabled={isOpen}
                                                                                >
                                                                                    <Star className={`w-4 h-4 ${item.isStarred ? 'text-yellow-400' : 'text-muted-foreground'}`}/>
                                                                                </Button>
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
                                </ScrollArea>
                            </div>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
            {/* Add/Edit SSH Sheet (pixel-perfect copy of SSHSidebar Add Host sheet) */}
            <Sheet open={showEditLocal} onOpenChange={setShowEditLocal}>
                <SheetContent side="left" className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col">
                    <SheetHeader className="pb-0.5">
                        <SheetTitle>Edit Local Files</SheetTitle>
                        <SheetDescription>
                            Set the default path for the Local Files browser. This will be used as the starting
                            directory.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4">
                        <Form {...form}>
                            <form id="local-files-form" onSubmit={handleSaveLocalDefaultPath} className="space-y-4">
                                <FormItem>
                                    <FormLabel>Default Path</FormLabel>
                                    <FormControl>
                                        <Input value={localDefaultPath}
                                               onChange={e => setLocalDefaultPath(e.target.value)}
                                               placeholder="/home/user"
                                               className="bg-[#18181b] border border-[#23232a] text-white rounded-md px-2 py-2 min-h-[40px] text-sm"/>
                                    </FormControl>
                                </FormItem>
                            </form>
                        </Form>
                    </div>
                    <SheetFooter className="px-4 pt-1 pb-4">
                        <Button type="submit" form="local-files-form" className="w-full">Save</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </SidebarProvider>
    );
});
export { ConfigEditorSidebar };