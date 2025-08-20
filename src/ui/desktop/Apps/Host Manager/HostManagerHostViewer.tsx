import React, {useState, useEffect, useMemo} from "react";
import {Card, CardContent} from "@/components/ui/card.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Badge} from "@/components/ui/badge.tsx";
import {ScrollArea} from "@/components/ui/scroll-area.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion.tsx";
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from "@/components/ui/tooltip.tsx";
import {getSSHHosts, deleteSSHHost, bulkImportSSHHosts} from "@/ui/main-axios.ts";
import {
    Edit,
    Trash2,
    Server,
    Folder,
    Tag,
    Pin,
    Terminal,
    Network,
    FileEdit,
    Search,
    Upload,
    Info
} from "lucide-react";
import {Separator} from "@/components/ui/separator.tsx";

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
    enableTerminal: boolean;
    enableTunnel: boolean;
    enableFileManager: boolean;
    defaultPath: string;
    tunnelConnections: any[];
    createdAt: string;
    updatedAt: string;
}

interface SSHManagerHostViewerProps {
    onEditHost?: (host: SSHHost) => void;
}

export function HostManagerHostViewer({onEditHost}: SSHManagerHostViewerProps) {
    const [hosts, setHosts] = useState<SSHHost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchHosts();
    }, []);

    const fetchHosts = async () => {
        try {
            setLoading(true);
            const data = await getSSHHosts();
            setHosts(data);
            setError(null);
        } catch (err) {
            setError('Failed to load hosts');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (hostId: number, hostName: string) => {
        if (window.confirm(`Are you sure you want to delete "${hostName}"?`)) {
            try {
                await deleteSSHHost(hostId);
                await fetchHosts();
                window.dispatchEvent(new CustomEvent('ssh-hosts:changed'));
            } catch (err) {
                alert('Failed to delete host');
            }
        }
    };

    const handleEdit = (host: SSHHost) => {
        if (onEditHost) {
            onEditHost(host);
        }
    };

    const handleJsonImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            setImporting(true);
            const text = await file.text();
            const data = JSON.parse(text);

            if (!Array.isArray(data.hosts) && !Array.isArray(data)) {
                throw new Error('JSON must contain a "hosts" array or be an array of hosts');
            }

            const hostsArray = Array.isArray(data.hosts) ? data.hosts : data;

            if (hostsArray.length === 0) {
                throw new Error('No hosts found in JSON file');
            }

            if (hostsArray.length > 100) {
                throw new Error('Maximum 100 hosts allowed per import');
            }

            const result = await bulkImportSSHHosts(hostsArray);

            if (result.success > 0) {
                alert(`Import completed: ${result.success} successful, ${result.failed} failed${result.errors.length > 0 ? '\n\nErrors:\n' + result.errors.join('\n') : ''}`);
                await fetchHosts();
                window.dispatchEvent(new CustomEvent('ssh-hosts:changed'));
            } else {
                alert(`Import failed: ${result.errors.join('\n')}`);
            }

        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to import JSON file';
            alert(`Import error: ${errorMessage}`);
        } finally {
            setImporting(false);
            event.target.value = '';
        }
    };

    const filteredAndSortedHosts = useMemo(() => {
        let filtered = hosts;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = hosts.filter(host => {
                const searchableText = [
                    host.name || '',
                    host.username,
                    host.ip,
                    host.folder || '',
                    ...(host.tags || []),
                    host.authType,
                    host.defaultPath || ''
                ].join(' ').toLowerCase();
                return searchableText.includes(query);
            });
        }

        return filtered.sort((a, b) => {
            if (a.pin && !b.pin) return -1;
            if (!a.pin && b.pin) return 1;

            const aName = a.name || a.username;
            const bName = b.name || b.username;
            return aName.localeCompare(bName);
        });
    }, [hosts, searchQuery]);

    const hostsByFolder = useMemo(() => {
        const grouped: { [key: string]: SSHHost[] } = {};

        filteredAndSortedHosts.forEach(host => {
            const folder = host.folder || 'Uncategorized';
            if (!grouped[folder]) {
                grouped[folder] = [];
            }
            grouped[folder].push(host);
        });

        const sortedFolders = Object.keys(grouped).sort((a, b) => {
            if (a === 'Uncategorized') return -1;
            if (b === 'Uncategorized') return 1;
            return a.localeCompare(b);
        });

        const sortedGrouped: { [key: string]: SSHHost[] } = {};
        sortedFolders.forEach(folder => {
            sortedGrouped[folder] = grouped[folder];
        });

        return sortedGrouped;
    }, [filteredAndSortedHosts]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p className="text-muted-foreground">Loading hosts...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-red-500 mb-4">{error}</p>
                    <Button onClick={fetchHosts} variant="outline">
                        Retry
                    </Button>
                </div>
            </div>
        );
    }

    if (hosts.length === 0) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4"/>
                    <h3 className="text-lg font-semibold mb-2">No SSH Hosts</h3>
                    <p className="text-muted-foreground mb-4">
                        You haven't added any SSH hosts yet. Click "Add Host" to get started.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full min-h-0">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h2 className="text-xl font-semibold">SSH Hosts</h2>
                    <p className="text-muted-foreground">
                        {filteredAndSortedHosts.length} hosts
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="relative"
                                    onClick={() => document.getElementById('json-import-input')?.click()}
                                    disabled={importing}
                                >
                                    {importing ? 'Importing...' : 'Import JSON'}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom"
                                            className="max-w-sm bg-popover text-popover-foreground border border-border shadow-lg">
                                <div className="space-y-2">
                                    <p className="font-semibold text-sm">Import SSH Hosts from JSON</p>
                                    <p className="text-xs text-muted-foreground">
                                        Upload a JSON file to bulk import multiple SSH hosts (max 100).
                                    </p>
                                </div>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const sampleData = {
                                hosts: [
                                    {
                                        name: "Web Server - Production",
                                        ip: "192.168.1.100",
                                        port: 22,
                                        username: "admin",
                                        authType: "password",
                                        password: "your_secure_password_here",
                                        folder: "Production",
                                        tags: ["web", "production", "nginx"],
                                        pin: true,
                                        enableTerminal: true,
                                        enableTunnel: false,
                                        enableFileManager: true,
                                        defaultPath: "/var/www"
                                    },
                                    {
                                        name: "Database Server",
                                        ip: "192.168.1.101",
                                        port: 22,
                                        username: "dbadmin",
                                        authType: "key",
                                        key: "-----BEGIN OPENSSH PRIVATE KEY-----\nYour SSH private key content here\n-----END OPENSSH PRIVATE KEY-----",
                                        keyPassword: "optional_key_passphrase",
                                        keyType: "ssh-ed25519",
                                        folder: "Production",
                                        tags: ["database", "production", "postgresql"],
                                        pin: false,
                                        enableTerminal: true,
                                        enableTunnel: true,
                                        enableFileManager: false,
                                        tunnelConnections: [
                                            {
                                                sourcePort: 5432,
                                                endpointPort: 5432,
                                                endpointHost: "Web Server - Production",
                                                maxRetries: 3,
                                                retryInterval: 10,
                                                autoStart: true
                                            }
                                        ]
                                    }
                                ]
                            };

                            const blob = new Blob([JSON.stringify(sampleData, null, 2)], {type: 'application/json'});
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = 'sample-ssh-hosts.json';
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }}
                    >
                        Download Sample
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            const infoContent = `
JSON Import Format Guide

REQUIRED FIELDS:
• ip: Host IP address (string)
• port: SSH port (number, 1-65535)
• username: SSH username (string)
• authType: "password" or "key"

AUTHENTICATION FIELDS:
• password: Required if authType is "password"
• key: SSH private key content (string) if authType is "key"
• keyPassword: Optional key passphrase
• keyType: Key type (auto, ssh-rsa, ssh-ed25519, etc.)

OPTIONAL FIELDS:
• name: Display name (string)
• folder: Organization folder (string)
• tags: Array of tag strings
• pin: Pin to top (boolean)
• enableTerminal: Show in Terminal tab (boolean, default: true)
• enableTunnel: Show in Tunnel tab (boolean, default: true)
• enableFileManager: Show in File Manager tab (boolean, default: true)
• defaultPath: Default directory path (string)

TUNNEL CONFIGURATION:
• tunnelConnections: Array of tunnel objects
  - sourcePort: Local port (number)
  - endpointPort: Remote port (number)
  - endpointHost: Target host name (string)
  - maxRetries: Retry attempts (number, default: 3)
  - retryInterval: Retry delay in seconds (number, default: 10)
  - autoStart: Auto-start on launch (boolean, default: false)

EXAMPLE STRUCTURE:
{
  "hosts": [
    {
      "name": "Web Server",
      "ip": "192.168.1.100",
      "port": 22,
      "username": "admin",
      "authType": "password",
      "password": "your_password",
      "folder": "Production",
      "tags": ["web", "production"],
      "pin": true,
      "enableTerminal": true,
      "enableTunnel": false,
      "enableFileManager": true,
      "defaultPath": "/var/www"
    }
  ]
}

• Maximum 100 hosts per import
• File should contain a "hosts" array or be an array of host objects
• All fields are copyable for easy reference
                            `;

                            const newWindow = window.open('', '_blank', 'width=600,height=800,scrollbars=yes,resizable=yes');
                            if (newWindow) {
                                newWindow.document.write(`
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                        <title>SSH JSON Import Guide</title>
                                        <style>
                                            body { 
                                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                                                margin: 20px; 
                                                background: #1a1a1a; 
                                                color: #ffffff; 
                                                line-height: 1.6;
                                            }
                                            pre { 
                                                background: #2a2a2a; 
                                                padding: 15px; 
                                                border-radius: 5px; 
                                                overflow-x: auto; 
                                                border: 1px solid #404040;
                                            }
                                            code { 
                                                background: #404040; 
                                                padding: 2px 4px; 
                                                border-radius: 3px; 
                                                font-family: 'Consolas', 'Monaco', monospace;
                                            }
                                            h1 { color: #60a5fa; border-bottom: 2px solid #60a5fa; padding-bottom: 10px; }
                                            h2 { color: #34d399; margin-top: 25px; }
                                            .field-group { margin: 15px 0; }
                                            .field-item { margin: 8px 0; }
                                            .copy-btn { 
                                                background: #3b82f6; 
                                                color: white; 
                                                border: none; 
                                                padding: 5px 10px; 
                                                border-radius: 3px; 
                                                cursor: pointer; 
                                                margin-left: 10px;
                                            }
                                            .copy-btn:hover { background: #2563eb; }
                                        </style>
                                    </head>
                                    <body>
                                        <h1>SSH JSON Import Format Guide</h1>
                                        <p>Use this guide to create JSON files for bulk importing SSH hosts. All examples are copyable.</p>
                                        
                                        <h2>Required Fields</h2>
                                        <div class="field-group">
                                            <div class="field-item">
                                                <code>ip</code> - Host IP address (string)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('ip')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>port</code> - SSH port (number, 1-65535)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('port')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>username</code> - SSH username (string)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('username')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>authType</code> - "password" or "key"
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('authType')">Copy</button>
                                            </div>
                                        </div>
                                        
                                        <h2>Authentication Fields</h2>
                                        <div class="field-group">
                                            <div class="field-item">
                                                <code>password</code> - Required if authType is "password"
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('password')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>key</code> - SSH private key content (string) if authType is "key"
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('key')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>keyPassword</code> - Optional key passphrase
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('keyPassword')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>keyType</code> - Key type (auto, ssh-rsa, ssh-ed25519, etc.)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('keyType')">Copy</button>
                                            </div>
                                        </div>
                                        
                                        <h2>Optional Fields</h2>
                                        <div class="field-group">
                                            <div class="field-item">
                                                <code>name</code> - Display name (string)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('name')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>folder</code> - Organization folder (string)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('folder')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>tags</code> - Array of tag strings
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('tags')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>pin</code> - Pin to top (boolean)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('pin')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>enableTerminal</code> - Show in Terminal tab (boolean, default: true)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('enableTerminal')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>enableTunnel</code> - Show in Tunnel tab (boolean, default: true)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('enableTunnel')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>enableFileManager</code> - Show in File Manager tab (boolean, default: true)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('enableFileManager')">Copy</button>
                                            </div>
                                            <div class="field-item">
                                                <code>defaultPath</code> - Default directory path (string)
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('defaultPath')">Copy</button>
                                            </div>
                                        </div>
                                        
                                        <h2>Tunnel Configuration</h2>
                                        <div class="field-group">
                                            <div class="field-item">
                                                <code>tunnelConnections</code> - Array of tunnel objects
                                                <button class="copy-btn" onclick="navigator.clipboard.writeText('tunnelConnections')">Copy</button>
                                            </div>
                                            <div style="margin-left: 20px;">
                                                <div class="field-item">
                                                    <code>sourcePort</code> - Local port (number)
                                                    <button class="copy-btn" onclick="navigator.clipboard.writeText('sourcePort')">Copy</button>
                                                </div>
                                                <div class="field-item">
                                                    <code>endpointPort</code> - Remote port (number)
                                                    <button class="copy-btn" onclick="navigator.clipboard.writeText('endpointPort')">Copy</button>
                                                </div>
                                                <div class="field-item">
                                                    <code>endpointHost</code> - Target host name (string)
                                                    <button class="copy-btn" onclick="navigator.clipboard.writeText('endpointHost')">Copy</button>
                                                </div>
                                                <div class="field-item">
                                                    <code>maxRetries</code> - Retry attempts (number, default: 3)
                                                    <button class="copy-btn" onclick="navigator.clipboard.writeText('maxRetries')">Copy</button>
                                                </div>
                                                <div class="field-item">
                                                    <code>retryInterval</code> - Retry delay in seconds (number, default: 10)
                                                    <button class="copy-btn" onclick="navigator.clipboard.writeText('retryInterval')">Copy</button>
                                                </div>
                                                <div class="field-item">
                                                    <code>autoStart</code> - Auto-start on launch (boolean, default: false)
                                                    <button class="copy-btn" onclick="navigator.clipboard.writeText('autoStart')">Copy</button>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <h2>Example JSON Structure</h2>
                                        <pre><code>{
  "hosts": [
    {
      "name": "Web Server",
      "ip": "192.168.1.100",
      "port": 22,
      "username": "admin",
      "authType": "password",
      "password": "your_password",
      "folder": "Production",
      "tags": ["web", "production"],
      "pin": true,
      "enableTerminal": true,
      "enableTunnel": false,
      "enableFileManager": true,
      "defaultPath": "/var/www"
    }
  ]
}</code></pre>
                                        
                                        <h2>Important Notes</h2>
                                        <ul>
                                            <li>Maximum 100 hosts per import</li>
                                            <li>File should contain a "hosts" array or be an array of host objects</li>
                                            <li>All fields are copyable for easy reference</li>
                                            <li>Use the Download Sample button to get a complete example file</li>
                                        </ul>
                                    </body>
                                    </html>
                                `);
                                newWindow.document.close();
                            }
                        }}
                    >
                        Format Guide
                    </Button>

                    <div className="w-px h-6 bg-border mx-2"/>

                    <Button onClick={fetchHosts} variant="outline" size="sm">
                        Refresh
                    </Button>
                </div>
            </div>

            <input
                id="json-import-input"
                type="file"
                accept=".json"
                onChange={handleJsonImport}
                style={{display: 'none'}}
            />

            <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                <Input
                    placeholder="Search hosts by name, username, IP, folder, tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                />
            </div>

            <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-2 pb-20">
                    {Object.entries(hostsByFolder).map(([folder, folderHosts]) => (
                        <div key={folder} className="border rounded-md">
                            <Accordion type="multiple" defaultValue={Object.keys(hostsByFolder)}>
                                <AccordionItem value={folder} className="border-none">
                                    <AccordionTrigger
                                        className="px-2 py-1 bg-muted/20 border-b hover:no-underline rounded-t-md">
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-4 w-4"/>
                                            <span className="font-medium">{folder}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {folderHosts.length}
                                            </Badge>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="p-2">
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                            {folderHosts.map((host) => (
                                                <div
                                                    key={host.id}
                                                    className="bg-[#222225] border border-input rounded cursor-pointer hover:shadow-md transition-shadow p-2"
                                                    onClick={() => handleEdit(host)}
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-1">
                                                                {host.pin && <Pin
                                                                    className="h-3 w-3 text-yellow-500 flex-shrink-0"/>}
                                                                <h3 className="font-medium truncate text-sm">
                                                                    {host.name || `${host.username}@${host.ip}`}
                                                                </h3>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {host.ip}:{host.port}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground truncate">
                                                                {host.username}
                                                            </p>
                                                        </div>
                                                        <div className="flex gap-1 flex-shrink-0 ml-1">
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEdit(host);
                                                                }}
                                                                className="h-5 w-5 p-0"
                                                            >
                                                                <Edit className="h-3 w-3"/>
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(host.id, host.name || `${host.username}@${host.ip}`);
                                                                }}
                                                                className="h-5 w-5 p-0 text-red-500 hover:text-red-700"
                                                            >
                                                                <Trash2 className="h-3 w-3"/>
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="mt-2 space-y-1">
                                                        {host.tags && host.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {host.tags.slice(0, 6).map((tag, index) => (
                                                                    <Badge key={index} variant="secondary"
                                                                           className="text-xs px-1 py-0">
                                                                        <Tag className="h-2 w-2 mr-0.5"/>
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                                {host.tags.length > 6 && (
                                                                    <Badge variant="outline"
                                                                           className="text-xs px-1 py-0">
                                                                        +{host.tags.length - 6}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="flex flex-wrap gap-1">
                                                            {host.enableTerminal && (
                                                                <Badge variant="outline" className="text-xs px-1 py-0">
                                                                    <Terminal className="h-2 w-2 mr-0.5"/>
                                                                    Terminal
                                                                </Badge>
                                                            )}
                                                            {host.enableTunnel && (
                                                                <Badge variant="outline" className="text-xs px-1 py-0">
                                                                    <Network className="h-2 w-2 mr-0.5"/>
                                                                    Tunnel
                                                                    {host.tunnelConnections && host.tunnelConnections.length > 0 && (
                                                                        <span
                                                                            className="ml-0.5">({host.tunnelConnections.length})</span>
                                                                    )}
                                                                </Badge>
                                                            )}
                                                            {host.enableFileManager && (
                                                                <Badge variant="outline" className="text-xs px-1 py-0">
                                                                    <FileEdit className="h-2 w-2 mr-0.5"/>
                                                                    File Manager
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}