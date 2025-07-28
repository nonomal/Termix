import React from "react";
import {SSHTunnelObject} from "./SSHTunnelObject.tsx";
import {Accordion, AccordionContent, AccordionItem, AccordionTrigger} from "@/components/ui/accordion.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Search} from "lucide-react";

interface TunnelConnection {
    sourcePort: number;
    endpointPort: number;
    endpointHost: string;
    maxRetries: number;
    retryInterval: number;
    autoStart: boolean;
}

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
    tunnelConnections: TunnelConnection[];
    createdAt: string;
    updatedAt: string;
}

interface TunnelStatus {
    status: string;
    reason?: string;
    errorType?: string;
    retryCount?: number;
    maxRetries?: number;
    nextRetryIn?: number;
    retryExhausted?: boolean;
}

interface SSHTunnelViewerProps {
    hosts: SSHHost[];
    tunnelStatuses: Record<string, TunnelStatus>;
    tunnelActions: Record<string, boolean>;
    onTunnelAction: (action: 'connect' | 'disconnect' | 'cancel', host: SSHHost, tunnelIndex: number) => Promise<any>;
}

export function SSHTunnelViewer({
                                    hosts = [],
                                    tunnelStatuses = {},
                                    tunnelActions = {},
                                    onTunnelAction
                                }: SSHTunnelViewerProps): React.ReactElement {
    const [searchQuery, setSearchQuery] = React.useState("");
    const [debouncedSearch, setDebouncedSearch] = React.useState("");

    React.useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(searchQuery), 200);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    const filteredHosts = React.useMemo(() => {
        if (!debouncedSearch.trim()) return hosts;

        const query = debouncedSearch.trim().toLowerCase();
        return hosts.filter(host => {
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
    }, [hosts, debouncedSearch]);

    const tunnelHosts = React.useMemo(() => {
        return filteredHosts.filter(host =>
            host.enableTunnel &&
            host.tunnelConnections &&
            host.tunnelConnections.length > 0
        );
    }, [filteredHosts]);

    const hostsByFolder = React.useMemo(() => {
        const map: Record<string, SSHHost[]> = {};
        tunnelHosts.forEach(host => {
            const folder = host.folder && host.folder.trim() ? host.folder : 'Uncategorized';
            if (!map[folder]) map[folder] = [];
            map[folder].push(host);
        });
        return map;
    }, [tunnelHosts]);

    const sortedFolders = React.useMemo(() => {
        const folders = Object.keys(hostsByFolder);
        folders.sort((a, b) => {
            if (a === 'Uncategorized') return -1;
            if (b === 'Uncategorized') return 1;
            return a.localeCompare(b);
        });
        return folders;
    }, [hostsByFolder]);

    const getSortedHosts = (arr: SSHHost[]) => {
        const pinned = arr.filter(h => h.pin).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const rest = arr.filter(h => !h.pin).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return [...pinned, ...rest];
    };

    return (
        <div className="w-full p-6" style={{width: 'calc(100vw - 256px)', maxWidth: 'none'}}>
            <div className="w-full min-w-0" style={{width: '100%', maxWidth: 'none'}}>
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        SSH Tunnels
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your SSH tunnel connections
                    </p>
                </div>

                <div className="relative mb-3">
                    <Search
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                    <Input
                        placeholder="Search hosts by name, username, IP, folder, tags..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>

                {tunnelHosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            No SSH Tunnels
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                            {searchQuery.trim() ?
                                "No hosts match your search criteria." :
                                "Create your first SSH tunnel to get started. Use the SSH Manager to add hosts with tunnel connections."
                            }
                        </p>
                    </div>
                ) : (
                    <Accordion type="multiple" className="w-full" defaultValue={sortedFolders}>
                        {sortedFolders.map((folder, idx) => (
                            <AccordionItem value={folder} key={`folder-${folder}`}
                                           className={idx === 0 ? "mt-0" : "mt-2"}>
                                <AccordionTrigger className="text-base font-semibold rounded-t-none px-3 py-2"
                                                  style={{marginTop: idx === 0 ? 0 : undefined}}>
                                    {folder}
                                </AccordionTrigger>
                                <AccordionContent className="flex flex-col gap-1 px-3 pb-2 pt-1">
                                    <div className="grid grid-cols-4 gap-6 w-full">
                                        {getSortedHosts(hostsByFolder[folder]).map((host, hostIndex) => (
                                            <div key={host.id} className="w-full">
                                                <SSHTunnelObject
                                                    host={host}
                                                    tunnelStatuses={tunnelStatuses}
                                                    tunnelActions={tunnelActions}
                                                    onTunnelAction={onTunnelAction}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </div>
        </div>
    );
}