import React from "react";
import { SSHTunnelObject } from "./SSHTunnelObject.tsx";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion.tsx";
import { Separator } from "@/components/ui/separator.tsx";

interface SSHTunnelViewerProps {
    tunnels: Array<{
        id: number;
        name: string;
        folder: string;
        sourcePort: number;
        endpointPort: number;
        sourceIP: string;
        sourceSSHPort: number;
        sourceUsername: string;
        sourcePassword: string;
        sourceAuthMethod: string;
        sourceSSHKey: string;
        sourceKeyPassword: string;
        sourceKeyType: string;
        endpointIP: string;
        endpointSSHPort: number;
        endpointUsername: string;
        endpointPassword: string;
        endpointAuthMethod: string;
        endpointSSHKey: string;
        endpointKeyPassword: string;
        endpointKeyType: string;
        maxRetries: number;
        retryInterval: number;
        connectionState?: string;
        autoStart: boolean;
        isPinned: boolean;
    }>;
    onConnect?: (tunnelId: string) => void;
    onDisconnect?: (tunnelId: string) => void;
    onDeleteTunnel?: (tunnelId: string) => void;
    onEditTunnel?: (tunnelId: string) => void;
}

export function SSHTunnelViewer({ 
    tunnels = [], 
    onConnect, 
    onDisconnect,
    onDeleteTunnel,
    onEditTunnel
}: SSHTunnelViewerProps): React.ReactElement {
    const handleConnect = (tunnelId: string) => {
        onConnect?.(tunnelId);
    };

    const handleDisconnect = (tunnelId: string) => {
        onDisconnect?.(tunnelId);
    };

    // Group tunnels by folder and sort
    const tunnelsByFolder = React.useMemo(() => {
        const map: Record<string, typeof tunnels> = {};
        tunnels.forEach(tunnel => {
            const folder = tunnel.folder && tunnel.folder.trim() ? tunnel.folder : 'No Folder';
            if (!map[folder]) map[folder] = [];
            map[folder].push(tunnel);
        });
        return map;
    }, [tunnels]);

    const sortedFolders = React.useMemo(() => {
        const folders = Object.keys(tunnelsByFolder);
        folders.sort((a, b) => {
            if (a === 'No Folder') return -1;
            if (b === 'No Folder') return 1;
            return a.localeCompare(b);
        });
        return folders;
    }, [tunnelsByFolder]);

    const getSortedTunnels = (arr: typeof tunnels) => {
        const pinned = arr.filter(t => t.isPinned).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const rest = arr.filter(t => !t.isPinned).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return [...pinned, ...rest];
    };

    return (
        <div className="w-full p-6" style={{ width: 'calc(100vw - 256px)', maxWidth: 'none' }}>
            <div className="w-full min-w-0" style={{ width: '100%', maxWidth: 'none' }}>
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-foreground mb-2">
                        SSH Tunnels
                    </h1>
                    <p className="text-muted-foreground">
                        Manage your SSH tunnel connections
                    </p>
                </div>

                {/* Accordion Layout */}
                {tunnels.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            No SSH Tunnels
                        </h3>
                        <p className="text-muted-foreground max-w-md">
                            Create your first SSH tunnel to get started. Use the sidebar to add a new tunnel configuration.
                        </p>
                    </div>
                ) : (
                    <Accordion type="multiple" className="w-full" defaultValue={sortedFolders}>
                        {sortedFolders.map((folder, idx) => (
                            <AccordionItem value={folder} key={`folder-${folder}`} className={idx === 0 ? "mt-0" : "mt-2"}>
                                <AccordionTrigger className="text-base font-semibold rounded-t-none px-3 py-2" style={{marginTop: idx === 0 ? 0 : undefined}}>
                                    {folder}
                                </AccordionTrigger>
                                <AccordionContent className="flex flex-col gap-1 px-3 pb-2 pt-1">
                                    <div className="grid grid-cols-4 gap-6 w-full">
                                        {getSortedTunnels(tunnelsByFolder[folder]).map((tunnel, tunnelIndex) => (
                                            <div key={tunnel.id} className="w-full">
                                                <SSHTunnelObject
                                                    hostConfig={tunnel}
                                                    connectionState={tunnel.connectionState as any}
                                                    isPinned={tunnel.isPinned}
                                                    onConnect={() => handleConnect(tunnel.id.toString())}
                                                    onDisconnect={() => handleDisconnect(tunnel.id.toString())}
                                                    onDelete={() => onDeleteTunnel?.(tunnel.id.toString())}
                                                    onEdit={() => onEditTunnel?.(tunnel.id.toString())}
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