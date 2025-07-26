import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getSSHHosts, deleteSSHHost } from "@/apps/SSH/ssh-axios";
import { Edit, Trash2, Server, Folder, Tag, Pin, Terminal, Network, FileEdit, Search } from "lucide-react";

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
    enableConfigEditor: boolean;
    defaultPath: string;
    tunnelConnections: any[];
    createdAt: string;
    updatedAt: string;
}

interface SSHManagerHostViewerProps {
    onEditHost?: (host: SSHHost) => void;
}

export function SSHManagerHostViewer({ onEditHost }: SSHManagerHostViewerProps) {
    const [hosts, setHosts] = useState<SSHHost[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");

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
            console.error('Failed to fetch hosts:', err);
            setError('Failed to load hosts');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (hostId: number, hostName: string) => {
        if (window.confirm(`Are you sure you want to delete "${hostName}"?`)) {
            try {
                await deleteSSHHost(hostId);
                await fetchHosts(); // Refresh the list
            } catch (err) {
                console.error('Failed to delete host:', err);
                alert('Failed to delete host');
            }
        }
    };

    const handleEdit = (host: SSHHost) => {
        if (onEditHost) {
            onEditHost(host);
        }
    };

    // Filter and sort hosts
    const filteredAndSortedHosts = useMemo(() => {
        let filtered = hosts;

        // Apply search filter
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

        // Sort: pinned first, then alphabetical by name/username
        return filtered.sort((a, b) => {
            // First, sort by pin status (pinned hosts first)
            if (a.pin && !b.pin) return -1;
            if (!a.pin && b.pin) return 1;
            
            // Then sort alphabetically by name or username
            const aName = a.name || a.username;
            const bName = b.name || b.username;
            return aName.localeCompare(bName);
        });
    }, [hosts, searchQuery]);

    // Group hosts by folder
    const hostsByFolder = useMemo(() => {
        const grouped: { [key: string]: SSHHost[] } = {};
        
        filteredAndSortedHosts.forEach(host => {
            const folder = host.folder || 'Uncategorized';
            if (!grouped[folder]) {
                grouped[folder] = [];
            }
            grouped[folder].push(host);
        });
        
        // Sort folders to ensure "Uncategorized" is always first
        const sortedFolders = Object.keys(grouped).sort((a, b) => {
            if (a === 'Uncategorized') return -1;
            if (b === 'Uncategorized') return 1;
            return a.localeCompare(b);
        });
        
        // Create a new object with sorted folders
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
                    <Server className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
                <Button onClick={fetchHosts} variant="outline" size="sm">
                    Refresh
                </Button>
            </div>

            {/* Search Bar */}
            <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
                                    <AccordionTrigger className="px-2 py-1 bg-muted/20 border-b hover:no-underline rounded-t-md">
                                        <div className="flex items-center gap-2">
                                            <Folder className="h-4 w-4" />
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
                                                                {host.pin && <Pin className="h-3 w-3 text-yellow-500 flex-shrink-0" />}
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
                                                                <Edit className="h-3 w-3" />
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
                                                                <Trash2 className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    
                                                    <div className="mt-2 space-y-1">
                                                        {/* Tags */}
                                                        {host.tags && host.tags.length > 0 && (
                                                            <div className="flex flex-wrap gap-1">
                                                                {host.tags.slice(0, 6).map((tag, index) => (
                                                                    <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                                                                        <Tag className="h-2 w-2 mr-0.5" />
                                                                        {tag}
                                                                    </Badge>
                                                                ))}
                                                                {host.tags.length > 6 && (
                                                                    <Badge variant="outline" className="text-xs px-1 py-0">
                                                                        +{host.tags.length - 6}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        )}
                                                        
                                                        {/* Features */}
                                                        <div className="flex flex-wrap gap-1">
                                                            {host.enableTerminal && (
                                                                <Badge variant="outline" className="text-xs px-1 py-0">
                                                                    <Terminal className="h-2 w-2 mr-0.5" />
                                                                    Terminal
                                                                </Badge>
                                                            )}
                                                            {host.enableTunnel && (
                                                                <Badge variant="outline" className="text-xs px-1 py-0">
                                                                    <Network className="h-2 w-2 mr-0.5" />
                                                                    Tunnel
                                                                    {host.tunnelConnections && host.tunnelConnections.length > 0 && (
                                                                        <span className="ml-0.5">({host.tunnelConnections.length})</span>
                                                                    )}
                                                                </Badge>
                                                            )}
                                                            {host.enableConfigEditor && (
                                                                <Badge variant="outline" className="text-xs px-1 py-0">
                                                                    <FileEdit className="h-2 w-2 mr-0.5" />
                                                                    Config
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