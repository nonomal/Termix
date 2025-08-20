import {zodResolver} from "@hookform/resolvers/zod"
import {Controller, useForm} from "react-hook-form"
import {z} from "zod"

import {Button} from "@/components/ui/button.tsx"
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form.tsx";
import {Input} from "@/components/ui/input.tsx";
import {ScrollArea} from "@/components/ui/scroll-area.tsx"
import {Separator} from "@/components/ui/separator.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import React, {useEffect, useRef, useState} from "react";
import {Switch} from "@/components/ui/switch.tsx";
import {Alert, AlertDescription} from "@/components/ui/alert.tsx";
import {createSSHHost, updateSSHHost, getSSHHosts} from '@/ui/main-axios.ts';

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

interface SSHManagerHostEditorProps {
    editingHost?: SSHHost | null;
    onFormSubmit?: () => void;
}

export function HostManagerHostEditor({editingHost, onFormSubmit}: SSHManagerHostEditorProps) {
    const [hosts, setHosts] = useState<SSHHost[]>([]);
    const [folders, setFolders] = useState<string[]>([]);
    const [sshConfigurations, setSshConfigurations] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const [authTab, setAuthTab] = useState<'password' | 'key'>('password');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const hostsData = await getSSHHosts();
                setHosts(hostsData);

                const uniqueFolders = [...new Set(
                    hostsData
                        .filter(host => host.folder && host.folder.trim() !== '')
                        .map(host => host.folder)
                )].sort();

                const uniqueConfigurations = [...new Set(
                    hostsData
                        .filter(host => host.name && host.name.trim() !== '')
                        .map(host => host.name)
                )].sort();

                setFolders(uniqueFolders);
                setSshConfigurations(uniqueConfigurations);
            } catch (error) {
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const formSchema = z.object({
        name: z.string().optional(),
        ip: z.string().min(1),
        port: z.coerce.number().min(1).max(65535),
        username: z.string().min(1),
        folder: z.string().optional(),
        tags: z.array(z.string().min(1)).default([]),
        pin: z.boolean().default(false),
        authType: z.enum(['password', 'key']),
        password: z.string().optional(),
        key: z.instanceof(File).optional().nullable(),
        keyPassword: z.string().optional(),
        keyType: z.enum([
            'auto',
            'ssh-rsa',
            'ssh-ed25519',
            'ecdsa-sha2-nistp256',
            'ecdsa-sha2-nistp384',
            'ecdsa-sha2-nistp521',
            'ssh-dss',
            'ssh-rsa-sha2-256',
            'ssh-rsa-sha2-512',
        ]).optional(),
        enableTerminal: z.boolean().default(true),
        enableTunnel: z.boolean().default(true),
        tunnelConnections: z.array(z.object({
            sourcePort: z.coerce.number().min(1).max(65535),
            endpointPort: z.coerce.number().min(1).max(65535),
            endpointHost: z.string().min(1),
            maxRetries: z.coerce.number().min(0).max(100).default(3),
            retryInterval: z.coerce.number().min(1).max(3600).default(10),
            autoStart: z.boolean().default(false),
        })).default([]),
        enableFileManager: z.boolean().default(true),
        defaultPath: z.string().optional(),
    }).superRefine((data, ctx) => {
        if (data.authType === 'password') {
            if (!data.password || data.password.trim() === '') {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Password is required when using password authentication",
                    path: ['password']
                });
            }
        } else if (data.authType === 'key') {
            if (!data.key) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "SSH Private Key is required when using key authentication",
                    path: ['key']
                });
            }
            if (!data.keyType) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Key Type is required when using key authentication",
                    path: ['keyType']
                });
            }
        }

        data.tunnelConnections.forEach((connection, index) => {
            if (connection.endpointHost && !sshConfigurations.includes(connection.endpointHost)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Must select a valid SSH configuration from the list",
                    path: ['tunnelConnections', index, 'endpointHost']
                });
            }
        });
    });

    type FormData = z.infer<typeof formSchema>;

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            name: editingHost?.name || "",
            ip: editingHost?.ip || "",
            port: editingHost?.port || 22,
            username: editingHost?.username || "",
            folder: editingHost?.folder || "",
            tags: editingHost?.tags || [],
            pin: editingHost?.pin || false,
            authType: (editingHost?.authType as 'password' | 'key') || "password",
            password: "",
            key: null,
            keyPassword: "",
            keyType: "auto",
            enableTerminal: editingHost?.enableTerminal !== false,
            enableTunnel: editingHost?.enableTunnel !== false,
            enableFileManager: editingHost?.enableFileManager !== false,
            defaultPath: editingHost?.defaultPath || "/",
            tunnelConnections: editingHost?.tunnelConnections || [],
        }
    });

    useEffect(() => {
        if (editingHost) {
            const defaultAuthType = editingHost.key ? 'key' : 'password';

            setAuthTab(defaultAuthType);

            form.reset({
                name: editingHost.name || "",
                ip: editingHost.ip || "",
                port: editingHost.port || 22,
                username: editingHost.username || "",
                folder: editingHost.folder || "",
                tags: editingHost.tags || [],
                pin: editingHost.pin || false,
                authType: defaultAuthType,
                password: editingHost.password || "",
                key: editingHost.key ? new File([editingHost.key], "key.pem") : null,
                keyPassword: editingHost.keyPassword || "",
                keyType: (editingHost.keyType as any) || "auto",
                enableTerminal: editingHost.enableTerminal !== false,
                enableTunnel: editingHost.enableTunnel !== false,
                enableFileManager: editingHost.enableFileManager !== false,
                defaultPath: editingHost.defaultPath || "/",
                tunnelConnections: editingHost.tunnelConnections || [],
            });
        } else {
            setAuthTab('password');

            form.reset({
                name: "",
                ip: "",
                port: 22,
                username: "",
                folder: "",
                tags: [],
                pin: false,
                authType: "password",
                password: "",
                key: null,
                keyPassword: "",
                keyType: "auto",
                enableTerminal: true,
                enableTunnel: true,
                enableFileManager: true,
                defaultPath: "/",
                tunnelConnections: [],
            });
        }
    }, [editingHost, form]);

    const onSubmit = async (data: any) => {
        try {
            const formData = data as FormData;

            if (!formData.name || formData.name.trim() === '') {
                formData.name = `${formData.username}@${formData.ip}`;
            }

            if (editingHost) {
                await updateSSHHost(editingHost.id, formData);
            } else {
                await createSSHHost(formData);
            }

            if (onFormSubmit) {
                onFormSubmit();
            }

            window.dispatchEvent(new CustomEvent('ssh-hosts:changed'));
        } catch (error) {
            alert('Failed to save host. Please try again.');
        }
    };

    const [tagInput, setTagInput] = useState("");

    const [folderDropdownOpen, setFolderDropdownOpen] = useState(false);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const folderDropdownRef = useRef<HTMLDivElement>(null);

    const folderValue = form.watch('folder');
    const filteredFolders = React.useMemo(() => {
        if (!folderValue) return folders;
        return folders.filter(f => f.toLowerCase().includes(folderValue.toLowerCase()));
    }, [folderValue, folders]);

    const handleFolderClick = (folder: string) => {
        form.setValue('folder', folder);
        setFolderDropdownOpen(false);
    };

    useEffect(() => {
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

    const [keyTypeDropdownOpen, setKeyTypeDropdownOpen] = useState(false);
    const keyTypeButtonRef = useRef<HTMLButtonElement>(null);
    const keyTypeDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onClickOutside(event: MouseEvent) {
            if (
                keyTypeDropdownOpen &&
                keyTypeDropdownRef.current &&
                !keyTypeDropdownRef.current.contains(event.target as Node) &&
                keyTypeButtonRef.current &&
                !keyTypeButtonRef.current.contains(event.target as Node)
            ) {
                setKeyTypeDropdownOpen(false);
            }
        }

        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, [keyTypeDropdownOpen]);

    const [sshConfigDropdownOpen, setSshConfigDropdownOpen] = useState<{ [key: number]: boolean }>({});
    const sshConfigInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
    const sshConfigDropdownRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

    const getFilteredSshConfigs = (index: number) => {
        const value = form.watch(`tunnelConnections.${index}.endpointHost`);

        const currentHostName = form.watch('name') || `${form.watch('username')}@${form.watch('ip')}`;

        let filtered = sshConfigurations.filter(config => config !== currentHostName);

        if (value) {
            filtered = filtered.filter(config =>
                config.toLowerCase().includes(value.toLowerCase())
            );
        }

        return filtered;
    };

    const handleSshConfigClick = (config: string, index: number) => {
        form.setValue(`tunnelConnections.${index}.endpointHost`, config);
        setSshConfigDropdownOpen(prev => ({...prev, [index]: false}));
    };

    useEffect(() => {
        function handleSshConfigClickOutside(event: MouseEvent) {
            const openDropdowns = Object.keys(sshConfigDropdownOpen).filter(key => sshConfigDropdownOpen[parseInt(key)]);

            openDropdowns.forEach((indexStr: string) => {
                const index = parseInt(indexStr);
                if (
                    sshConfigDropdownRefs.current[index] &&
                    !sshConfigDropdownRefs.current[index]?.contains(event.target as Node) &&
                    sshConfigInputRefs.current[index] &&
                    !sshConfigInputRefs.current[index]?.contains(event.target as Node)
                ) {
                    setSshConfigDropdownOpen(prev => ({...prev, [index]: false}));
                }
            });
        }

        const hasOpenDropdowns = Object.values(sshConfigDropdownOpen).some(open => open);

        if (hasOpenDropdowns) {
            document.addEventListener('mousedown', handleSshConfigClickOutside);
        } else {
            document.removeEventListener('mousedown', handleSshConfigClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleSshConfigClickOutside);
        };
    }, [sshConfigDropdownOpen]);

    return (
        <div className="flex-1 flex flex-col h-full min-h-0 w-full">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 h-full">
                    <ScrollArea className="flex-1 min-h-0 w-full my-1 pb-2">
                        <Tabs defaultValue="general" className="w-full">
                            <TabsList>
                                <TabsTrigger value="general">General</TabsTrigger>
                                <TabsTrigger value="terminal">Terminal</TabsTrigger>
                                <TabsTrigger value="tunnel">Tunnel</TabsTrigger>
                                <TabsTrigger value="file_manager">File Manager</TabsTrigger>
                            </TabsList>
                            <TabsContent value="general" className="pt-2">
                                <FormLabel className="mb-3 font-bold">Connection Details</FormLabel>
                                <div className="grid grid-cols-12 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="ip"
                                        render={({field}) => (
                                            <FormItem className="col-span-5">
                                                <FormLabel>IP</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="127.0.0.1" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="port"
                                        render={({field}) => (
                                            <FormItem className="col-span-1">
                                                <FormLabel>Port</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="22" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="username"
                                        render={({field}) => (
                                            <FormItem className="col-span-6">
                                                <FormLabel>Username</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="username" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormLabel className="mb-3 mt-3 font-bold">Organization</FormLabel>
                                <div className="grid grid-cols-26 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({field}) => (
                                            <FormItem className="col-span-10">
                                                <FormLabel>Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="host name" {...field} />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="folder"
                                        render={({field}) => (
                                            <FormItem className="col-span-10 relative">
                                                <FormLabel>Folder</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        ref={folderInputRef}
                                                        placeholder="folder"
                                                        className="min-h-[40px]"
                                                        autoComplete="off"
                                                        value={field.value}
                                                        onFocus={() => setFolderDropdownOpen(true)}
                                                        onChange={e => {
                                                            field.onChange(e);
                                                            setFolderDropdownOpen(true);
                                                        }}
                                                    />
                                                </FormControl>
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
                                                                >
                                                                    {folder}
                                                                </Button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="tags"
                                        render={({field}) => (
                                            <FormItem className="col-span-10 overflow-visible">
                                                <FormLabel>Tags</FormLabel>
                                                <FormControl>
                                                    <div
                                                        className="flex flex-wrap items-center gap-1 border border-input rounded-md px-3 py-2 bg-[#222225] focus-within:ring-2 ring-ring min-h-[40px]">
                                                        {field.value.map((tag: string, idx: number) => (
                                                            <span key={tag + idx}
                                                                  className="flex items-center bg-gray-200 text-gray-800 rounded-full px-2 py-0.5 text-xs">
                                                                {tag}
                                                                <button
                                                                    type="button"
                                                                    className="ml-1 text-gray-500 hover:text-red-500 focus:outline-none"
                                                                    onClick={() => {
                                                                        const newTags = field.value.filter((_: string, i: number) => i !== idx);
                                                                        field.onChange(newTags);
                                                                    }}
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                        <input
                                                            type="text"
                                                            className="flex-1 min-w-[60px] border-none outline-none bg-transparent p-0 h-6"
                                                            value={tagInput}
                                                            onChange={e => setTagInput(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === " " && tagInput.trim() !== "") {
                                                                    e.preventDefault();
                                                                    if (!field.value.includes(tagInput.trim())) {
                                                                        field.onChange([...field.value, tagInput.trim()]);
                                                                    }
                                                                    setTagInput("");
                                                                } else if (e.key === "Backspace" && tagInput === "" && field.value.length > 0) {
                                                                    field.onChange(field.value.slice(0, -1));
                                                                }
                                                            }}
                                                            placeholder="add tags (space to add)"
                                                        />
                                                    </div>
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="pin"
                                        render={({field}) => (
                                            <FormItem className="col-span-6">
                                                <FormLabel>Pin Connection</FormLabel>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <FormLabel className="mb-3 mt-3 font-bold">Authentication</FormLabel>
                                <Tabs
                                    value={authTab}
                                    onValueChange={(value) => {
                                        setAuthTab(value as 'password' | 'key');
                                        form.setValue('authType', value as 'password' | 'key');
                                    }}
                                    className="flex-1 flex flex-col h-full min-h-0"
                                >
                                    <TabsList>
                                        <TabsTrigger value="password">Password</TabsTrigger>
                                        <TabsTrigger value="key">Key</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="password">
                                        <FormField
                                            control={form.control}
                                            name="password"
                                            render={({field}) => (
                                                <FormItem>
                                                    <FormLabel>Password</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="password" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </TabsContent>
                                    <TabsContent value="key">
                                        <div className="grid grid-cols-15 gap-4">
                                            <Controller
                                                control={form.control}
                                                name="key"
                                                render={({field}) => (
                                                    <FormItem className="col-span-4 overflow-hidden min-w-0">
                                                        <FormLabel>SSH Private Key</FormLabel>
                                                        <FormControl>
                                                            <div className="relative min-w-0">
                                                                <input
                                                                    id="key-upload"
                                                                    type="file"
                                                                    accept=".pem,.key,.txt,.ppk"
                                                                    onChange={(e) => {
                                                                        const file = e.target.files?.[0];
                                                                        field.onChange(file || null);
                                                                    }}
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                />
                                                                <Button
                                                                    type="button"
                                                                    variant="outline"
                                                                    className="w-full min-w-0 overflow-hidden px-3 py-2 text-left"
                                                                >
                                                                    <span className="block w-full truncate"
                                                                          title={field.value?.name || 'Upload'}>
                                                                        {field.value ? (editingHost ? 'Update Key' : field.value.name) : 'Upload'}
                                                                    </span>
                                                                </Button>
                                                            </div>
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="keyPassword"
                                                render={({field}) => (
                                                    <FormItem className="col-span-8">
                                                        <FormLabel>Key Password</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                placeholder="key password"
                                                                type="password"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="keyType"
                                                render={({field}) => (
                                                    <FormItem className="relative col-span-3">
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
                                                                    {keyTypeOptions.find((opt) => opt.value === field.value)?.label || "Auto-detect"}
                                                                </Button>
                                                                {keyTypeDropdownOpen && (
                                                                    <div
                                                                        ref={keyTypeDropdownRef}
                                                                        className="absolute bottom-full left-0 z-50 mb-1 w-full bg-[#18181b] border border-input rounded-md shadow-lg max-h-40 overflow-y-auto p-1"
                                                                    >
                                                                        <div className="grid grid-cols-1 gap-1 p-0">
                                                                            {keyTypeOptions.map((opt) => (
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
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </TabsContent>
                            <TabsContent value="terminal">
                                <FormField
                                    control={form.control}
                                    name="enableTerminal"
                                    render={({field}) => (
                                        <FormItem>
                                            <FormLabel>Enable Terminal</FormLabel>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Enable/disable host visibility in Terminal tab.
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </TabsContent>
                            <TabsContent value="tunnel">
                                <FormField
                                    control={form.control}
                                    name="enableTunnel"
                                    render={({field}) => (
                                        <FormItem>
                                            <FormLabel>Enable Tunnel</FormLabel>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Enable/disable host visibility in Tunnel tab.
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />

                                {form.watch('enableTunnel') && (
                                    <>
                                        <Alert className="mt-4">
                                            <AlertDescription>
                                                <strong>Sshpass Required For Password Authentication</strong>
                                                <div>
                                                    For password-based SSH authentication, sshpass must be installed on
                                                    both the local and remote servers. Install with: <code
                                                    className="bg-muted px-1 rounded inline">sudo apt install
                                                    sshpass</code> (Debian/Ubuntu) or the equivalent for your OS.
                                                </div>
                                                <div className="mt-2">
                                                    <strong>Other installation methods:</strong>
                                                    <div>• CentOS/RHEL/Fedora: <code
                                                        className="bg-muted px-1 rounded inline">sudo yum install
                                                        sshpass</code> or <code
                                                        className="bg-muted px-1 rounded inline">sudo dnf install
                                                        sshpass</code></div>
                                                    <div>• macOS: <code className="bg-muted px-1 rounded inline">brew
                                                        install hudochenkov/sshpass/sshpass</code></div>
                                                    <div>• Windows: Use WSL or consider SSH key authentication</div>
                                                </div>
                                            </AlertDescription>
                                        </Alert>

                                        <Alert className="mt-4">
                                            <AlertDescription>
                                                <strong>SSH Server Configuration Required</strong>
                                                <div>For reverse SSH tunnels, the endpoint SSH server must allow:</div>
                                                <div>• <code className="bg-muted px-1 rounded inline">GatewayPorts
                                                    yes</code> (bind remote ports)
                                                </div>
                                                <div>• <code className="bg-muted px-1 rounded inline">AllowTcpForwarding
                                                    yes</code> (port forwarding)
                                                </div>
                                                <div>• <code className="bg-muted px-1 rounded inline">PermitRootLogin
                                                    yes</code> (if using root)
                                                </div>
                                                <div className="mt-2">Edit <code
                                                    className="bg-muted px-1 rounded inline">/etc/ssh/sshd_config</code> and
                                                    restart SSH: <code className="bg-muted px-1 rounded inline">sudo
                                                        systemctl restart sshd</code></div>
                                            </AlertDescription>
                                        </Alert>

                                        <FormField
                                            control={form.control}
                                            name="tunnelConnections"
                                            render={({field}) => (
                                                <FormItem className="mt-4">
                                                    <FormLabel>Tunnel Connections</FormLabel>
                                                    <FormControl>
                                                        <div className="space-y-4">
                                                            {field.value.map((connection, index) => (
                                                                <div key={index}
                                                                     className="p-4 border rounded-lg bg-muted/50">
                                                                    <div
                                                                        className="flex items-center justify-between mb-3">
                                                                        <h4 className="text-sm font-bold">Connection {index + 1}</h4>
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                const newConnections = field.value.filter((_, i) => i !== index);
                                                                                field.onChange(newConnections);
                                                                            }}
                                                                        >
                                                                            Remove
                                                                        </Button>
                                                                    </div>
                                                                    <div className="grid grid-cols-12 gap-4">
                                                                        <FormField
                                                                            control={form.control}
                                                                            name={`tunnelConnections.${index}.sourcePort`}
                                                                            render={({field: sourcePortField}) => (
                                                                                <FormItem className="col-span-4">
                                                                                    <FormLabel>Source Port
                                                                                        (Source refers to the Current
                                                                                        Connection Details in the
                                                                                        General tab)</FormLabel>
                                                                                    <FormControl>
                                                                                        <Input
                                                                                            placeholder="22" {...sourcePortField} />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={form.control}
                                                                            name={`tunnelConnections.${index}.endpointPort`}
                                                                            render={({field: endpointPortField}) => (
                                                                                <FormItem className="col-span-4">
                                                                                    <FormLabel>Endpoint Port
                                                                                        (Remote)</FormLabel>
                                                                                    <FormControl>
                                                                                        <Input
                                                                                            placeholder="224" {...endpointPortField} />
                                                                                    </FormControl>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={form.control}
                                                                            name={`tunnelConnections.${index}.endpointHost`}
                                                                            render={({field: endpointHostField}) => (
                                                                                <FormItem
                                                                                    className="col-span-4 relative">
                                                                                    <FormLabel>Endpoint SSH
                                                                                        Configuration</FormLabel>
                                                                                    <FormControl>
                                                                                        <Input
                                                                                            ref={(el) => {
                                                                                                sshConfigInputRefs.current[index] = el;
                                                                                            }}
                                                                                            placeholder="endpoint ssh configuration"
                                                                                            className="min-h-[40px]"
                                                                                            autoComplete="off"
                                                                                            value={endpointHostField.value}
                                                                                            onFocus={() => setSshConfigDropdownOpen(prev => ({
                                                                                                ...prev,
                                                                                                [index]: true
                                                                                            }))}
                                                                                            onChange={e => {
                                                                                                endpointHostField.onChange(e);
                                                                                                setSshConfigDropdownOpen(prev => ({
                                                                                                    ...prev,
                                                                                                    [index]: true
                                                                                                }));
                                                                                            }}
                                                                                        />
                                                                                    </FormControl>
                                                                                    {sshConfigDropdownOpen[index] && getFilteredSshConfigs(index).length > 0 && (
                                                                                        <div
                                                                                            ref={(el) => {
                                                                                                sshConfigDropdownRefs.current[index] = el;
                                                                                            }}
                                                                                            className="absolute top-full left-0 z-50 mt-1 w-full bg-[#18181b] border border-input rounded-md shadow-lg max-h-40 overflow-y-auto p-1"
                                                                                        >
                                                                                            <div
                                                                                                className="grid grid-cols-1 gap-1 p-0">
                                                                                                {getFilteredSshConfigs(index).map((config) => (
                                                                                                    <Button
                                                                                                        key={config}
                                                                                                        type="button"
                                                                                                        variant="ghost"
                                                                                                        size="sm"
                                                                                                        className="w-full justify-start text-left rounded px-2 py-1.5 hover:bg-white/15 focus:bg-white/20 focus:outline-none"
                                                                                                        onClick={() => handleSshConfigClick(config, index)}
                                                                                                    >
                                                                                                        {config}
                                                                                                    </Button>
                                                                                                ))}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                    </div>

                                                                    <p className="text-sm text-muted-foreground mt-2">
                                                                        This tunnel will forward traffic from
                                                                        port {form.watch(`tunnelConnections.${index}.sourcePort`) || '22'} on
                                                                        the source machine (current connection details
                                                                        in general tab) to
                                                                        port {form.watch(`tunnelConnections.${index}.endpointPort`) || '224'} on
                                                                        the endpoint machine.
                                                                    </p>

                                                                    <div className="grid grid-cols-12 gap-4 mt-4">
                                                                        <FormField
                                                                            control={form.control}
                                                                            name={`tunnelConnections.${index}.maxRetries`}
                                                                            render={({field: maxRetriesField}) => (
                                                                                <FormItem className="col-span-4">
                                                                                    <FormLabel>Max Retries</FormLabel>
                                                                                    <FormControl>
                                                                                        <Input
                                                                                            placeholder="3" {...maxRetriesField} />
                                                                                    </FormControl>
                                                                                    <FormDescription>
                                                                                        Maximum number of retry attempts
                                                                                        for tunnel connection.
                                                                                    </FormDescription>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={form.control}
                                                                            name={`tunnelConnections.${index}.retryInterval`}
                                                                            render={({field: retryIntervalField}) => (
                                                                                <FormItem className="col-span-4">
                                                                                    <FormLabel>Retry Interval
                                                                                        (seconds)</FormLabel>
                                                                                    <FormControl>
                                                                                        <Input
                                                                                            placeholder="10" {...retryIntervalField} />
                                                                                    </FormControl>
                                                                                    <FormDescription>
                                                                                        Time to wait between retry
                                                                                        attempts.
                                                                                    </FormDescription>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                        <FormField
                                                                            control={form.control}
                                                                            name={`tunnelConnections.${index}.autoStart`}
                                                                            render={({field}) => (
                                                                                <FormItem className="col-span-4">
                                                                                    <FormLabel>Auto Start on Container
                                                                                        Launch</FormLabel>
                                                                                    <FormControl>
                                                                                        <Switch
                                                                                            checked={field.value}
                                                                                            onCheckedChange={field.onChange}
                                                                                        />
                                                                                    </FormControl>
                                                                                    <FormDescription>
                                                                                        Automatically start this tunnel
                                                                                        when the container launches.
                                                                                    </FormDescription>
                                                                                </FormItem>
                                                                            )}
                                                                        />
                                                                    </div>
                                                                </div>
                                                            ))}
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                onClick={() => {
                                                                    field.onChange([...field.value, {
                                                                        sourcePort: 22,
                                                                        endpointPort: 224,
                                                                        endpointHost: "",
                                                                        maxRetries: 3,
                                                                        retryInterval: 10,
                                                                        autoStart: false,
                                                                    }]);
                                                                }}
                                                            >
                                                                Add Tunnel Connection
                                                            </Button>
                                                        </div>
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />


                                    </>
                                )}
                            </TabsContent>
                            <TabsContent value="file_manager">
                                <FormField
                                    control={form.control}
                                    name="enableFileManager"
                                    render={({field}) => (
                                        <FormItem>
                                            <FormLabel>Enable File Manager</FormLabel>
                                            <FormControl>
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={field.onChange}
                                                />
                                            </FormControl>
                                            <FormDescription>
                                                Enable/disable host visibility in File Manager tab.
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />

                                {form.watch('enableFileManager') && (
                                    <div className="mt-4">
                                        <FormField
                                            control={form.control}
                                            name="defaultPath"
                                            render={({field}) => (
                                                <FormItem>
                                                    <FormLabel>Default Path</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="/home" {...field} />
                                                    </FormControl>
                                                    <FormDescription>Set default directory shown when connected via
                                                        File Manager</FormDescription>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    </ScrollArea>
                    <footer className="shrink-0 w-full pb-0">
                        <Separator className="p-0.25"/>
                        <Button
                            className=""
                            type="submit"
                            variant="outline"
                            style={{
                                transform: 'translateY(8px)'
                            }}
                        >
                            {editingHost ? "Update Host" : "Add Host"}
                        </Button>
                    </footer>
                </form>
            </Form>
        </div>
    );
}