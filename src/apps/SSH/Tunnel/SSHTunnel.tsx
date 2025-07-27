import React, { useState, useEffect, useCallback } from "react";
import { SSHTunnelSidebar } from "@/apps/SSH/Tunnel/SSHTunnelSidebar.tsx";
import { SSHTunnelViewer } from "@/apps/SSH/Tunnel/SSHTunnelViewer.tsx";
import { getSSHHosts, getTunnelStatuses, connectTunnel, disconnectTunnel, cancelTunnel } from "@/apps/SSH/ssh-axios";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

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
    password?: string;
    key?: string;
    keyPassword?: string;
    keyType?: string;
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

export function SSHTunnel({ onSelectView }: ConfigEditorProps): React.ReactElement {
    const [hosts, setHosts] = useState<SSHHost[]>([]);
    const [tunnelStatuses, setTunnelStatuses] = useState<Record<string, TunnelStatus>>({});
    const [tunnelActions, setTunnelActions] = useState<Record<string, boolean>>({}); // Track loading states

    const fetchHosts = useCallback(async () => {
        try {
            const hostsData = await getSSHHosts();
            setHosts(hostsData);
        } catch (err) {
            // Silent error handling
        }
    }, []);

    // Poll backend for tunnel statuses
    const fetchTunnelStatuses = useCallback(async () => {
        try {
            const statusData = await getTunnelStatuses();
            setTunnelStatuses(statusData);
        } catch (err) {
            // Silent error handling
        }
    }, []);

    useEffect(() => {
        fetchHosts();
        const interval = setInterval(fetchHosts, 10000);
        return () => clearInterval(interval);
    }, [fetchHosts]);

    useEffect(() => {
        fetchTunnelStatuses();
        const interval = setInterval(fetchTunnelStatuses, 500);
        return () => clearInterval(interval);
    }, [fetchTunnelStatuses]);

    const handleTunnelAction = async (action: 'connect' | 'disconnect' | 'cancel', host: SSHHost, tunnelIndex: number) => {
        const tunnel = host.tunnelConnections[tunnelIndex];
        const tunnelName = `${host.name || `${host.username}@${host.ip}`}_${tunnel.sourcePort}_${tunnel.endpointPort}`;
        
        setTunnelActions(prev => ({ ...prev, [tunnelName]: true }));
        
        try {
            if (action === 'connect') {
                // Find the endpoint host configuration
                const endpointHost = hosts.find(h => 
                    h.name === tunnel.endpointHost || 
                    `${h.username}@${h.ip}` === tunnel.endpointHost
                );

                if (!endpointHost) {
                    throw new Error('Endpoint host not found');
                }

                // Create tunnel configuration
                const tunnelConfig = {
                    name: tunnelName,
                    hostName: host.name || `${host.username}@${host.ip}`,
                    sourceIP: host.ip,
                    sourceSSHPort: host.port,
                    sourceUsername: host.username,
                    sourcePassword: host.authType === 'password' ? host.password : undefined,
                    sourceAuthMethod: host.authType,
                    sourceSSHKey: host.authType === 'key' ? host.key : undefined,
                    sourceKeyPassword: host.authType === 'key' ? host.keyPassword : undefined,
                    sourceKeyType: host.authType === 'key' ? host.keyType : undefined,
                    endpointIP: endpointHost.ip,
                    endpointSSHPort: endpointHost.port,
                    endpointUsername: endpointHost.username,
                    endpointPassword: endpointHost.authType === 'password' ? endpointHost.password : undefined,
                    endpointAuthMethod: endpointHost.authType,
                    endpointSSHKey: endpointHost.authType === 'key' ? endpointHost.key : undefined,
                    endpointKeyPassword: endpointHost.authType === 'key' ? endpointHost.keyPassword : undefined,
                    endpointKeyType: endpointHost.authType === 'key' ? endpointHost.keyType : undefined,
                    sourcePort: tunnel.sourcePort,
                    endpointPort: tunnel.endpointPort,
                    maxRetries: tunnel.maxRetries,
                    retryInterval: tunnel.retryInterval * 1000, // Convert to milliseconds
                    autoStart: tunnel.autoStart,
                    isPinned: host.pin
                };

                await connectTunnel(tunnelConfig);
            } else if (action === 'disconnect') {
                await disconnectTunnel(tunnelName);
            } else if (action === 'cancel') {
                await cancelTunnel(tunnelName);
            }
            
            // Refresh statuses after action
            await fetchTunnelStatuses();
        } catch (err) {
            console.error(`Failed to ${action} tunnel:`, err);
            // Let the backend handle error status updates
        } finally {
            setTunnelActions(prev => ({ ...prev, [tunnelName]: false }));
        }
    };

    return (
        <div className="flex h-screen w-full">
            <div className="w-64 flex-shrink-0">
                <SSHTunnelSidebar 
                    onSelectView={onSelectView} 
                />
            </div>
            <div className="flex-1 overflow-auto">
                <SSHTunnelViewer 
                    hosts={hosts}
                    tunnelStatuses={tunnelStatuses}
                    tunnelActions={tunnelActions}
                    onTunnelAction={handleTunnelAction}
                />
            </div>
        </div>
    );
}