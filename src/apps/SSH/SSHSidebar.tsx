import React, { useState, useMemo } from 'react';
import { useForm, Controller } from "react-hook-form";

import {
    CornerDownLeft,
    Plus,
    MoreVertical
} from "lucide-react"

import {
    Button
} from "@/components/ui/button.tsx"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem, SidebarProvider,
} from "@/components/ui/sidebar.tsx"

import {
    Separator,
} from "@/components/ui/separator.tsx"
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from "@/components/ui/sheet.tsx";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import axios from "axios";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface SidebarProps {
    onSelectView: (view: string) => void;
    onAddHostSubmit: (data: any) => void;
    onHostConnect: (hostConfig: any) => void;
}

interface AuthPromptFormData {
    password: string;
    authMethod: string;
    sshKeyFile: File | null;
    sshKeyContent?: string;
}

interface AddHostFormData {
    name: string;
    folder: string;
    tags: string[];
    tagsInput?: string;
    ip: string;
    port: number;
    username: string;
    password: string;
    authMethod: string;
    sshKeyFile: File | null;
    sshKeyContent?: string;
    saveAuthMethod: boolean;
    isPinned: boolean;
}

export function SSHSidebar({ onSelectView, onAddHostSubmit, onHostConnect }: SidebarProps): React.ReactElement {
    const addHostForm = useForm<AddHostFormData>({
        defaultValues: {
            name: '',
            folder: '',
            tags: [],
            tagsInput: '',
            ip: '',
            port: 22,
            username: '',
            password: '',
            authMethod: 'password',
            sshKeyFile: null,
            saveAuthMethod: true,
            isPinned: false
        }
    })

    const [folders, setFolders] = useState<string[]>([]);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [foldersError, setFoldersError] = useState<string | null>(null);
    React.useEffect(() => {
        async function fetchFolders() {
            setFoldersLoading(true);
            setFoldersError(null);
            try {
                const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
                const res = await axios.get(
                    (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + '/ssh/folders',
                    { headers: { Authorization: `Bearer ${jwt}` } }
                );
                setFolders(res.data || []);
            } catch (err: any) {
                setFoldersError('Failed to load folders');
            } finally {
                setFoldersLoading(false);
            }
        }
        fetchFolders();
    }, []);

    const folderValue = addHostForm.watch('folder');
    const filteredFolders = React.useMemo(() => {
        if (!folderValue) return folders;
        return folders.filter(f => f.toLowerCase().includes(folderValue.toLowerCase()));
    }, [folderValue, folders]);

    const tags = addHostForm.watch('tags') || [];
    const tagsInput = addHostForm.watch('tagsInput') || '';

    const handleTagsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value.endsWith(' ')) {
            const tag = value.trim();
            if (tag && !tags.includes(tag)) {
                addHostForm.setValue('tags', [...tags, tag]);
            }
            addHostForm.setValue('tagsInput', '');
        } else {
            addHostForm.setValue('tagsInput', value);
        }
    };

    const handleRemoveTag = (tag: string) => {
        addHostForm.setValue('tags', tags.filter((t) => t !== tag));
    };

    const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
    const [editFolderDropdownOpen, setEditFolderDropdownOpen] = useState(false);
    const folderInputRef = React.useRef<HTMLInputElement>(null);
    const folderDropdownRef = React.useRef<HTMLDivElement>(null);
    const editFolderInputRef = React.useRef<HTMLInputElement>(null);
    const editFolderDropdownRef = React.useRef<HTMLDivElement>(null);

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
            if (
                editFolderDropdownRef.current &&
                !editFolderDropdownRef.current.contains(event.target as Node) &&
                editFolderInputRef.current &&
                !editFolderInputRef.current.contains(event.target as Node)
            ) {
                setEditFolderDropdownOpen(false);
            }
        }
        if (folderDropdownOpen || editFolderDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [folderDropdownOpen, editFolderDropdownOpen]);

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);

    React.useEffect(() => {
        if (!sheetOpen) {
            setFolderDropdownOpen(false);
        }
    }, [sheetOpen]);

    React.useEffect(() => {
        if (!sheetOpen) {
            setSubmitError(null);
        }
    }, [sheetOpen]);

    const onAddHostSubmitReset = async (data: AddHostFormData) => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            let sshKeyContent = data.sshKeyContent;
        if (data.sshKeyFile instanceof File) {
                sshKeyContent = await data.sshKeyFile.text();
            }
            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
            await axios.post(
                (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + '/ssh/host',
                {
                    name: data.name,
                    folder: data.folder,
                    tags: data.tags,
                    ip: data.ip,
                    port: data.port,
                    username: data.username,
                    password: data.password,
                    authMethod: data.authMethod,
                    key: sshKeyContent,
                    saveAuthMethod: data.saveAuthMethod,
                    isPinned: data.isPinned
                },
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            setSheetOpen(false);
        addHostForm.reset();
            if (data.folder && !folders.includes(data.folder)) {
                setFolders(prev => [...prev, data.folder]);
            }
        } catch (err: any) {
            setSubmitError(err?.response?.data?.error || 'Failed to add SSH host');
        } finally {
            setSubmitting(false);
        }
    };

    const handleFolderClick = (folder: string) => {
        addHostForm.setValue('folder', folder);
        setFolderDropdownOpen(false);
    };

    const [hosts, setHosts] = useState<any[]>([]);
    const [hostsLoading, setHostsLoading] = useState(false);
    const [hostsError, setHostsError] = useState<string | null>(null);
    const prevHostsRef = React.useRef<any[]>([]);
    const fetchHosts = React.useCallback(async () => {
        setHostsLoading(true);
        setHostsError(null);
        try {
            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
            const res = await axios.get(
                (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + '/ssh/host',
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            const newHosts = res.data || [];
            const prevHosts = prevHostsRef.current;
            const isSame =
                newHosts.length === prevHosts.length &&
                newHosts.every((h: any, i: number) => {
                    const prev = prevHosts[i];
                    if (!prev) return false;
                    return (
                        h.id === prev.id &&
                        h.name === prev.name &&
                        h.folder === prev.folder &&
                        h.ip === prev.ip &&
                        h.port === prev.port &&
                        h.username === prev.username &&
                        h.password === prev.password &&
                        h.authMethod === prev.authMethod &&
                        h.key === prev.key &&
                        h.saveAuthMethod === prev.saveAuthMethod &&
                        h.isPinned === prev.isPinned &&
                        (Array.isArray(h.tags) ? h.tags.join(',') : h.tags) === (Array.isArray(prev.tags) ? prev.tags.join(',') : prev.tags)
                    );
                });
            if (!isSame) {
                setHosts(newHosts);
                prevHostsRef.current = newHosts;
            }
        } catch (err: any) {
            setHostsError('Failed to load hosts');
        } finally {
            setHostsLoading(false);
        }
    }, []);
    React.useEffect(() => {
        fetchHosts();
        const interval = setInterval(fetchHosts, 10000);
        return () => clearInterval(interval);
    }, [fetchHosts]);
    React.useEffect(() => {
        if (!submitting && !sheetOpen) {
            fetchHosts();
        }
    }, [submitting, sheetOpen, fetchHosts]);

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    React.useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(handler);
    }, [search]);

    const filteredHosts = React.useMemo(() => {
        if (!debouncedSearch.trim()) return hosts;
        const q = debouncedSearch.trim().toLowerCase();
        return hosts.filter(h => {
            const name = (h.name || "").toLowerCase();
            const ip = (h.ip || "").toLowerCase();
            const tags = Array.isArray(h.tags) ? h.tags : (typeof h.tags === 'string' ? h.tags.split(',').map((t: string) => t.trim().toLowerCase()) : []);
            return name.includes(q) || ip.includes(q) || tags.some((tag: string) => tag.includes(q));
        });
    }, [hosts, debouncedSearch]);

    const hostsByFolder = React.useMemo(() => {
        const map: Record<string, any[]> = {};
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
    const getSortedHosts = (arr: any[]) => {
        const pinned = arr.filter(h => h.isPinned).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const rest = arr.filter(h => !h.isPinned).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return [...pinned, ...rest];
    };

    const [editHostOpen, setEditHostOpen] = useState(false);

    React.useEffect(() => {
        if (!editHostOpen) {
            setEditFolderDropdownOpen(false);
        }
    }, [editHostOpen]);
    
    const [editHostData, setEditHostData] = useState<any | null>(null);
    const editHostForm = useForm<AddHostFormData>({
        defaultValues: {
            name: '',
            folder: '',
            tags: [],
            tagsInput: '',
            ip: '',
            port: 22,
            username: '',
            password: '',
            authMethod: 'password',
            sshKeyFile: null,
            saveAuthMethod: false,
            isPinned: false
        }
    });
    React.useEffect(() => {
        if (editHostData) {
            editHostForm.reset({
                ...editHostData,
                tags: editHostData.tags ? (Array.isArray(editHostData.tags) ? editHostData.tags : (typeof editHostData.tags === 'string' ? editHostData.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [])) : [],
                tagsInput: '',
                sshKeyFile: null,
                sshKeyContent: editHostData.key || '',
            });
        }
    }, [editHostData]);

    const editTags = editHostForm.watch('tags') || [];
    const editTagsInput = editHostForm.watch('tagsInput') || '';

    const handleEditTagsInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value.endsWith(' ')) {
            const tag = value.trim();
            if (tag && !editTags.includes(tag)) {
                editHostForm.setValue('tags', [...editTags, tag]);
            }
            editHostForm.setValue('tagsInput', '');
        } else {
            editHostForm.setValue('tagsInput', value);
        }
    };

    const handleRemoveEditTag = (tag: string) => {
        editHostForm.setValue('tags', editTags.filter((t) => t !== tag));
    };
    const onEditHostSubmit = async (data: AddHostFormData) => {
        let sshKeyContent = data.sshKeyContent;
        if (data.sshKeyFile instanceof File) {
            sshKeyContent = await data.sshKeyFile.text();
        }
        try {
            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
            if (!editHostData?.id) {
                throw new Error('No host ID found for editing');
            }
            const response = await axios.put(
                (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + `/ssh/host/${editHostData.id}`,
                {
                    name: data.name,
                    folder: data.folder,
                    tags: data.tags,
                    ip: data.ip,
                    port: data.port,
                    username: data.username,
                    password: data.password,
                    authMethod: data.authMethod,
                    key: sshKeyContent,
                    saveAuthMethod: data.saveAuthMethod,
                    isPinned: data.isPinned
                },
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            setEditHostOpen(false);
            fetchHosts();
        } catch (err: any) {
        }
    };
    const onDeleteHost = async (host: any) => {
        try {
            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
            await axios.delete(
                (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + `/ssh/host/${host.id}`,
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            fetchHosts();
        } catch (err) {
        }
    };

    const [hostPopoverOpen, setHostPopoverOpen] = useState<Record<string, boolean>>({});
    const handlePopoverOpenChange = (hostId: string, open: boolean) => {
        setHostPopoverOpen(prev => ({ ...prev, [hostId]: open }));
    };

    const [authPromptOpen, setAuthPromptOpen] = useState(false);
    const [authPromptHost, setAuthPromptHost] = useState<any | null>(null);
    const authPromptForm = useForm<AuthPromptFormData>({
        defaultValues: {
            password: '',
            authMethod: 'password',
            sshKeyFile: null,
        }
    });

    const handleHostConnect = (host: any) => {
        const hasSavedAuth = host.saveAuthMethod && ((host.authMethod === 'password' && host.password) || (host.authMethod === 'key' && host.key));

        const hasUsername = host.username && host.username.trim() !== '';
        
        if (hasSavedAuth && hasUsername) {
            onHostConnect(host);
        } else {
            setAuthPromptHost(host);
            setAuthPromptOpen(true);
        }
    };

    const onAuthPromptSubmit = async (data: AuthPromptFormData) => {
        let sshKeyContent = data.sshKeyContent;
        if (data.sshKeyFile instanceof File) {
            sshKeyContent = await data.sshKeyFile.text();
        }

        const hostConfig = {
            ...authPromptHost,
            password: data.authMethod === 'password' ? data.password : undefined,
            key: data.authMethod === 'key' ? sshKeyContent : undefined,
            authMethod: data.authMethod,
        };

        if (!hostConfig.username || !hostConfig.ip || !hostConfig.port) {
            return;
        }
        
        setAuthPromptOpen(false);
        onHostConnect(hostConfig);
    };

    React.useEffect(() => {
        if (!authPromptOpen) {
            setTimeout(() => {
                authPromptForm.reset();
                setAuthPromptHost(null);
            }, 100);
        } else {
        }
    }, [authPromptOpen, authPromptForm]);

    return (
        <SidebarProvider>
            <Sidebar className="h-full flex flex-col">
                <SidebarContent className="flex flex-col flex-grow h-full">
                    <SidebarGroup className="flex flex-col flex-grow h-full">
                        <SidebarGroupLabel className="text-lg text-center font-bold text-white">
                            Termix / SSH
                        </SidebarGroupLabel>
                        <Separator className="p-0.25 mt-1 mb-1" />
                        <SidebarGroupContent className="flex flex-col flex-grow h-full">
                            <SidebarMenu className="flex flex-col flex-grow h-full">

                                <SidebarMenuItem key="Homepage">
                                    <Button
                                        className="w-full mt-2 mb-2 h-8"
                                        onClick={() => onSelectView("homepage")}
                                        variant="outline"
                                    >
                                        <CornerDownLeft />
                                        Return
                                    </Button>
                                    <Separator className="p-0.25 mt-1 mb-1" />
                                </SidebarMenuItem>

                                <SidebarMenuItem key="AddHost">
                                    <Sheet open={sheetOpen} onOpenChange={open => { if (!submitting) setSheetOpen(open); }}>
                                        <SheetTrigger asChild>
                                            <Button
                                                className="w-full mt-2 mb-2 h-8"
                                                variant="outline"
                                                onClick={() => setSheetOpen(true)}
                                                disabled={submitting}
                                            >
                                                <Plus />
                                                Add Host
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent
                                            side="left"
                                            className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col"
                                        >
                                            <SheetHeader className="pb-0.5">
                                                <SheetTitle>Add Host</SheetTitle>
                                                <SheetDescription>
                                                    Add a new SSH host connection with authentication details.
                                                </SheetDescription>
                                            </SheetHeader>

                                            <div className="flex-1 overflow-y-auto px-4">
                                                {submitError && (
                                                    <div className="text-red-500 text-sm mb-2">{submitError}</div>
                                                )}
                                                <Form {...addHostForm}>
                                                    <form
                                                        id="add-host-form"
                                                        onSubmit={addHostForm.handleSubmit(onAddHostSubmitReset)}
                                                        className="space-y-4"
                                                    >
                                                        {/* Name */}
                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="name"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Name</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="SSH #1" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        {/* Folder */}
                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="folder"
                                                            render={({ field }) => (
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
                                                                    {/* Folder dropdown menu */}
                                                                    {folderDropdownOpen && filteredFolders.length > 0 && (
                                                                        <div
                                                                            ref={folderDropdownRef}
                                                                            className="absolute top-full left-0 z-50 mt-1 w-full bg-[#18181b] border border-input rounded-md shadow-lg max-h-40 overflow-y-auto p-1"
                                                                        >
                                                                            <div className="grid grid-cols-1 gap-1 p-0">
                                                                                {filteredFolders.map((folder) => (
                                                                                    <Button
                                                                                        key={folder}
                                                                                        type="button"
                                                                                        variant="ghost"
                                                                                        size="sm"
                                                                                        className="w-full justify-start text-left rounded px-2 py-1.5 hover:bg-white/15 focus:bg-white/20 focus:outline-none"
                                                                                        onClick={() => handleFolderClick(folder)}
                                                                                        disabled={foldersLoading}
                                                                                    >
                                                                                        {folder}
                                                                                    </Button>
                                                                                ))}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                    {foldersLoading && <div className="text-xs text-muted-foreground mt-1">Loading folders...</div>}
                                                                    {foldersError && <div className="text-xs text-red-500 mt-1">{foldersError}</div>}
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        {/* Tags */}
                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="tagsInput"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Tags</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            placeholder="Add tags (space to add)"
                                                                            autoComplete="off"
                                                                            value={tagsInput}
                                                                            onChange={handleTagsInputChange}
                                                                        />
                                                                    </FormControl>
                                                                    {/* Tag chips */}
                                                                    {tags.length > 0 && (
                                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                                            {tags.map((tag) => (
                                                                                <Button
                                                                                    key={tag}
                                                                                    type="button"
                                                                                    variant="secondary"
                                                                                    size="sm"
                                                                                    className="rounded-full px-3 py-1 text-xs flex items-center gap-1"
                                                                                    onClick={() => handleRemoveTag(tag)}
                                                                                >
                                                                                    {tag}
                                                                                    <span className="ml-1 text-lg leading-none">&times;</span>
                                                                                </Button>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        Connection Details
                                                        <Separator className="p-0.25 mt-1 mb-3" />

                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="ip"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>IP</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="127.0.0.1" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="port"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Port</FormLabel>
                                                                    <FormControl>
                                                                        <Input 
                                                                            placeholder="22" 
                                                                            {...field}
                                                                            onChange={(e) => field.onChange(Number(e.target.value) || 22)}
                                                                        />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="username"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Username</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="username123" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        Authentication
                                                        <Separator className="p-0.25 mt-1 mb-3" />

                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="authMethod"
                                                            render={({ field }) => (
                                                                <Tabs value={field.value} onValueChange={field.onChange}>
                                                                    <TabsList className="grid w-full grid-cols-2 !mb-0">
                                                                        <TabsTrigger value="password">Password</TabsTrigger>
                                                                        <TabsTrigger value="key">SSH Key</TabsTrigger>
                                                                    </TabsList>

                                                                    <TabsContent value="password" className="mt-1">
                                                                        <FormField
                                                                            control={addHostForm.control}
                                                                            name="password"
                                                                            render={({ field }) => (
                                                                                <FormItem>
                                                                                    <FormLabel>Password</FormLabel>
                                                                                    <FormControl>
                                                                                        <Input
                                                                                            type="password"
                                                                                            placeholder="password123"
                                                                                            {...field}
                                                                                        />
                                                                                    </FormControl>
                                                                                    <FormMessage />
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                    </TabsContent>

                                                                    <TabsContent value="key" className="mt-1">
                                                                        <Controller
                                                                            control={addHostForm.control}
                                                                            name="sshKeyFile"
                                                                            render={({ field }) => (
                                                                                <FormItem>
                                                                                    <FormLabel>SSH Private Key</FormLabel>
                                                                                    <FormControl>
                                                                                        <div className="relative">
                                                                                            <input
                                                                                                id="file-upload"
                                                                                                type="file"
                                                                                                accept=".pem,.key,.txt"
                                                                                                onChange={(e) => {
                                                                                                    const file = e.target.files?.[0];
                                                                                                    field.onChange(file || null);
                                                                                                }}
                                                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                                            />
                                                                                            <Button type="button" variant="outline" className="w-full">
                                                                                                {field.value ? field.value.name : "Upload"}
                                                                                            </Button>
                                                                                        </div>
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                    </TabsContent>
                                                                </Tabs>
                                                            )}
                                                        />

                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="saveAuthMethod"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <div className="flex flex-row items-center gap-2">
                                                                            <Switch
                                                                                checked={!!field.value}
                                                                                onCheckedChange={field.onChange}
                                                                            />
                                                                            <FormLabel className="mb-0">Save Auth Method</FormLabel>
                                                                        </div>
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        Other
                                                        <Separator className="p-0.25 mt-1 mb-3" />
                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="isPinned"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormControl>
                                                                        <div className="flex flex-row items-center gap-2">
                                                                            <Switch
                                                                                checked={!!field.value}
                                                                                onCheckedChange={field.onChange}
                                                                            />
                                                                            <FormLabel className="mb-0">Pin Connection</FormLabel>
                                                                        </div>
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </form>
                                                </Form>
                                            </div>

                                            <Separator className="p-0.25 mt-2" />
                                            <SheetFooter className="px-4 pt-1 pb-4">
                                                <SheetClose asChild>
                                                    <Button type="submit" form="add-host-form" disabled={submitting}>
                                                        {submitting ? 'Adding...' : 'Add Host'}
                                                    </Button>
                                                </SheetClose>
                                                <SheetClose asChild>
                                                    <Button
                                                        type="button"
                                                        variant="secondary"
                                                        disabled={submitting}
                                                        onClick={async () => {
                                                            const data = addHostForm.getValues();
                                                            let sshKeyContent = data.sshKeyContent;
                                                            if (data.sshKeyFile instanceof File) {
                                                                sshKeyContent = await data.sshKeyFile.text();
                                                            }
                                                            onHostConnect({
                                                                ...data,
                                                                key: sshKeyContent,
                                                            });
                                                            addHostForm.reset();
                                                        }}
                                                    >
                                                        Quick Connect
                                                    </Button>
                                                </SheetClose>
                                                <SheetClose asChild>
                                                    <Button variant="outline" disabled={submitting}>Close</Button>
                                                </SheetClose>
                                            </SheetFooter>
                                        </SheetContent>
                                    </Sheet>
                                </SidebarMenuItem>

                                <SidebarMenuItem key="Main" className="flex flex-col flex-grow">
                                    <div className="w-full flex-grow rounded-md bg-[#09090b] border border-[#434345] overflow-hidden p-0 m-0 relative flex flex-col">
                                        {/* Search bar */}
                                        <div className="w-full px-2 pt-2 pb-1 bg-[#09090b] sticky top-0 z-10">
                                            <Input
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                placeholder="Search hosts..."
                                                className="w-full h-8 text-sm bg-background border border-border rounded"
                                                autoComplete="off"
                                            />
                                        </div>
                                        <Separator className="mx-2 mt-1" />
                                        {/* Error and status messages */}
                                        {hostsError && (
                                            <div className="px-2 py-1 mt-2">
                                                <div className="text-xs text-red-500 bg-red-500/10 rounded px-2 py-1 border border-red-500/20">{hostsError}</div>
                                            </div>
                                        )}
                                        {!hostsLoading && !hostsError && hosts.length === 0 && (
                                            <div className="px-2 py-1 mt-2">
                                                <div className="text-xs text-muted-foreground bg-muted/20 rounded px-2 py-1 border border-border/20">No hosts found.</div>
                                            </div>
                                        )}
                                        <div className="flex-1 min-h-0">
                                            <ScrollArea className="w-full h-full flex-1">
                                                <Accordion key={`host-accordion-${sortedFolders.length}`} type="multiple" className="w-full" defaultValue={sortedFolders.length > 0 ? sortedFolders : undefined}>
                                                    {sortedFolders.map((folder, idx) => (
                                                        <AccordionItem value={folder} key={`folder-${folder}`} className={idx === 0 ? "mt-0" : "mt-2"}>
                                                            <AccordionTrigger className="text-base font-semibold rounded-t-none px-3 py-2" style={{marginTop: idx === 0 ? 0 : undefined}}>{folder}</AccordionTrigger>
                                                            <AccordionContent className="flex flex-col gap-1 px-3 pb-2 pt-1">
                                                                {getSortedHosts(hostsByFolder[folder]).map(host => (
                                                                    <div key={host.id} className="w-full overflow-hidden">
                                                                        <HostMenuItem
                                                                            host={host}
                                                                            onHostConnect={handleHostConnect}
                                                                            onDeleteHost={onDeleteHost}
                                                                            onEditHost={() => {
                                                                                setEditHostData(host); 
                                                                                setEditHostOpen(true); 
                                                                            }}
                                                                            popoverOpen={!!hostPopoverOpen[host.id]}
                                                                            setPopoverOpen={(open: boolean) => handlePopoverOpenChange(host.id, open)}
                                                                        />
                                                                    </div>
                                                                ))}
                                                            </AccordionContent>
                                                        </AccordionItem>
                                                    ))}
                                                </Accordion>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
            {/* Edit Host Sheet */}
            <Sheet open={editHostOpen} onOpenChange={(open) => {
                if (!open) {
                    setTimeout(() => {
                        setEditHostData(null);
                        editHostForm.reset();
                    }, 100);
                }
                setEditHostOpen(open);
            }}>
                <SheetContent side="left" className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col">
                    <SheetHeader className="pb-0.5">
                        <SheetTitle>Edit Host</SheetTitle>
                        <SheetDescription>
                            Modify the SSH host connection settings and authentication details.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4">
                        <Form {...editHostForm}>
                            <form
                                id="edit-host-form"
                                onSubmit={editHostForm.handleSubmit(onEditHostSubmit)}
                                className="space-y-4"
                            >
                                <FormField
                                    control={editHostForm.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="SSH #1" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editHostForm.control}
                                    name="folder"
                                    render={({ field }) => (
                                        <FormItem className="relative">
                                            <FormLabel>Folder</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. Work"
                                                    {...field}
                                                    ref={el => {
                                                        if (typeof field.ref === 'function') field.ref(el);
                                                        (editFolderInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
                                                    }}
                                                    onFocus={() => setEditFolderDropdownOpen(true)}
                                                    onChange={e => {
                                                        field.onChange(e);
                                                        setEditFolderDropdownOpen(true);
                                                    }}
                                                    disabled={foldersLoading}
                                                />
                                            </FormControl>
                                            {editFolderDropdownOpen && filteredFolders.length > 0 && (
                                                <div
                                                    ref={editFolderDropdownRef}
                                                    className="absolute top-full left-0 z-50 mt-1 w-full bg-[#18181b] border border-input rounded-md shadow-lg max-h-40 overflow-y-auto p-1"
                                                >
                                                    <div className="grid grid-cols-1 gap-1 p-0">
                                                        {filteredFolders.map((folder) => (
                                                            <Button
                                                                key={folder}
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-start text-left rounded px-2 py-1.5 hover:bg-white/15 focus:bg-white/20 focus:outline-none"
                                                                onClick={() => {
                                                                    editHostForm.setValue('folder', folder);
                                                                    setEditFolderDropdownOpen(false);
                                                                }}
                                                                disabled={foldersLoading}
                                                            >
                                                                {folder}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {foldersLoading && <div className="text-xs text-muted-foreground mt-1">Loading folders...</div>}
                                            {foldersError && <div className="text-xs text-red-500 mt-1">{foldersError}</div>}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editHostForm.control}
                                    name="tagsInput"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Tags</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Add tags (space to add)"
                                                    autoComplete="off"
                                                    value={editTagsInput}
                                                    onChange={handleEditTagsInputChange}
                                                />
                                            </FormControl>
                                            {/* Tag chips */}
                                            {editTags.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {editTags.map((tag) => (
                                                        <Button
                                                            key={tag}
                                                            type="button"
                                                            variant="secondary"
                                                            size="sm"
                                                            className="rounded-full px-3 py-1 text-xs flex items-center gap-1"
                                                            onClick={() => handleRemoveEditTag(tag)}
                                                        >
                                                            {tag}
                                                            <span className="ml-1 text-lg leading-none">&times;</span>
                                                        </Button>
                                                    ))}
                                                </div>
                                            )}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                Connection Details
                                <Separator className="p-0.25 mt-1 mb-3" />
                                <FormField
                                    control={editHostForm.control}
                                    name="ip"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>IP</FormLabel>
                                            <FormControl>
                                                <Input placeholder="127.0.0.1" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editHostForm.control}
                                    name="port"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Port</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    placeholder="22" 
                                                    {...field}
                                                    onChange={(e) => field.onChange(Number(e.target.value) || 22)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={editHostForm.control}
                                    name="username"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Username</FormLabel>
                                            <FormControl>
                                                <Input placeholder="username123" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                Authentication
                                <Separator className="p-0.25 mt-1 mb-3" />
                                <FormField
                                    control={editHostForm.control}
                                    name="authMethod"
                                    render={({ field }) => (
                                        <Tabs value={field.value} onValueChange={field.onChange}>
                                            <TabsList className="grid w-full grid-cols-2 !mb-0">
                                                <TabsTrigger value="password">Password</TabsTrigger>
                                                <TabsTrigger value="key">SSH Key</TabsTrigger>
                                            </TabsList>
                                            <TabsContent value="password" className="mt-1">
                                                <FormField
                                                    control={editHostForm.control}
                                                    name="password"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Password</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="password123"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TabsContent>
                                            <TabsContent value="key" className="mt-1">
                                                <Controller
                                                    control={editHostForm.control}
                                                    name="sshKeyFile"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>SSH Private Key</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <input
                                                                        id="file-upload"
                                                                        type="file"
                                                                        accept=".pem,.key,.txt"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            field.onChange(file || null);
                                                                        }}
                                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                    />
                                                                    <Button type="button" variant="outline" className="w-full">
                                                                        {field.value ? field.value.name : "Upload"}
                                                                    </Button>
                                                                </div>
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TabsContent>
                                        </Tabs>
                                    )}
                                />
                                <FormField
                                    control={editHostForm.control}
                                    name="saveAuthMethod"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="flex flex-row items-center gap-2">
                                                    <Switch
                                                        checked={!!field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                    <FormLabel className="mb-0">Save Auth Method</FormLabel>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                Other
                                <Separator className="p-0.25 mt-1 mb-3" />
                                <FormField
                                    control={editHostForm.control}
                                    name="isPinned"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormControl>
                                                <div className="flex flex-row items-center gap-2">
                                                    <Switch
                                                        checked={!!field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                    <FormLabel className="mb-0">Pin Connection</FormLabel>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </form>
                        </Form>
                    </div>
                    <Separator className="p-0.25 mt-2" />
                    <SheetFooter className="px-4 pt-1 pb-4">
                        <SheetClose asChild>
                            <Button type="submit" form="edit-host-form">
                                Edit
                            </Button>
                        </SheetClose>
                        <SheetClose asChild>
                            <Button variant="outline">Close</Button>
                        </SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
            {/* Auth Prompt Sheet */}
            <Sheet open={authPromptOpen} onOpenChange={(open) => {
                setAuthPromptOpen(open);
            }}>
                <SheetContent side="left" className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col">
                    <SheetHeader className="pb-0.5">
                        <SheetTitle>Enter Credentials</SheetTitle>
                        <SheetDescription>
                            Provide authentication credentials to connect to the SSH host.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4">
                        <Form {...authPromptForm}>
                            <form
                                id="auth-prompt-form"
                                onSubmit={authPromptForm.handleSubmit(onAuthPromptSubmit)}
                                className="space-y-4"
                            >
                                <FormField
                                    control={authPromptForm.control}
                                    name="authMethod"
                                    render={({ field }) => (
                                        <Tabs value={field.value} onValueChange={field.onChange}>
                                            <TabsList className="grid w-full grid-cols-2 !mb-0">
                                                <TabsTrigger value="password">Password</TabsTrigger>
                                                <TabsTrigger value="key">SSH Key</TabsTrigger>
                                            </TabsList>

                                            <TabsContent value="password" className="mt-1">
                                                <FormField
                                                    control={authPromptForm.control}
                                                    name="password"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Password</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="Enter password"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </TabsContent>

                                            <TabsContent value="key" className="mt-1">
                                                <Controller
                                                    control={authPromptForm.control}
                                                    name="sshKeyFile"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>SSH Private Key</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <input
                                                                        id="auth-file-upload"
                                                                        type="file"
                                                                        accept=".pem,.key,.txt"
                                                                        onChange={(e) => {
                                                                            const file = e.target.files?.[0];
                                                                            field.onChange(file || null);
                                                                        }}
                                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                    />
                                                                    <Button type="button" variant="outline" className="w-full">
                                                                        {field.value ? field.value.name : "Upload Key"}
                                                                    </Button>
                                                                </div>
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </TabsContent>
                                        </Tabs>
                                    )}
                                />
                            </form>
                        </Form>
                    </div>
                    <Separator className="p-0.25 mt-2" />
                    <SheetFooter className="px-4 pt-1 pb-4">
                        <SheetClose asChild>
                            <Button type="submit" form="auth-prompt-form">
                                Connect
                            </Button>
                        </SheetClose>
                        <SheetClose asChild>
                            <Button variant="outline">Cancel</Button>
                        </SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </SidebarProvider>
    );
}

const HostMenuItem = React.memo(function HostMenuItem({ host, onHostConnect, onDeleteHost, onEditHost, popoverOpen, setPopoverOpen }: any) {
    const tags = Array.isArray(host.tags) ? host.tags : (typeof host.tags === 'string' ? host.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : []);
    const hasTags = tags.length > 0;
    return (
        <div className="relative group flex flex-col mb-1 w-full overflow-hidden" style={{ height: hasTags ? 70 : 40, maxWidth: '213px' }}>
            <div className={`flex flex-col w-full rounded overflow-hidden border border-border bg-secondary h-full`} style={{ maxWidth: '213px' }}>
                <div className="flex w-full h-10">
                    {/* Left: Name + Star - Horizontal scroll only */}
                    <div className="flex items-center h-full px-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent min-w-0 border-r border-border hover:bg-muted transition-colors cursor-pointer" 
                         style={{ flex: '0 1 calc(100% - 32px)', maxWidth: 'calc(100% - 32px)' }}
                         onClick={() => onHostConnect(host)}
                    >
                        <div className="flex items-center whitespace-nowrap" style={{ minWidth: 'max-content' }}>
                            {host.isPinned && <span className="text-yellow-400 mr-1 flex-shrink-0">★</span>}
                            <span className="font-medium">{host.name || host.ip}</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-center h-full border-l border-border hover:bg-muted transition-colors" style={{ width: 32, minWidth: 32, maxWidth: 32, flexShrink: 0 }}>
                        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                            <PopoverTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-full w-full flex items-center justify-center p-0">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent align="start" side="right" sideOffset={8} className="w-36 p-2">
                                <Button
                                    variant="outline"
                                    className="w-full mb-2"
                                    onClick={() => { setPopoverOpen(false); onEditHost(); }}
                                >
                                    Edit
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="w-full"
                                    onClick={() => { setPopoverOpen(false); onDeleteHost(host); }}
                                >
                                    Delete
                                </Button>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
                {hasTags && (
                    <div className="border-t border-border bg-secondary flex items-center gap-1 px-2 py-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent" style={{ height: 30, width: '100%' }}>
                        {tags.map((tag: string) => (
                            <span key={tag} className="bg-muted-foreground/10 text-xs rounded-full px-2 py-0.5 text-muted-foreground whitespace-nowrap border border-border flex-shrink-0">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});