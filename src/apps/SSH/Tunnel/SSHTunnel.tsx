import React, { useState, useEffect, useCallback } from "react";
import { SSHTunnelSidebar } from "@/apps/SSH/Tunnel/SSHTunnelSidebar.tsx";
import { SSHTunnelViewer } from "@/apps/SSH/Tunnel/SSHTunnelViewer.tsx";
import { getSSHHosts } from "@/apps/SSH/ssh-axios";
import axios from "axios";

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

interface HostStatus {
    connectionState?: string;
    statusReason?: string;
    statusErrorType?: string;
    statusRetryCount?: number;
    statusMaxRetries?: number;
    statusNextRetryIn?: number;
    statusRetryExhausted?: boolean;
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
    const [hostStatuses, setHostStatuses] = useState<Record<number, HostStatus>>({});

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
            const res = await axios.get('http://localhost:8083/status');
            const statusData = res.data || {};
            
            // Convert tunnel statuses to host statuses
            const newHostStatuses: Record<number, HostStatus> = {};
            
            hosts.forEach(host => {
                // Find all tunnel statuses for this host
                const hostName = host.name || `${host.username}@${host.ip}`;
                const hostTunnelStatuses: TunnelStatus[] = [];
                
                // Look for tunnel statuses that start with this host name
                Object.entries(statusData).forEach(([tunnelName, status]) => {
                    if (tunnelName.startsWith(hostName + '_')) {
                        hostTunnelStatuses.push(status as any);
                    }
                });
                
                if (hostTunnelStatuses.length > 0) {
                    // Determine overall host status based on tunnel statuses
                    const connectedTunnels = hostTunnelStatuses.filter(s => s.status === 'connected');
                    const failedTunnels = hostTunnelStatuses.filter(s => s.status === 'failed');
                    const connectingTunnels = hostTunnelStatuses.filter(s => 
                        ['connecting', 'verifying', 'retrying'].includes(s.status)
                    );
                    
                    let overallStatus: string;
                    let statusReason: string | undefined;
                    
                    if (connectingTunnels.length > 0) {
                        overallStatus = 'connecting';
                    } else if (failedTunnels.length === hostTunnelStatuses.length) {
                        overallStatus = 'failed';
                        statusReason = failedTunnels[0]?.reason;
                    } else if (connectedTunnels.length === hostTunnelStatuses.length) {
                        overallStatus = 'connected';
                    } else if (connectedTunnels.length > 0) {
                        overallStatus = 'connected';
                    } else {
                        overallStatus = 'disconnected';
                    }
                    
                    newHostStatuses[host.id] = {
                        connectionState: overallStatus,
                        statusReason,
                        statusErrorType: failedTunnels[0]?.errorType,
                        statusRetryCount: connectingTunnels.find(s => s.status === 'retrying')?.retryCount,
                        statusMaxRetries: connectingTunnels.find(s => s.status === 'retrying')?.maxRetries,
                        statusNextRetryIn: connectingTunnels.find(s => s.status === 'retrying')?.nextRetryIn,
                        statusRetryExhausted: failedTunnels.some(s => s.retryExhausted),
                    };
                } else {
                    // Set default disconnected status
                    newHostStatuses[host.id] = {
                        connectionState: 'disconnected'
                    };
                }
            });
            
            setHostStatuses(newHostStatuses);
        } catch (err) {
            // Silent error handling
        }
    }, [hosts]);

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

    const handleConnect = async (hostId: number) => {
        const host = hosts.find(h => h.id === hostId);
        if (!host || !host.tunnelConnections || host.tunnelConnections.length === 0) {
            return;
        }

        // Immediately set to CONNECTING for instant UI feedback
        setHostStatuses(prev => ({
            ...prev,
            [hostId]: { ...prev[hostId], connectionState: "connecting" }
        }));

        try {
            // For each tunnel connection, create a tunnel configuration
            for (const tunnelConnection of host.tunnelConnections) {
                // Find the endpoint host configuration
                const endpointHost = hosts.find(h => 
                    h.name === tunnelConnection.endpointHost || 
                    `${h.username}@${h.ip}` === tunnelConnection.endpointHost
                );

                if (!endpointHost) {
                    continue;
                }

                // Create tunnel configuration
                const tunnelConfig = {
                    name: `${host.name || `${host.username}@${host.ip}`}_${tunnelConnection.sourcePort}_${tunnelConnection.endpointPort}`,
                    hostName: host.name || `${host.username}@${host.ip}`,
                    sourceIP: host.ip,
                    sourceSSHPort: host.port,
                    sourceUsername: host.username,
                    sourcePassword: host.password,
                    sourceAuthMethod: host.authType,
                    sourceSSHKey: host.key,
                    sourceKeyPassword: host.keyPassword,
                    sourceKeyType: host.keyType,
                    endpointIP: endpointHost.ip,
                    endpointSSHPort: endpointHost.port,
                    endpointUsername: endpointHost.username,
                    endpointPassword: endpointHost.password,
                    endpointAuthMethod: endpointHost.authType,
                    endpointSSHKey: endpointHost.key,
                    endpointKeyPassword: endpointHost.keyPassword,
                    endpointKeyType: endpointHost.keyType,
                    sourcePort: tunnelConnection.sourcePort,
                    endpointPort: tunnelConnection.endpointPort,
                    maxRetries: tunnelConnection.maxRetries,
                    retryInterval: tunnelConnection.retryInterval * 1000, // Convert to milliseconds
                    autoStart: tunnelConnection.autoStart,
                    isPinned: host.pin
                };

                await axios.post('http://localhost:8083/connect', tunnelConfig);
            }
        } catch (err) {
            // Reset status on error
            setHostStatuses(prev => ({
                ...prev,
                [hostId]: { ...prev[hostId], connectionState: "failed", statusReason: "Failed to connect" }
            }));
        }
    };

    const handleDisconnect = async (hostId: number) => {
        const host = hosts.find(h => h.id === hostId);
        if (!host) return;

        // Immediately set to DISCONNECTING for instant UI feedback
        setHostStatuses(prev => ({
            ...prev,
            [hostId]: { ...prev[hostId], connectionState: "disconnecting" }
        }));

        try {
            // Disconnect all tunnels for this host
            for (const tunnelConnection of host.tunnelConnections) {
                const tunnelName = `${host.name || `${host.username}@${host.ip}`}_${tunnelConnection.sourcePort}_${tunnelConnection.endpointPort}`;
                await axios.post('http://localhost:8083/disconnect', { tunnelName });
            }
        } catch (err) {
            // Silent error handling
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
                    hostStatuses={hostStatuses}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                />
            </div>
        </div>
    );
}