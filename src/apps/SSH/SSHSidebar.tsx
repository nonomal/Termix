import React, { useState, useMemo } from 'react';
import { useForm, Controller } from "react-hook-form";

import {
    CornerDownLeft,
    Plus,
    MoreVertical,
    Hammer
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
import Icon from "../../../public/icon.svg";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

interface SidebarProps {
    onSelectView: (view: string) => void;
    onAddHostSubmit: (data: any) => void;
    onHostConnect: (hostConfig: any) => void;
    allTabs: { id: number; title: string; terminalRef: React.RefObject<any> }[];
    runCommandOnTabs: (tabIds: number[], command: string) => void;
}

interface AuthPromptFormData {
    password: string;
    authMethod: string;
    sshKeyFile: File | null;
    sshKeyContent?: string;
    keyPassword?: string;
    keyType?: string;
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
    keyPassword?: string;
    keyType?: string;
    saveAuthMethod: boolean;
    isPinned: boolean;
}

export function SSHSidebar({ onSelectView, onAddHostSubmit, onHostConnect, allTabs, runCommandOnTabs }: SidebarProps): React.ReactElement {
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
                    keyPassword: data.keyPassword,
                    keyType: data.keyType === 'auto' ? '' : data.keyType,
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
                keyPassword: editHostData.keyPassword || '',
                keyType: editHostData.keyType || '',
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
                    password: data.password, // always send
                    authMethod: data.authMethod,
                    key: sshKeyContent, // always send
                    keyPassword: data.keyPassword, // always send
                    keyType: data.keyType, // always send
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
            keyPassword: data.authMethod === 'key' ? data.keyPassword : undefined,
            keyType: data.authMethod === 'key' ? (data.keyType === 'auto' ? undefined : data.keyType) : undefined,
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

    // Key type options
    const keyTypeOptions = [
        { value: 'auto', label: 'Auto-detect' },
        { value: 'ssh-rsa', label: 'RSA' },
        { value: 'ssh-ed25519', label: 'ED25519' },
        { value: 'ecdsa-sha2-nistp256', label: 'ECDSA NIST P-256' },
        { value: 'ecdsa-sha2-nistp384', label: 'ECDSA NIST P-384' },
        { value: 'ecdsa-sha2-nistp521', label: 'ECDSA NIST P-521' },
        { value: 'ssh-dss', label: 'DSA' },
        { value: 'ssh-rsa-sha2-256', label: 'RSA SHA2-256' },
        { value: 'ssh-rsa-sha2-512', label: 'RSA SHA2-512' },
    ];

    const [keyTypeDropdownOpen, setKeyTypeDropdownOpen] = useState(false);
    const [editKeyTypeDropdownOpen, setEditKeyTypeDropdownOpen] = useState(false);
    const keyTypeDropdownRef = React.useRef<HTMLDivElement>(null);
    const editKeyTypeDropdownRef = React.useRef<HTMLDivElement>(null);
    const keyTypeButtonRef = React.useRef<HTMLButtonElement>(null);
    const editKeyTypeButtonRef = React.useRef<HTMLButtonElement>(null);

    // Close dropdown on outside click (add form)
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                keyTypeDropdownRef.current &&
                !keyTypeDropdownRef.current.contains(event.target as Node) &&
                keyTypeButtonRef.current &&
                !keyTypeButtonRef.current.contains(event.target as Node)
            ) {
                setKeyTypeDropdownOpen(false);
            }
        }
        if (keyTypeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [keyTypeDropdownOpen]);
    // Close dropdown on outside click (edit form)
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                editKeyTypeDropdownRef.current &&
                !editKeyTypeDropdownRef.current.contains(event.target as Node) &&
                editKeyTypeButtonRef.current &&
                !editKeyTypeButtonRef.current.contains(event.target as Node)
            ) {
                setEditKeyTypeDropdownOpen(false);
            }
        }
        if (editKeyTypeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editKeyTypeDropdownOpen]);

    const [keyTypeDropdownOpenAuth, setKeyTypeDropdownOpenAuth] = useState(false);
    const keyTypeDropdownAuthRef = React.useRef<HTMLDivElement>(null);
    const keyTypeButtonAuthRef = React.useRef<HTMLButtonElement>(null);

    // Close dropdown on outside click (auth prompt)
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                keyTypeDropdownAuthRef.current &&
                !keyTypeDropdownAuthRef.current.contains(event.target as Node) &&
                keyTypeButtonAuthRef.current &&
                !keyTypeButtonAuthRef.current.contains(event.target as Node)
            ) {
                setKeyTypeDropdownOpenAuth(false);
            }
        }
        if (keyTypeDropdownOpenAuth) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [keyTypeDropdownOpenAuth]);

    // Tools Sheet State
    const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
    const [toolsCommand, setToolsCommand] = useState("");
    const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);
    const handleTabToggle = (tabId: number) => {
        setSelectedTabIds(prev => prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]);
    };
    // --- Fix: Run Command logic ---
    const handleRunCommand = () => {
        if (selectedTabIds.length && toolsCommand.trim()) {
            // Ensure command ends with newline
            let cmd = toolsCommand;
            if (!cmd.endsWith("\n")) cmd += "\n";
            runCommandOnTabs(selectedTabIds, cmd);
            setToolsCommand(""); // Clear after run
        }
    };

    return (
        <SidebarProvider>
            <Sidebar className="h-full flex flex-col overflow-hidden">
                <SidebarContent className="flex flex-col flex-grow h-full overflow-hidden">
                    <SidebarGroup className="flex flex-col flex-grow h-full overflow-hidden">
                        <SidebarGroupLabel className="text-lg font-bold text-white flex items-center gap-2">
                            <img src={Icon} alt="Icon" className="w-6 h-6" />
                            - Termix / SSH
                        </SidebarGroupLabel>
                        <Separator className="p-0.25 mt-1 mb-1" />
                        <SidebarGroupContent className="flex flex-col flex-grow h-full overflow-hidden">
                            <SidebarMenu className="flex flex-col flex-grow h-full overflow-hidden">

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
                                                                        accept=".pem,.key,.txt,.ppk"
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
                                                <FormField
                                                    control={addHostForm.control}
                                                    name="keyPassword"
                                                    render={({ field }) => (
                                                        <FormItem className="mt-3">
                                                            <FormLabel>Key Password (if protected)</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="Enter key password"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={addHostForm.control}
                                                    name="keyType"
                                                    render={({ field }) => (
                                                        <FormItem className="mt-3 relative">
                                                            <FormLabel>Key Type</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Button
                                                                        ref={keyTypeButtonRef}
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="w-full justify-start text-left rounded-md px-2 py-2 bg-[#18181b] border border-input text-foreground"
                                                                        onClick={() => setKeyTypeDropdownOpen((open) => !open)}
                                                                    >
                                                                        {keyTypeOptions.find(opt => opt.value === field.value)?.label || 'Auto-detect'}
                                                                    </Button>
                                                                    {keyTypeDropdownOpen && (
                                                                        <div
                                                                            ref={keyTypeDropdownRef}
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
                                                                                            setKeyTypeDropdownOpen(false);
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
                                                            <FormMessage />
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

                                <SidebarMenuItem key="Main" className="flex flex-col flex-grow overflow-hidden">
                                    <div className="w-full flex-grow rounded-md bg-[#09090b] border border-[#434345] overflow-hidden p-0 m-0 relative flex flex-col min-h-0">
                                        {/* Search bar */}
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
                                            <ScrollArea className="w-full h-full">
                                                <Accordion key={`host-accordion-${sortedFolders.length}`} type="multiple" className="w-full" defaultValue={sortedFolders.length > 0 ? sortedFolders : undefined}>
                                                    {sortedFolders.map((folder, idx) => (
                                                        <React.Fragment key={folder}>
                                                            <AccordionItem value={folder} className={idx === 0 ? "mt-0 !border-b-transparent" : "mt-2 !border-b-transparent"}>
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
                                                            {idx < sortedFolders.length - 1 && (
                                                                <div style={{ display: 'flex', justifyContent: 'center' }}>
                                                                    <Separator className="h-px bg-[#434345] my-1" style={{ width: 213 }} />
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </Accordion>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                        {/* Tools Button at the very bottom */}
                        <div className="bg-sidebar">
                            <Sheet open={toolsSheetOpen} onOpenChange={setToolsSheetOpen}>
                                <SheetTrigger asChild>
                                    <Button
                                        className="w-full h-8 mt-2"
                                        variant="outline"
                                        onClick={() => setToolsSheetOpen(true)}
                                    >
                                        <Hammer className="mr-2 h-4 w-4" />
                                        Tools
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col">
                                    <SheetHeader className="pb-0.5">
                                        <SheetTitle>Tools</SheetTitle>
                                    </SheetHeader>
                                    <div className="flex-1 overflow-y-auto px-2 pt-2">
                                        <Accordion type="single" collapsible defaultValue="multiwindow">
                                            <AccordionItem value="multiwindow">
                                                <AccordionTrigger className="text-base font-semibold">Run multiwindow commands</AccordionTrigger>
                                                <AccordionContent>
                                                    <textarea
                                                        className="w-full min-h-[120px] max-h-48 rounded-md border border-input text-foreground p-2 text-sm font-mono resize-vertical focus:outline-none focus:ring-0"
                                                        placeholder="Enter command(s) to run on selected tabs..."
                                                        value={toolsCommand}
                                                        onChange={e => setToolsCommand(e.target.value)}
                                                        style={{ fontFamily: 'monospace', marginBottom: 8, background: '#141416' }}
                                                    />
                                                    {/* Tab selection as tag-like buttons */}
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {allTabs.map(tab => (
                                                            <Button
                                                                key={tab.id}
                                                                type="button"
                                                                variant={selectedTabIds.includes(tab.id) ? "secondary" : "outline"}
                                                                size="sm"
                                                                className="rounded-full px-3 py-1 text-xs flex items-center gap-1"
                                                                onClick={() => handleTabToggle(tab.id)}
                                                            >
                                                                {tab.title}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        className="w-full"
                                                        variant="outline"
                                                        onClick={handleRunCommand}
                                                        disabled={!toolsCommand.trim() || !selectedTabIds.length}
                                                    >
                                                        Run Command
                                                    </Button>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
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
                                                                        accept=".pem,.key,.txt,.ppk"
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
                                                <FormField
                                                    control={editHostForm.control}
                                                    name="keyPassword"
                                                    render={({ field }) => (
                                                        <FormItem className="mt-3">
                                                            <FormLabel>Key Password (if protected)</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="Enter key password"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={editHostForm.control}
                                                    name="keyType"
                                                    render={({ field }) => (
                                                        <FormItem className="mt-3 relative">
                                                            <FormLabel>Key Type</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Button
                                                                        ref={editKeyTypeButtonRef}
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="w-full justify-start text-left rounded-md px-2 py-2 bg-[#18181b] border border-input text-foreground"
                                                                        onClick={() => setEditKeyTypeDropdownOpen((open) => !open)}
                                                                    >
                                                                        {keyTypeOptions.find(opt => opt.value === field.value)?.label || 'Auto-detect'}
                                                                    </Button>
                                                                    {editKeyTypeDropdownOpen && (
                                                                        <div
                                                                            ref={editKeyTypeDropdownRef}
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
                                                                                            setEditKeyTypeDropdownOpen(false);
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
                                                            <FormMessage />
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
                                                                        accept=".pem,.key,.txt,.ppk"
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
                                                <FormField
                                                    control={authPromptForm.control}
                                                    name="keyPassword"
                                                    render={({ field }) => (
                                                        <FormItem className="mt-3">
                                                            <FormLabel>Key Password (if protected)</FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="password"
                                                                    placeholder="Enter key password"
                                                                    {...field}
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={authPromptForm.control}
                                                    name="keyType"
                                                    render={({ field }) => (
                                                        <FormItem className="mt-3 relative">
                                                            <FormLabel>Key Type</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Button
                                                                        ref={keyTypeButtonAuthRef}
                                                                        type="button"
                                                                        variant="outline"
                                                                        className="w-full justify-start text-left rounded-md px-2 py-2 bg-[#18181b] border border-input text-foreground"
                                                                        onClick={() => setKeyTypeDropdownOpenAuth((open) => !open)}
                                                                    >
                                                                        {keyTypeOptions.find(opt => opt.value === field.value)?.label || 'Auto-detect'}
                                                                    </Button>
                                                                    {keyTypeDropdownOpenAuth && (
                                                                        <div
                                                                            ref={keyTypeDropdownAuthRef}
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
                                                                                            setKeyTypeDropdownOpenAuth(false);
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
                                                            <FormMessage />
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
            <div className={`flex flex-col w-full rounded overflow-hidden border border-[#434345] bg-[#18181b] h-full`} style={{ maxWidth: '213px' }}>
                <div className="flex w-full h-10">
                    {/* Left: Name + Star - Horizontal scroll only */}
                    <div className="flex items-center h-full px-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent min-w-0 border-r border-[#434345] hover:bg-muted transition-colors cursor-pointer" 
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
                    <div className="border-t border-border bg-[#18181b] flex items-center gap-1 px-2 py-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent" style={{ height: 30, width: '100%' }}>
                        {tags.map((tag: string) => (
                            <span key={tag} className="bg-muted-foreground/10 text-xs rounded-full px-2 py-0.5 text-muted-foreground whitespace-nowrap border border-border flex-shrink-0 hover:bg-muted transition-colors">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});