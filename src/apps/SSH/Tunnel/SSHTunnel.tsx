import React, { useState, useEffect, useCallback } from "react";
import { SSHTunnelSidebar } from "@/apps/SSH/Tunnel/SSHTunnelSidebar.tsx";
import { SSHTunnelViewer } from "@/apps/SSH/Tunnel/SSHTunnelViewer.tsx";
import axios from "axios";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

interface SSHTunnel {
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
    connectionState: string;
    autoStart: boolean;
    isPinned: boolean;
}

export function SSHTunnel({ onSelectView }: ConfigEditorProps): React.ReactElement {
    const [tunnels, setTunnels] = useState<SSHTunnel[]>([]);
    const [tunnelsLoading, setTunnelsLoading] = useState(false);
    const [tunnelsError, setTunnelsError] = useState<string | null>(null);
    const [tunnelStatusMap, setTunnelStatusMap] = useState<Record<string, any>>({});
    const sidebarRef = React.useRef<any>(null);

    const fetchTunnels = useCallback(async () => {
        setTunnelsLoading(true);
        setTunnelsError(null);
        try {
            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
            const res = await axios.get(
                (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + '/ssh_tunnel/tunnel',
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            const tunnelData = res.data || [];
            setTunnels(tunnelData.map((tunnel: any) => ({
                id: tunnel.id,
                name: tunnel.name,
                folder: tunnel.folder || '',
                sourcePort: tunnel.sourcePort,
                endpointPort: tunnel.endpointPort,
                sourceIP: tunnel.sourceIP,
                sourceSSHPort: tunnel.sourceSSHPort,
                sourceUsername: tunnel.sourceUsername || '',
                sourcePassword: tunnel.sourcePassword || '',
                sourceAuthMethod: tunnel.sourceAuthMethod || 'password',
                sourceSSHKey: tunnel.sourceSSHKey || '',
                sourceKeyPassword: tunnel.sourceKeyPassword || '',
                sourceKeyType: tunnel.sourceKeyType || '',
                endpointIP: tunnel.endpointIP,
                endpointSSHPort: tunnel.endpointSSHPort,
                endpointUsername: tunnel.endpointUsername || '',
                endpointPassword: tunnel.endpointPassword || '',
                endpointAuthMethod: tunnel.endpointAuthMethod || 'password',
                endpointSSHKey: tunnel.endpointSSHKey || '',
                endpointKeyPassword: tunnel.endpointKeyPassword || '',
                endpointKeyType: tunnel.endpointKeyType || '',
                maxRetries: tunnel.maxRetries || 3,
                retryInterval: tunnel.retryInterval || 5000,
                connectionState: tunnel.connectionState || 'DISCONNECTED',
                autoStart: tunnel.autoStart || false,
                isPinned: tunnel.isPinned || false
            })));
        } catch (err: any) {
            setTunnelsError('Failed to load tunnels');
        } finally {
            setTunnelsLoading(false);
        }
    }, []);

    // Poll backend for tunnel statuses
    const fetchTunnelStatuses = useCallback(async () => {
        try {
            const res = await axios.get('http://localhost:8083/status');
            setTunnelStatusMap(res.data || {});
        } catch (err) {
            // Optionally handle error
        }
    }, []);

    useEffect(() => {
        fetchTunnels();
        const interval = setInterval(fetchTunnels, 10000);
        return () => clearInterval(interval);
    }, [fetchTunnels]);

    useEffect(() => {
        fetchTunnelStatuses();
        const interval = setInterval(fetchTunnelStatuses, 500);
        return () => clearInterval(interval);
    }, [fetchTunnelStatuses]);

    // Merge backend status into tunnels
    const tunnelsWithStatus = tunnels.map(tunnel => {
        const status = tunnelStatusMap[tunnel.name] || {};
        return {
            ...tunnel,
            connectionState: status.status ? status.status.toUpperCase() : tunnel.connectionState,
            statusReason: status.reason || '',
            statusErrorType: status.errorType || '',
            statusManualDisconnect: status.manualDisconnect || false,
            statusRetryCount: status.retryCount,
            statusMaxRetries: status.maxRetries,
            statusNextRetryIn: status.nextRetryIn,
            statusRetryExhausted: status.retryExhausted,
        };
    });

    const handleConnect = async (tunnelId: string) => {
        // Immediately set to CONNECTING for instant UI feedback
        setTunnels(prev => prev.map(t =>
            t.id.toString() === tunnelId
                ? { ...t, connectionState: "CONNECTING" }
                : t
        ));
        const tunnel = tunnels.find(t => t.id.toString() === tunnelId);
        if (!tunnel) return;
        try {
            await axios.post('http://localhost:8083/connect', {
                ...tunnel,
                name: tunnel.name
            });
            // No need to update state here; polling will update real status
        } catch (err) {
            // Optionally handle error
        }
    };

    const handleDisconnect = async (tunnelId: string) => {
        // Immediately set to DISCONNECTING for instant UI feedback
        setTunnels(prev => prev.map(t =>
            t.id.toString() === tunnelId
                ? { ...t, connectionState: "DISCONNECTING" }
                : t
        ));
        const tunnel = tunnels.find(t => t.id.toString() === tunnelId);
        if (!tunnel) return;
        try {
            await axios.post('http://localhost:8083/disconnect', {
                tunnelName: tunnel.name
            });
            // No need to update state here; polling will update real status
        } catch (err) {
            // Optionally handle error
        }
    };

    const handleDeleteTunnel = async (tunnelId: string) => {
        try {
            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
            await axios.delete(
                (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + `/ssh_tunnel/tunnel/${tunnelId}`,
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            fetchTunnels();
        } catch (err: any) {
            console.error('Failed to delete tunnel:', err);
        }
    };

    const handleEditTunnel = async (tunnelId: string, data: any) => {
        try {
            const jwt = document.cookie.split('; ').find(row => row.startsWith('jwt='))?.split('=')[1];
            await axios.put(
                (window.location.hostname === 'localhost' ? 'http://localhost:8081' : '') + `/ssh_tunnel/tunnel/${tunnelId}`,
                data,
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            fetchTunnels();
        } catch (err: any) {
            console.error('Failed to edit tunnel:', err);
        }
    };

    const handleEditTunnelClick = (tunnelId: string) => {
        // Find the tunnel data and pass it to the sidebar
        const tunnel = tunnels.find(t => t.id.toString() === tunnelId);
        if (tunnel && sidebarRef.current) {
            // Call the sidebar's openEditSheet function
            sidebarRef.current.openEditSheet(tunnel);
        }
    };

    return (
        <div className="flex h-screen w-full">
            <div className="w-64 flex-shrink-0">
                <SSHTunnelSidebar 
                    ref={sidebarRef}
                    onSelectView={onSelectView} 
                    onTunnelAdded={fetchTunnels}
                    onEditTunnel={handleEditTunnelClick}
                />
            </div>
            <div className="flex-1 overflow-auto">
                <SSHTunnelViewer 
                    tunnels={tunnelsWithStatus}
                    onConnect={handleConnect}
                    onDisconnect={handleDisconnect}
                    onDeleteTunnel={handleDeleteTunnel}
                    onEditTunnel={handleEditTunnelClick}
                />
            </div>
        </div>
    );
}