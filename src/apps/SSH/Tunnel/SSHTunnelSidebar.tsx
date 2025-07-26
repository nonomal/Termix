import React, { useState } from 'react';
import { useForm, Controller } from "react-hook-form";

import {
    CornerDownLeft,
    Plus,
    ArrowRight,
    AlertTriangle,
    Info
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
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert.tsx";

interface SidebarProps {
    onSelectView: (view: string) => void;
    onTunnelAdded?: () => void;
    onEditTunnel?: (tunnelId: string, data: any) => void;
}

interface AddTunnelFormData {
    tunnelName: string;
    folder: string;
    sourcePort: number;
    endpointPort: number;
    sourceIP: string;
    sourceSSHPort: number;
    sourceUsername: string;
    sourcePassword: string;
    sourceAuthMethod: string;
    sourceSSHKeyFile: File | null;
    sourceSSHKeyContent?: string;
    sourceKeyPassword?: string;
    sourceKeyType?: string;
    endpointIP: string;
    endpointSSHPort: number;
    endpointUsername: string;
    endpointPassword: string;
    endpointAuthMethod: string;
    endpointSSHKeyFile: File | null;
    endpointSSHKeyContent?: string;
    endpointKeyPassword?: string;
    endpointKeyType?: string;
    maxRetries: number;
    retryInterval: number;
    autoStart: boolean;
    isPinned: boolean;
}

export const SSHTunnelSidebar = React.forwardRef<{ openEditSheet: (tunnel: any) => void }, SidebarProps>(
    ({ onSelectView, onTunnelAdded, onEditTunnel }, ref) => {
    const addTunnelForm = useForm<AddTunnelFormData>({
        defaultValues: {
            tunnelName: 'My SSH Tunnel',
            folder: '',
            sourcePort: 22,
            endpointPort: 224,
            sourceIP: 'localhost',
            sourceSSHPort: 22,
            sourceUsername: 'test',
            sourcePassword: '',
            sourceAuthMethod: 'password',
            sourceSSHKeyFile: null,
            endpointIP: 'test',
            endpointSSHPort: 22,
            endpointUsername: 'test',
            endpointPassword: '',
            endpointAuthMethod: 'password',
            endpointSSHKeyFile: null,
            maxRetries: 3,
            retryInterval: 5000,
            autoStart: false,
            isPinned: false
        }
    });

    const editTunnelForm = useForm<AddTunnelFormData>({
        defaultValues: {
            tunnelName: '',
            folder: '',
            sourcePort: 22,
            endpointPort: 224,
            sourceIP: '',
            sourceSSHPort: 22,
            sourceUsername: '',
            sourcePassword: '',
            sourceAuthMethod: 'password',
            sourceSSHKeyFile: null,
            endpointIP: '',
            endpointSSHPort: 22,
            endpointUsername: '',
            endpointPassword: '',
            endpointAuthMethod: 'password',
            endpointSSHKeyFile: null,
            maxRetries: 3,
            retryInterval: 5000,
            autoStart: false,
            isPinned: false
        }
    });

    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editSheetOpen, setEditSheetOpen] = useState(false);
    const [editTunnelData, setEditTunnelData] = useState<any | null>(null);
    const [folders, setFolders] = useState<string[]>([]);
    const [foldersLoading, setFoldersLoading] = useState(false);
    const [foldersError, setFoldersError] = useState<string | null>(null);

    React.useEffect(() => {
        if (!sheetOpen) {
            setSubmitError(null);
        }
    }, [sheetOpen]);

    React.useEffect(() => {
        if (!editSheetOpen) {
            setEditFolderDropdownOpen(false);
        }
    }, [editSheetOpen]);

    React.useEffect(() => {
        async function fetchFolders() {
            setFoldersLoading(true);
            setFoldersError(null);
            try {
                const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
                const res = await axios.get(
                    (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + '/ssh_tunnel/folders',
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

    const onAddTunnelSubmit = async (data: AddTunnelFormData) => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            let sourceSSHKeyContent = data.sourceSSHKeyContent;
            if (data.sourceSSHKeyFile instanceof File) {
                sourceSSHKeyContent = await data.sourceSSHKeyFile.text();
            }
            
            let endpointSSHKeyContent = data.endpointSSHKeyContent;
            if (data.endpointSSHKeyFile instanceof File) {
                endpointSSHKeyContent = await data.endpointSSHKeyFile.text();
            }

            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
                            await axios.post(
                    (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + '/ssh_tunnel/tunnel',
                    {
                        name: data.tunnelName,
                        folder: data.folder,
                        sourcePort: data.sourcePort,
                        endpointPort: data.endpointPort,
                        sourceIP: data.sourceIP,
                        sourceSSHPort: data.sourceSSHPort,
                        sourceUsername: data.sourceUsername,
                        sourcePassword: data.sourcePassword,
                        sourceAuthMethod: data.sourceAuthMethod,
                        sourceSSHKey: sourceSSHKeyContent,
                        sourceKeyPassword: data.sourceKeyPassword,
                        sourceKeyType: data.sourceKeyType === 'auto' ? '' : data.sourceKeyType,
                        endpointIP: data.endpointIP,
                        endpointSSHPort: data.endpointSSHPort,
                        endpointUsername: data.endpointUsername,
                        endpointPassword: data.endpointPassword,
                        endpointAuthMethod: data.endpointAuthMethod,
                        endpointSSHKey: endpointSSHKeyContent,
                        endpointKeyPassword: data.endpointKeyPassword,
                        endpointKeyType: data.endpointKeyType === 'auto' ? '' : data.endpointKeyType,
                        maxRetries: data.maxRetries,
                        retryInterval: data.retryInterval,
                        autoStart: data.autoStart,
                        isPinned: data.isPinned
                    },
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            setSheetOpen(false);
            addTunnelForm.reset();
            if (data.folder && !folders.includes(data.folder)) {
                setFolders(prev => [...prev, data.folder]);
            }
            onTunnelAdded?.();
        } catch (err: any) {
            setSubmitError(err?.response?.data?.error || 'Failed to create SSH tunnel');
        } finally {
            setSubmitting(false);
        }
    };

    const onEditTunnelSubmit = async (data: AddTunnelFormData) => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            let sourceSSHKeyContent = data.sourceSSHKeyContent;
            if (data.sourceSSHKeyFile instanceof File) {
                sourceSSHKeyContent = await data.sourceSSHKeyFile.text();
            }
            
            let endpointSSHKeyContent = data.endpointSSHKeyContent;
            if (data.endpointSSHKeyFile instanceof File) {
                endpointSSHKeyContent = await data.endpointSSHKeyFile.text();
            }

            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
            if (!editTunnelData?.id) {
                throw new Error('No tunnel ID found for editing');
            }
            await axios.put(
                (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + `/ssh_tunnel/tunnel/${editTunnelData.id}`,
                {
                    name: data.tunnelName,
                    folder: data.folder,
                    sourcePort: data.sourcePort,
                    endpointPort: data.endpointPort,
                    sourceIP: data.sourceIP,
                    sourceSSHPort: data.sourceSSHPort,
                    sourceUsername: data.sourceUsername,
                    sourcePassword: data.sourcePassword,
                    sourceAuthMethod: data.sourceAuthMethod,
                    sourceSSHKey: sourceSSHKeyContent,
                    sourceKeyPassword: data.sourceKeyPassword,
                    sourceKeyType: data.sourceKeyType === 'auto' ? '' : data.sourceKeyType,
                    endpointIP: data.endpointIP,
                    endpointSSHPort: data.endpointSSHPort,
                    endpointUsername: data.endpointUsername,
                    endpointPassword: data.endpointPassword,
                    endpointAuthMethod: data.endpointAuthMethod,
                    endpointSSHKey: endpointSSHKeyContent,
                    endpointKeyPassword: data.endpointKeyPassword,
                    endpointKeyType: data.endpointKeyType === 'auto' ? '' : data.endpointKeyType,
                    maxRetries: data.maxRetries,
                    retryInterval: data.retryInterval,
                    autoStart: data.autoStart,
                    isPinned: data.isPinned
                },
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            setEditSheetOpen(false);
            editTunnelForm.reset();
            onTunnelAdded?.();
        } catch (err: any) {
            setSubmitError(err?.response?.data?.error || 'Failed to update SSH tunnel');
        } finally {
            setSubmitting(false);
        }
    };

    const sourcePort = addTunnelForm.watch('sourcePort');
    const endpointPort = addTunnelForm.watch('endpointPort');
    const folderValue = addTunnelForm.watch('folder');
    const filteredFolders = React.useMemo(() => {
        if (!folderValue) return folders;
        return folders.filter(f => f.toLowerCase().includes(folderValue.toLowerCase()));
    }, [folderValue, folders]);

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

    // Key type dropdown state and refs for source
    const [sourceKeyTypeDropdownOpen, setSourceKeyTypeDropdownOpen] = useState(false);
    const sourceKeyTypeDropdownRef = React.useRef<HTMLDivElement>(null);
    const sourceKeyTypeButtonRef = React.useRef<HTMLButtonElement>(null);

    // Key type dropdown state and refs for endpoint
    const [endpointKeyTypeDropdownOpen, setEndpointKeyTypeDropdownOpen] = useState(false);
    const endpointKeyTypeDropdownRef = React.useRef<HTMLDivElement>(null);
    const endpointKeyTypeButtonRef = React.useRef<HTMLButtonElement>(null);
    const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
    const folderInputRef = React.useRef<HTMLInputElement>(null);
    const folderDropdownRef = React.useRef<HTMLDivElement>(null);
    const [editSourceKeyTypeDropdownOpen, setEditSourceKeyTypeDropdownOpen] = useState(false);
    const [editEndpointKeyTypeDropdownOpen, setEditEndpointKeyTypeDropdownOpen] = useState(false);
    const [editFolderDropdownOpen, setEditFolderDropdownOpen] = useState(false);
    const editFolderInputRef = React.useRef<HTMLInputElement>(null);
    const editFolderDropdownRef = React.useRef<HTMLDivElement>(null);

    // Close dropdown on outside click (source)
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                sourceKeyTypeDropdownRef.current &&
                !sourceKeyTypeDropdownRef.current.contains(event.target as Node) &&
                sourceKeyTypeButtonRef.current &&
                !sourceKeyTypeButtonRef.current.contains(event.target as Node)
            ) {
                setSourceKeyTypeDropdownOpen(false);
            }
        }
        if (sourceKeyTypeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [sourceKeyTypeDropdownOpen]);

    // Close dropdown on outside click (endpoint)
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                endpointKeyTypeDropdownRef.current &&
                !endpointKeyTypeDropdownRef.current.contains(event.target as Node) &&
                endpointKeyTypeButtonRef.current &&
                !endpointKeyTypeButtonRef.current.contains(event.target as Node)
            ) {
                                                                                                                    setEditEndpointKeyTypeDropdownOpen(false);
            }
        }
        if (endpointKeyTypeDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [endpointKeyTypeDropdownOpen]);

    // Close dropdown on outside click (folder)
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

    // Close dropdown on outside click (edit folder)
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                editFolderDropdownRef.current &&
                !editFolderDropdownRef.current.contains(event.target as Node) &&
                editFolderInputRef.current &&
                !editFolderInputRef.current.contains(event.target as Node)
            ) {
                setEditFolderDropdownOpen(false);
            }
        }
        if (editFolderDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        } else {
            document.removeEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [editFolderDropdownOpen]);

    const handleFolderClick = (folder: string) => {
        addTunnelForm.setValue('folder', folder);
        setFolderDropdownOpen(false);
    };

    // Expose the openEditSheet function through the ref
    const openEditSheet = React.useCallback((tunnel: any) => {
        setEditTunnelData(tunnel);
        setEditSheetOpen(true);
    }, []);

    // Expose the function through the ref
    React.useImperativeHandle(ref, () => ({
        openEditSheet
    }), [openEditSheet]);

    // Populate edit form when editTunnelData changes
    React.useEffect(() => {
        if (editTunnelData) {
            editTunnelForm.reset({
                tunnelName: editTunnelData.name || '',
                folder: editTunnelData.folder || '',
                sourcePort: editTunnelData.sourcePort || 22,
                endpointPort: editTunnelData.endpointPort || 22,
                sourceIP: editTunnelData.sourceIP || '',
                sourceSSHPort: editTunnelData.sourceSSHPort || 22,
                sourceUsername: editTunnelData.sourceUsername || '',
                sourcePassword: editTunnelData.sourcePassword || '',
                sourceAuthMethod: editTunnelData.sourceAuthMethod || 'password',
                sourceSSHKeyFile: null,
                sourceSSHKeyContent: editTunnelData.sourceSSHKey || '',
                sourceKeyPassword: editTunnelData.sourceKeyPassword || '',
                sourceKeyType: editTunnelData.sourceKeyType || '',
                endpointIP: editTunnelData.endpointIP || '',
                endpointSSHPort: editTunnelData.endpointSSHPort || 22,
                endpointUsername: editTunnelData.endpointUsername || '',
                endpointPassword: editTunnelData.endpointPassword || '',
                endpointAuthMethod: editTunnelData.endpointAuthMethod || 'password',
                endpointSSHKeyFile: null,
                endpointSSHKeyContent: editTunnelData.endpointSSHKey || '',
                endpointKeyPassword: editTunnelData.endpointKeyPassword || '',
                endpointKeyType: editTunnelData.endpointKeyType || '',
                maxRetries: editTunnelData.maxRetries || 3,
                retryInterval: editTunnelData.retryInterval || 5000,
                autoStart: editTunnelData.autoStart || false,
                isPinned: editTunnelData.isPinned || false
            });
        }
    }, [editTunnelData, editTunnelForm]);

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel className="text-lg font-bold text-white flex items-center gap-2">
                            Termix / Tunnel
                        </SidebarGroupLabel>
                        <Separator className="p-0.25 mt-1 mb-1" />
                        <SidebarGroupContent className="flex flex-col flex-grow">
                            <SidebarMenu>

                                {/* Sidebar Items */}
                                <SidebarMenuItem key={"Homepage"}>
                                    <Button className="w-full mt-2 mb-2 h-8" onClick={() => onSelectView("homepage")} variant="outline">
                                        <CornerDownLeft/>
                                        Return
                                    </Button>
                                    <Separator className="p-0.25 mt-1 mb-1" />
                                </SidebarMenuItem>

                                <SidebarMenuItem key="AddTunnel">
                                    <Sheet open={sheetOpen} onOpenChange={open => { if (!submitting) setSheetOpen(open); }}>
                                        <SheetTrigger asChild>
                                            <Button
                                                className="w-full mt-2 mb-2 h-8"
                                                variant="outline"
                                                onClick={() => setSheetOpen(true)}
                                                disabled={submitting}
                                            >
                                                <Plus />
                                                Add Tunnel
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent
                                            side="left"
                                            className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col"
                                        >
                                            <SheetHeader className="pb-0.5">
                                                <SheetTitle>Add SSH Tunnel</SheetTitle>
                                                <SheetDescription>
                                                    Create a new SSH tunnel connection.
                                                </SheetDescription>
                                            </SheetHeader>

                                            <div className="flex-1 overflow-y-auto px-4">
                                                {submitError && (
                                                    <div className="text-red-500 text-sm mb-2">{submitError}</div>
                                                )}
                                                <Form {...addTunnelForm}>
                                                    <form
                                                        id="add-tunnel-form"
                                                        onSubmit={addTunnelForm.handleSubmit(onAddTunnelSubmit)}
                                                        className="space-y-4"
                                                    >
                                                        {/* Tunnel Name */}
                                                        <div>
                                                            <h3 className="text-sm font-semibold mb-2">Tunnel Name</h3>
                                                            <FormField
                                                                control={addTunnelForm.control}
                                                                name="tunnelName"
                                                                render={({ field }) => (
                                                                    <FormItem>
                                                                        <FormControl>
                                                                            <Input placeholder="My SSH Tunnel" {...field} />
                                                                        </FormControl>
                                                                        <FormMessage />
                                                                    </FormItem>
                                                                )}
                                                            />
                                                        </div>

                                                        {/* Folder */}
                                                        <FormField
                                                            control={addTunnelForm.control}
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

                                                        {/* Tunnel Port Configuration */}
                                                        <div>
                                                            <h3 className="text-sm font-semibold mb-2">Tunnel Port Configuration</h3>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="sourcePort"
                                                                    render={({ field }) => (
                                                                        <FormItem className="flex-1">
                                                                            <FormLabel className="text-xs">Source Port (Local)</FormLabel>
                                                                            <FormControl>
                                                                                <Input 
                                                                                    type="number"
                                                                                    placeholder="22" 
                                                                                    {...field}
                                                                                    onChange={(e) => field.onChange(Number(e.target.value) || 22)}
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="endpointPort"
                                                                    render={({ field }) => (
                                                                        <FormItem className="flex-1">
                                                                            <FormLabel className="text-xs">Endpoint Port (Remote)</FormLabel>
                                                                            <FormControl>
                                                                                <Input 
                                                                                    type="number"
                                                                                    placeholder="224" 
                                                                                    {...field}
                                                                                    onChange={(e) => field.onChange(Number(e.target.value) || 224)}
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </div>
                                                            <p className="text-xs text-muted-foreground">
                                                                This tunnel will forward traffic from port {sourcePort} on the source machine to port {endpointPort} on the endpoint machine.
                                                            </p>
                                                        </div>

                                                        {/* SSH Pass Warning */}
                                                        <Alert className="mb-4">
                                                            <AlertTitle className="whitespace-normal break-words">Sshpass Required For Password Authentication</AlertTitle>
                                                            <AlertDescription>
                                                                For password-based SSH authentication, <code className="bg-muted px-1 rounded">sshpass</code> must be installed on both the local and remote servers.<br />
                                                                <span className="block mt-1">Install with: <code className="bg-muted px-1 rounded">sudo apt install sshpass</code> (Debian/Ubuntu) or the equivalent for your OS.</span>
                                                                <details className="mt-2">
                                                                    <summary className="cursor-pointer text-xs text-muted-foreground">Other installation methods</summary>
                                                                    <ul className="list-disc list-inside mt-1 text-xs">
                                                                        <li>CentOS/RHEL/Fedora: <code>sudo yum install sshpass</code> or <code>sudo dnf install sshpass</code></li>
                                                                        <li>macOS: <code>brew install hudochenkov/sshpass/sshpass</code></li>
                                                                        <li>Windows: Use WSL or consider SSH key authentication</li>
                                                                    </ul>
                                                                </details>
                                                            </AlertDescription>
                                                        </Alert>
                                                        {/* SSH Config Info */}
                                                        <Alert className="mb-4">
                                                            <AlertTitle className="whitespace-normal break-words">SSH Server Configuration Required</AlertTitle>
                                                            <AlertDescription>
                                                                For reverse SSH tunnels, the endpoint SSH server must allow:
                                                                <ul className="list-disc list-inside mt-1 space-y-1">
                                                                    <li><code className="bg-muted px-1 rounded">GatewayPorts yes</code> (bind remote ports)</li>
                                                                    <li><code className="bg-muted px-1 rounded">AllowTcpForwarding yes</code> (port forwarding)</li>
                                                                    <li><code className="bg-muted px-1 rounded">PermitRootLogin yes</code> (if using root)</li>
                                                                </ul>
                                                                <span className="block mt-2">Edit <code className="bg-muted px-1 rounded">/etc/ssh/sshd_config</code> and restart SSH: <code className="bg-muted px-1 rounded">sudo systemctl restart sshd</code></span>
                                                            </AlertDescription>
                                                        </Alert>

                                                        {/* Source SSH Configuration */}
                                                        <div>
                                                            <h3 className="text-sm font-semibold mb-2">Source SSH Configuration (Local Machine)</h3>
                                                            <Separator className="p-0.25 mt-1 mb-3" />
                                                            <div className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <FormField
                                                                        control={addTunnelForm.control}
                                                                        name="sourceIP"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs">Source IP</FormLabel>
                                                                                <FormControl>
                                                                                    <Input placeholder="localhost" {...field} />
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={addTunnelForm.control}
                                                                        name="sourceSSHPort"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs">Source SSH Port</FormLabel>
                                                                                <FormControl>
                                                                                    <Input 
                                                                                        type="number"
                                                                                        placeholder="22" 
                                                                                        {...field}
                                                                                        onChange={(e) => field.onChange(Number(e.target.value) || 22)}
                                                                                    />
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="sourceUsername"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Source Username</FormLabel>
                                                                            <FormControl>
                                                                                <Input placeholder="test" {...field} />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="sourceAuthMethod"
                                                                    render={({ field }) => (
                                                                        <Tabs value={field.value} onValueChange={field.onChange}>
                                                                            <TabsList className="grid w-full grid-cols-2 !mb-0">
                                                                                <TabsTrigger value="password">Password</TabsTrigger>
                                                                                <TabsTrigger value="key">SSH Key</TabsTrigger>
                                                                            </TabsList>

                                                                            <TabsContent value="password" className="mt-1">
                                                                                <FormField
                                                                                    control={addTunnelForm.control}
                                                                                    name="sourcePassword"
                                                                                    render={({ field }) => (
                                                                                        <FormItem>
                                                                                            <FormLabel className="text-xs">Source Password</FormLabel>
                                                                                            <FormControl>
                                                                                                <Input
                                                                                                    type="password"
                                                                                                    placeholder="password"
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
                                                                                    control={addTunnelForm.control}
                                                                                    name="sourceSSHKeyFile"
                                                                                    render={({ field }) => (
                                                                                        <FormItem>
                                                                                            <FormLabel className="text-xs">SSH Private Key</FormLabel>
                                                                                            <FormControl>
                                                                                                <div className="relative">
                                                                                                    <input
                                                                                                        id="source-file-upload"
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
                                                                                    control={addTunnelForm.control}
                                                                                    name="sourceKeyPassword"
                                                                                    render={({ field }) => (
                                                                                        <FormItem className="mt-3">
                                                                                            <FormLabel className="text-xs">Key Password (if protected)</FormLabel>
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
                                                                                    control={addTunnelForm.control}
                                                                                    name="sourceKeyType"
                                                                                    render={({ field }) => (
                                                                                        <FormItem className="mt-3 relative">
                                                                                            <FormLabel className="text-xs">Key Type</FormLabel>
                                                                                            <FormControl>
                                                                                                <div className="relative">
                                                                                                    <Button
                                                                                                        ref={sourceKeyTypeButtonRef}
                                                                                                        type="button"
                                                                                                        variant="outline"
                                                                                                        className="w-full justify-start text-left rounded-md px-2 py-2 bg-[#18181b] border border-input text-foreground"
                                                                                                        onClick={() => setEditSourceKeyTypeDropdownOpen((open) => !open)}
                                                                                                    >
                                                                                                        {keyTypeOptions.find(opt => opt.value === field.value)?.label || 'Auto-detect'}
                                                                                                    </Button>
                                                                                                    {editSourceKeyTypeDropdownOpen && (
                                                                                                        <div
                                                                                                            ref={sourceKeyTypeDropdownRef}
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
                                                                                                                            setEditSourceKeyTypeDropdownOpen(false);
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
                                                            </div>
                                                        </div>

                                                        {/* Endpoint SSH Configuration */}
                                                        <div>
                                                            <h3 className="text-sm font-semibold mb-2">Endpoint SSH Configuration (Remote Machine)</h3>
                                                            <Separator className="p-0.25 mt-1 mb-3" />
                                                            <div className="space-y-3">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <FormField
                                                                        control={addTunnelForm.control}
                                                                        name="endpointIP"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs">Endpoint IP</FormLabel>
                                                                                <FormControl>
                                                                                    <Input placeholder="test" {...field} />
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                    <FormField
                                                                        control={addTunnelForm.control}
                                                                        name="endpointSSHPort"
                                                                        render={({ field }) => (
                                                                            <FormItem>
                                                                                <FormLabel className="text-xs">Endpoint SSH Port</FormLabel>
                                                                                <FormControl>
                                                                                    <Input 
                                                                                        type="number"
                                                                                        placeholder="22" 
                                                                                        {...field}
                                                                                        onChange={(e) => field.onChange(Number(e.target.value) || 22)}
                                                                                    />
                                                                                </FormControl>
                                                                                <FormMessage />
                                                                            </FormItem>
                                                                        )}
                                                                    />
                                                                </div>
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="endpointUsername"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Endpoint Username</FormLabel>
                                                                            <FormControl>
                                                                                <Input placeholder="test" {...field} />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="endpointAuthMethod"
                                                                    render={({ field }) => (
                                                                        <Tabs value={field.value} onValueChange={field.onChange}>
                                                                            <TabsList className="grid w-full grid-cols-2 !mb-0">
                                                                                <TabsTrigger value="password">Password</TabsTrigger>
                                                                                <TabsTrigger value="key">SSH Key</TabsTrigger>
                                                                            </TabsList>

                                                                            <TabsContent value="password" className="mt-1">
                                                                                <FormField
                                                                                    control={addTunnelForm.control}
                                                                                    name="endpointPassword"
                                                                                    render={({ field }) => (
                                                                                        <FormItem>
                                                                                            <FormLabel className="text-xs">Endpoint Password</FormLabel>
                                                                                            <FormControl>
                                                                                                <Input
                                                                                                    type="password"
                                                                                                    placeholder="password"
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
                                                                                    control={addTunnelForm.control}
                                                                                    name="endpointSSHKeyFile"
                                                                                    render={({ field }) => (
                                                                                        <FormItem>
                                                                                            <FormLabel className="text-xs">SSH Private Key</FormLabel>
                                                                                            <FormControl>
                                                                                                <div className="relative">
                                                                                                    <input
                                                                                                        id="endpoint-file-upload"
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
                                                                                    control={addTunnelForm.control}
                                                                                    name="endpointKeyPassword"
                                                                                    render={({ field }) => (
                                                                                        <FormItem className="mt-3">
                                                                                            <FormLabel className="text-xs">Key Password (if protected)</FormLabel>
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
                                                                                    control={addTunnelForm.control}
                                                                                    name="endpointKeyType"
                                                                                    render={({ field }) => (
                                                                                        <FormItem className="mt-3 relative">
                                                                                            <FormLabel className="text-xs">Key Type</FormLabel>
                                                                                            <FormControl>
                                                                                                <div className="relative">
                                                                                                    <Button
                                                                                                        ref={endpointKeyTypeButtonRef}
                                                                                                        type="button"
                                                                                                        variant="outline"
                                                                                                        className="w-full justify-start text-left rounded-md px-2 py-2 bg-[#18181b] border border-input text-foreground"
                                                                                                        onClick={() => setEditEndpointKeyTypeDropdownOpen((open) => !open)}
                                                                                                    >
                                                                                                        {keyTypeOptions.find(opt => opt.value === field.value)?.label || 'Auto-detect'}
                                                                                                    </Button>
                                                                                                    {editEndpointKeyTypeDropdownOpen && (
                                                                                                        <div
                                                                                                            ref={endpointKeyTypeDropdownRef}
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
                                                                                                                            setEndpointKeyTypeDropdownOpen(false);
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
                                                            </div>
                                                        </div>

                                                        {/* Other */}
                                                        <div>
                                                            <h3 className="text-sm font-semibold mb-2">Other</h3>
                                                            <Separator className="p-0.25 mt-1 mb-3" />
                                                            <div className="space-y-3">
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="maxRetries"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Max Retries</FormLabel>
                                                                            <FormControl>
                                                                                <Input 
                                                                                    type="number"
                                                                                    placeholder="3" 
                                                                                    {...field}
                                                                                    onChange={(e) => field.onChange(Number(e.target.value) || 3)}
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="retryInterval"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormLabel className="text-xs">Retry Interval (ms)</FormLabel>
                                                                            <FormControl>
                                                                                <Input 
                                                                                    type="number"
                                                                                    placeholder="5000" 
                                                                                    {...field}
                                                                                    onChange={(e) => field.onChange(Number(e.target.value) || 5000)}
                                                                                />
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="autoStart"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormControl>
                                                                                <div className="flex flex-row items-center gap-2">
                                                                                    <Switch
                                                                                        checked={!!field.value}
                                                                                        onCheckedChange={field.onChange}
                                                                                    />
                                                                                    <FormLabel className="mb-0 text-xs">Auto Start on Container Launch</FormLabel>
                                                                                </div>
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                                <FormField
                                                                    control={addTunnelForm.control}
                                                                    name="isPinned"
                                                                    render={({ field }) => (
                                                                        <FormItem>
                                                                            <FormControl>
                                                                                <div className="flex flex-row items-center gap-2">
                                                                                    <Switch
                                                                                        checked={!!field.value}
                                                                                        onCheckedChange={field.onChange}
                                                                                    />
                                                                                    <FormLabel className="mb-0 text-xs">Pin Connection</FormLabel>
                                                                                </div>
                                                                            </FormControl>
                                                                            <FormMessage />
                                                                        </FormItem>
                                                                    )}
                                                                />
                                                            </div>
                                                        </div>
                                                    </form>
                                                </Form>
                                            </div>

                                            <Separator className="p-0.25 mt-2" />
                                            <SheetFooter className="px-4 pt-1 pb-4">
                                                <SheetClose asChild>
                                                    <Button type="submit" form="add-tunnel-form" disabled={submitting}>
                                                        {submitting ? 'Creating...' : 'Create Tunnel'}
                                                    </Button>
                                                </SheetClose>
                                                <SheetClose asChild>
                                                    <Button variant="outline" disabled={submitting}>Close</Button>
                                                </SheetClose>
                                            </SheetFooter>
                                        </SheetContent>
                                    </Sheet>
                                </SidebarMenuItem>

                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>

            {/* Edit Tunnel Sheet */}
            <Sheet open={editSheetOpen} onOpenChange={(open) => {
                if (!open) {
                    setTimeout(() => {
                        setEditTunnelData(null);
                        editTunnelForm.reset();
                    }, 100);
                }
                setEditSheetOpen(open);
            }}>
                <SheetContent side="left" className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col">
                    <SheetHeader className="pb-0.5">
                        <SheetTitle>Edit SSH Tunnel</SheetTitle>
                        <SheetDescription>
                            Modify the SSH tunnel configuration.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="flex-1 overflow-y-auto px-4">
                        {submitError && (
                            <div className="text-red-500 text-sm mb-2">{submitError}</div>
                        )}
                        <Form {...editTunnelForm}>
                            <form
                                id="edit-tunnel-form"
                                onSubmit={editTunnelForm.handleSubmit(onEditTunnelSubmit)}
                                className="space-y-4"
                            >
                                {/* Tunnel Name */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Tunnel Name</h3>
                                    <FormField
                                        control={editTunnelForm.control}
                                        name="tunnelName"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input placeholder="My SSH Tunnel" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                {/* Folder */}
                                <FormField
                                    control={editTunnelForm.control}
                                    name="folder"
                                    render={({ field }) => (
                                        <FormItem className="relative">
                                            <FormLabel>Folder</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="e.g. Work"
                                                    autoComplete="off"
                                                    value={field.value}
                                                    onFocus={() => setEditFolderDropdownOpen(true)}
                                                    onChange={e => {
                                                        field.onChange(e);
                                                        setEditFolderDropdownOpen(true);
                                                    }}
                                                    disabled={foldersLoading}
                                                />
                                            </FormControl>
                                            {/* Folder dropdown menu */}
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
                                                                    editTunnelForm.setValue('folder', folder);
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

                                {/* Tunnel Port Configuration */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Tunnel Port Configuration</h3>
                                    <div className="flex items-center gap-2 mb-2">
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="sourcePort"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel className="text-xs">Source Port (Local)</FormLabel>
                                                    <FormControl>
                                                        <Input 
                                                            type="number"
                                                            placeholder="22" 
                                                            {...field}
                                                            onChange={(e) => field.onChange(Number(e.target.value) || 22)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="endpointPort"
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormLabel className="text-xs">Endpoint Port (Remote)</FormLabel>
                                                    <FormControl>
                                                        <Input 
                                                            type="number"
                                                            placeholder="224" 
                                                            {...field}
                                                            onChange={(e) => field.onChange(Number(e.target.value) || 224)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        This tunnel will forward traffic from port {editTunnelForm.watch('sourcePort')} on the source machine to port {editTunnelForm.watch('endpointPort')} on the endpoint machine.
                                    </p>
                                </div>

                                {/* SSH Pass Warning */}
                                <Alert className="mb-4">
                                    <AlertTitle className="whitespace-normal break-words">Sshpass Required For Password Authentication</AlertTitle>
                                    <AlertDescription>
                                        For password-based SSH authentication, <code className="bg-muted px-1 rounded">sshpass</code> must be installed on both the local and remote servers.<br />
                                        <span className="block mt-1">Install with: <code className="bg-muted px-1 rounded">sudo apt install sshpass</code> (Debian/Ubuntu) or the equivalent for your OS.</span>
                                        <details className="mt-2">
                                            <summary className="cursor-pointer text-xs text-muted-foreground">Other installation methods</summary>
                                            <ul className="list-disc list-inside mt-1 text-xs">
                                                <li>CentOS/RHEL/Fedora: <code>sudo yum install sshpass</code> or <code>sudo dnf install sshpass</code></li>
                                                <li>macOS: <code>brew install hudochenkov/sshpass/sshpass</code></li>
                                                <li>Windows: Use WSL or consider SSH key authentication</li>
                                            </ul>
                                        </details>
                                    </AlertDescription>
                                </Alert>
                                {/* SSH Config Info */}
                                <Alert className="mb-4">
                                    <AlertTitle className="whitespace-normal break-words">SSH Server Configuration Required</AlertTitle>
                                    <AlertDescription>
                                        For reverse SSH tunnels, the endpoint SSH server must allow:
                                        <ul className="list-disc list-inside mt-1 space-y-1">
                                            <li><code className="bg-muted px-1 rounded">GatewayPorts yes</code> (bind remote ports)</li>
                                            <li><code className="bg-muted px-1 rounded">AllowTcpForwarding yes</code> (port forwarding)</li>
                                            <li><code className="bg-muted px-1 rounded">PermitRootLogin yes</code> (if using root)</li>
                                        </ul>
                                        <span className="block mt-2">Edit <code className="bg-muted px-1 rounded">/etc/ssh/sshd_config</code> and restart SSH: <code className="bg-muted px-1 rounded">sudo systemctl restart sshd</code></span>
                                    </AlertDescription>
                                </Alert>

                                {/* Source SSH Configuration */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Source SSH Configuration (Local Machine)</h3>
                                    <Separator className="p-0.25 mt-1 mb-3" />
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <FormField
                                                control={editTunnelForm.control}
                                                name="sourceIP"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Source IP</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="localhost" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editTunnelForm.control}
                                                name="sourceSSHPort"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Source SSH Port</FormLabel>
                                                        <FormControl>
                                                            <Input 
                                                                type="number"
                                                                placeholder="22" 
                                                                {...field}
                                                                onChange={(e) => field.onChange(Number(e.target.value) || 22)}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="sourceUsername"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Source Username</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="test" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="sourceAuthMethod"
                                            render={({ field }) => (
                                                <Tabs value={field.value} onValueChange={field.onChange}>
                                                    <TabsList className="grid w-full grid-cols-2 !mb-0">
                                                        <TabsTrigger value="password">Password</TabsTrigger>
                                                        <TabsTrigger value="key">SSH Key</TabsTrigger>
                                                    </TabsList>

                                                    <TabsContent value="password" className="mt-1">
                                                        <FormField
                                                            control={editTunnelForm.control}
                                                            name="sourcePassword"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">Source Password</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="password"
                                                                            placeholder="password"
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
                                                            control={editTunnelForm.control}
                                                            name="sourceSSHKeyFile"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">SSH Private Key</FormLabel>
                                                                    <FormControl>
                                                                        <div className="relative">
                                                                            <input
                                                                                id="edit-source-file-upload"
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
                                                            control={editTunnelForm.control}
                                                            name="sourceKeyPassword"
                                                            render={({ field }) => (
                                                                <FormItem className="mt-3">
                                                                    <FormLabel className="text-xs">Key Password (if protected)</FormLabel>
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
                                                            control={editTunnelForm.control}
                                                            name="sourceKeyType"
                                                            render={({ field }) => (
                                                                <FormItem className="mt-3 relative">
                                                                    <FormLabel className="text-xs">Key Type</FormLabel>
                                                                    <FormControl>
                                                                        <div className="relative">
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                className="w-full justify-start text-left rounded-md px-2 py-2 bg-[#18181b] border border-input text-foreground"
                                                                                onClick={() => setSourceKeyTypeDropdownOpen((open) => !open)}
                                                                            >
                                                                                {keyTypeOptions.find(opt => opt.value === field.value)?.label || 'Auto-detect'}
                                                                            </Button>
                                                                            {sourceKeyTypeDropdownOpen && (
                                                                                <div
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
                                                                                                    setSourceKeyTypeDropdownOpen(false);
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
                                    </div>
                                </div>

                                {/* Endpoint SSH Configuration */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Endpoint SSH Configuration (Remote Machine)</h3>
                                    <Separator className="p-0.25 mt-1 mb-3" />
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2">
                                            <FormField
                                                control={editTunnelForm.control}
                                                name="endpointIP"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Endpoint IP</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="test" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={editTunnelForm.control}
                                                name="endpointSSHPort"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Endpoint SSH Port</FormLabel>
                                                        <FormControl>
                                                            <Input 
                                                                type="number"
                                                                placeholder="22" 
                                                                {...field}
                                                                onChange={(e) => field.onChange(Number(e.target.value) || 22)}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="endpointUsername"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Endpoint Username</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="test" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="endpointAuthMethod"
                                            render={({ field }) => (
                                                <Tabs value={field.value} onValueChange={field.onChange}>
                                                    <TabsList className="grid w-full grid-cols-2 !mb-0">
                                                        <TabsTrigger value="password">Password</TabsTrigger>
                                                        <TabsTrigger value="key">SSH Key</TabsTrigger>
                                                    </TabsList>

                                                    <TabsContent value="password" className="mt-1">
                                                        <FormField
                                                            control={editTunnelForm.control}
                                                            name="endpointPassword"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">Endpoint Password</FormLabel>
                                                                    <FormControl>
                                                                        <Input
                                                                            type="password"
                                                                            placeholder="password"
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
                                                            control={editTunnelForm.control}
                                                            name="endpointSSHKeyFile"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel className="text-xs">SSH Private Key</FormLabel>
                                                                    <FormControl>
                                                                        <div className="relative">
                                                                            <input
                                                                                id="edit-endpoint-file-upload"
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
                                                            control={editTunnelForm.control}
                                                            name="endpointKeyPassword"
                                                            render={({ field }) => (
                                                                <FormItem className="mt-3">
                                                                    <FormLabel className="text-xs">Key Password (if protected)</FormLabel>
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
                                                            control={editTunnelForm.control}
                                                            name="endpointKeyType"
                                                            render={({ field }) => (
                                                                <FormItem className="mt-3 relative">
                                                                    <FormLabel className="text-xs">Key Type</FormLabel>
                                                                    <FormControl>
                                                                        <div className="relative">
                                                                            <Button
                                                                                type="button"
                                                                                variant="outline"
                                                                                className="w-full justify-start text-left rounded-md px-2 py-2 bg-[#18181b] border border-input text-foreground"
                                                                                onClick={() => setEditEndpointKeyTypeDropdownOpen((open) => !open)}
                                                                            >
                                                                                {keyTypeOptions.find(opt => opt.value === field.value)?.label || 'Auto-detect'}
                                                                            </Button>
                                                                            {editEndpointKeyTypeDropdownOpen && (
                                                                                <div
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
                                                                                                    setEditEndpointKeyTypeDropdownOpen(false);
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
                                    </div>
                                </div>

                                {/* Advanced Options */}
                                <div>
                                    <h3 className="text-sm font-semibold mb-2">Advanced Options</h3>
                                    <Separator className="p-0.25 mt-1 mb-3" />
                                    <div className="space-y-3">
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="maxRetries"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Max Retries</FormLabel>
                                                    <FormControl>
                                                        <Input 
                                                            type="number"
                                                            placeholder="3" 
                                                            {...field}
                                                            onChange={(e) => field.onChange(Number(e.target.value) || 3)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="retryInterval"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Retry Interval (ms)</FormLabel>
                                                    <FormControl>
                                                        <Input 
                                                            type="number"
                                                            placeholder="5000" 
                                                            {...field}
                                                            onChange={(e) => field.onChange(Number(e.target.value) || 5000)}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="autoStart"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <div className="flex flex-row items-center gap-2">
                                                            <Switch
                                                                checked={!!field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                            <FormLabel className="mb-0 text-xs">Auto Start on Container Launch</FormLabel>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={editTunnelForm.control}
                                            name="isPinned"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormControl>
                                                        <div className="flex flex-row items-center gap-2">
                                                            <Switch
                                                                checked={!!field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                            <FormLabel className="mb-0 text-xs">Pin Connection</FormLabel>
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </div>
                            </form>
                        </Form>
                    </div>
                    <Separator className="p-0.25 mt-2" />
                    <SheetFooter className="px-4 pt-1 pb-4">
                        <SheetClose asChild>
                            <Button type="submit" form="edit-tunnel-form" disabled={submitting}>
                                {submitting ? 'Updating...' : 'Update Tunnel'}
                            </Button>
                        </SheetClose>
                        <SheetClose asChild>
                            <Button variant="outline" disabled={submitting}>Close</Button>
                        </SheetClose>
                    </SheetFooter>
                </SheetContent>
            </Sheet>
        </SidebarProvider>
    );
});