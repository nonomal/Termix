import React from "react";
import {Status, StatusIndicator} from "@/components/ui/shadcn-io/status";
import {Separator} from "@/components/ui/separator.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Progress} from "@/components/ui/progress.tsx"
import {Cpu, HardDrive, MemoryStick, File, Play, Square, Wifi, WifiOff, Loader2, AlertCircle, Clock, X} from "lucide-react";
import {getSSHHosts, getTunnelStatuses, connectTunnel, disconnectTunnel, cancelTunnel, getServerStatusById, getServerMetricsById} from "@/ui/main-axios.ts";

interface TunnelConnection {
    sourcePort: number;
    endpointPort: number;
    endpointHost: string;
    maxRetries: number;
    retryInterval: number;
    autoStart: boolean;
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

interface ServerComponentProps {
    hostConfig?: any;
    onSelectView?: (view: string, host?: any) => void;
}

const CONNECTION_STATES = {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    VERIFYING: "verifying",
    FAILED: "failed",
    UNSTABLE: "unstable",
    RETRYING: "retrying",
    WAITING: "waiting",
    DISCONNECTING: "disconnecting"
};

export function ServerComponent({ hostConfig, onSelectView }: ServerComponentProps): React.ReactElement {
    const [serverStatus, setServerStatus] = React.useState<'online' | 'offline'>('offline');
    const [metrics, setMetrics] = React.useState<any>(null);
    const [currentHostConfig, setCurrentHostConfig] = React.useState(hostConfig);
    const [tunnelStatuses, setTunnelStatuses] = React.useState<Record<string, TunnelStatus>>({});
    const [tunnelActions, setTunnelActions] = React.useState<Record<string, boolean>>({});
    const [allHosts, setAllHosts] = React.useState<any[]>([]);

    React.useEffect(() => {
        setCurrentHostConfig(hostConfig);
    }, [hostConfig]);

    React.useEffect(() => {
        const fetchLatestHostConfig = async () => {
            if (hostConfig?.id) {
                try {
                    const {getSSHHosts} = await import('@/ui/main-axios.ts');
                    const hosts = await getSSHHosts();
                    setAllHosts(hosts);
                    const updatedHost = hosts.find(h => h.id === hostConfig.id);
                    if (updatedHost) {
                        setCurrentHostConfig(updatedHost);
                    }
                } catch (error) {
                }
            }
        };

        fetchLatestHostConfig();

        const handleHostsChanged = async () => {
            if (hostConfig?.id) {
                try {
                    const {getSSHHosts} = await import('@/ui/main-axios.ts');
                    const hosts = await getSSHHosts();
                    setAllHosts(hosts);
                    const updatedHost = hosts.find(h => h.id === hostConfig.id);
                    if (updatedHost) {
                        setCurrentHostConfig(updatedHost);
                    }
                } catch (error) {
                }
            }
        };

        window.addEventListener('ssh-hosts:changed', handleHostsChanged);
        return () => window.removeEventListener('ssh-hosts:changed', handleHostsChanged);
    }, [hostConfig?.id]);

    React.useEffect(() => {
        let cancelled = false;
        let intervalId: number | undefined;

        const fetchStatus = async () => {
            try {
                const res = await getServerStatusById(currentHostConfig?.id);
                if (!cancelled) {
                    setServerStatus(res?.status === 'online' ? 'online' : 'offline');
                }
            } catch {
                if (!cancelled) setServerStatus('offline');
            }
        };

        const fetchMetrics = async () => {
            if (!currentHostConfig?.id) return;
            try {
                const data = await getServerMetricsById(currentHostConfig.id);
                if (!cancelled) setMetrics(data);
            } catch {
                if (!cancelled) setMetrics(null);
            }
        };

        if (currentHostConfig?.id) {
            fetchStatus();
            fetchMetrics();
            intervalId = window.setInterval(() => {
                fetchStatus();
                fetchMetrics();
            }, 10_000);
        }

        return () => {
            cancelled = true;
            if (intervalId) window.clearInterval(intervalId);
        };
    }, [currentHostConfig?.id]);

    // Fetch tunnel statuses
    const fetchTunnelStatuses = React.useCallback(async () => {
        try {
            const statusData = await getTunnelStatuses();
            setTunnelStatuses(statusData);
        } catch (error) {
            // Handle error silently (like desktop)
        }
    }, []);

    React.useEffect(() => {
        fetchTunnelStatuses();
        const interval = setInterval(fetchTunnelStatuses, 500); // Match desktop refresh rate
        return () => clearInterval(interval);
    }, [fetchTunnelStatuses]);

    const handleTunnelAction = async (action: 'connect' | 'disconnect' | 'cancel', host: any, tunnelIndex: number) => {
        const tunnel = host.tunnelConnections[tunnelIndex];
        const tunnelName = `${host.name || `${host.username}@${host.ip}`}_${tunnel.sourcePort}_${tunnel.endpointPort}`;

        setTunnelActions(prev => ({...prev, [tunnelName]: true}));

        try {
            if (action === 'connect') {
                const endpointHost = allHosts.find(h =>
                    h.name === tunnel.endpointHost ||
                    `${h.username}@${h.ip}` === tunnel.endpointHost
                );

                if (!endpointHost) {
                    throw new Error('Endpoint host not found');
                }

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
                    retryInterval: tunnel.retryInterval * 1000,
                    autoStart: tunnel.autoStart,
                    isPinned: host.pin
                };

                await connectTunnel(tunnelConfig);
            } else if (action === 'disconnect') {
                await disconnectTunnel(tunnelName);
            } else if (action === 'cancel') {
                await cancelTunnel(tunnelName);
            }

            // Refresh tunnel statuses immediately after action (like desktop)
            await fetchTunnelStatuses();
        } catch (err) {
            // Handle error silently (like desktop)
        } finally {
            setTunnelActions(prev => ({...prev, [tunnelName]: false}));
        }
    };

    const getTunnelStatus = (tunnelIndex: number): TunnelStatus | undefined => {
        const tunnel = currentHostConfig?.tunnelConnections?.[tunnelIndex];
        if (!tunnel) return undefined;
        const tunnelName = `${currentHostConfig.name || `${currentHostConfig.username}@${currentHostConfig.ip}`}_${tunnel.sourcePort}_${tunnel.endpointPort}`;
        return tunnelStatuses[tunnelName];
    };

    const getTunnelStatusDisplay = (status: TunnelStatus | undefined) => {
        if (!status) return {
            icon: <WifiOff className="h-4 w-4"/>,
            text: 'Unknown',
            color: 'text-gray-400',
            bgColor: 'bg-muted/50',
            borderColor: 'border-border'
        };

        const statusValue = status.status || 'DISCONNECTED';

        switch (statusValue.toUpperCase()) {
            case 'CONNECTED':
                return {
                    icon: <Wifi className="h-4 w-4"/>,
                    text: 'Connected',
                    color: 'text-green-600 dark:text-green-400',
                    bgColor: 'bg-green-500/10 dark:bg-green-400/10',
                    borderColor: 'border-green-500/20 dark:border-green-400/20'
                };
            case 'CONNECTING':
                return {
                    icon: <Loader2 className="h-4 w-4 animate-spin"/>,
                    text: 'Connecting...',
                    color: 'text-blue-600 dark:text-blue-400',
                    bgColor: 'bg-blue-500/10 dark:bg-blue-400/10',
                    borderColor: 'border-blue-500/20 dark:border-blue-400/20'
                };
            case 'DISCONNECTING':
                return {
                    icon: <Loader2 className="h-4 w-4 animate-spin"/>,
                    text: 'Disconnecting...',
                    color: 'text-orange-600 dark:text-orange-400',
                    bgColor: 'bg-orange-500/10 dark:bg-orange-400/10',
                    borderColor: 'border-orange-500/20 dark:border-orange-400/20'
                };
            case 'DISCONNECTED':
                return {
                    icon: <WifiOff className="h-4 w-4"/>,
                    text: 'Disconnected',
                    color: 'text-muted-foreground',
                    bgColor: 'bg-muted/30',
                    borderColor: 'border-border'
                };
            case 'WAITING':
                return {
                    icon: <Clock className="h-4 w-4"/>,
                    text: `Waiting (${status.nextRetryIn}s)`,
                    color: 'text-blue-600 dark:text-blue-400',
                    bgColor: 'bg-blue-500/10 dark:bg-blue-400/10',
                    borderColor: 'border-blue-500/20 dark:border-blue-400/20'
                };
            case 'RETRYING':
                return {
                    icon: <Clock className="h-4 w-4"/>,
                    text: `Retrying (${status.retryCount}/${status.maxRetries})`,
                    color: 'text-orange-600 dark:text-orange-400',
                    bgColor: 'bg-orange-500/10 dark:bg-orange-400/10',
                    borderColor: 'border-orange-500/20 dark:border-orange-400/20'
                };
            case 'FAILED':
                return {
                    icon: <AlertCircle className="h-4 w-4"/>,
                    text: status.reason || 'Failed',
                    color: 'text-red-600 dark:text-red-400',
                    bgColor: 'bg-red-500/10 dark:bg-red-400/10',
                    borderColor: 'border-red-500/20 dark:border-red-400/20'
                };
            default:
                return {
                    icon: <WifiOff className="h-4 w-4"/>,
                    text: statusValue,
                    color: 'text-muted-foreground',
                    bgColor: 'bg-muted/30',
                    borderColor: 'border-border'
                };
        }
    };

    return (
        <div className="h-full w-full bg-[#18181b] text-white overflow-hidden">
            <div className="h-full w-full flex flex-col">

                {/* Top Header */}
                <div className="flex items-center justify-between px-4 pt-3 pb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <h1 className="font-bold text-lg truncate">
                            {currentHostConfig?.folder} / {currentHostConfig?.name || `${currentHostConfig?.username}@${currentHostConfig?.ip}`}
                        </h1>
                        <Status status={serverStatus} className="!bg-transparent !p-0.75 flex-shrink-0">
                            <StatusIndicator/>
                        </Status>
                    </div>
                    <div className="flex items-center flex-shrink-0">
                        {currentHostConfig?.enableFileManager && onSelectView && (
                            <Button
                                variant="outline"
                                className="font-semibold text-sm px-3 py-2"
                                onClick={() => {
                                    if (!currentHostConfig || !onSelectView) return;
                                    onSelectView('file_manager', currentHostConfig);
                                }}
                            >
                                <File className="h-4 w-4 mr-2" />
                                Files
                            </Button>
                        )}
                    </div>
                </div>
                <Separator className="p-0.25 w-full"/>

                {/* Stats - Mobile optimized with stacked layout */}
                <div className="m-4 space-y-3">
                    {/* CPU */}
                    <div className="rounded-lg border-2 border-[#303032] bg-[#0e0e10] p-3">
                        <h2 className="font-bold text-base flex flex-row gap-2 mb-3 items-center">
                            <Cpu className="h-5 w-5"/>
                            <span className="text-sm">
                                {(() => {
                                    const pct = metrics?.cpu?.percent;
                                    const cores = metrics?.cpu?.cores;
                                    const la = metrics?.cpu?.load;
                                    const pctText = (typeof pct === 'number') ? `${pct}%` : 'N/A';
                                    const coresText = (typeof cores === 'number') ? `${cores} CPU(s)` : 'N/A CPU(s)';
                                    const laText = (la && la.length === 3)
                                        ? `Avg: ${la[0].toFixed(2)}, ${la[1].toFixed(2)}, ${la[2].toFixed(2)}`
                                        : 'Avg: N/A';
                                    return `CPU Usage - ${pctText} of ${coresText} (${laText})`;
                                })()}
                            </span>
                        </h2>
                        <Progress value={typeof metrics?.cpu?.percent === 'number' ? metrics!.cpu!.percent! : 0}/>
                    </div>

                    {/* Memory */}
                    <div className="rounded-lg border-2 border-[#303032] bg-[#0e0e10] p-3">
                        <h2 className="font-bold text-base flex flex-row gap-2 mb-3 items-center">
                            <MemoryStick className="h-5 w-5"/>
                            <span className="text-sm">
                                {(() => {
                                    const pct = metrics?.memory?.percent;
                                    const used = metrics?.memory?.usedGiB;
                                    const total = metrics?.memory?.totalGiB;
                                    const pctText = (typeof pct === 'number') ? `${pct}%` : 'N/A';
                                    const usedText = (typeof used === 'number') ? `${used} GiB` : 'N/A';
                                    const totalText = (typeof total === 'number') ? `${total} GiB` : 'N/A';
                                    return `Memory Usage - ${pctText} (${usedText} of ${totalText})`;
                                })()}
                            </span>
                        </h2>
                        <Progress value={typeof metrics?.memory?.percent === 'number' ? metrics!.memory!.percent! : 0}/>
                    </div>

                    {/* HDD */}
                    <div className="rounded-lg border-2 border-[#303032] bg-[#0e0e10] p-3">
                        <h2 className="font-bold text-base flex flex-row gap-2 mb-3 items-center">
                            <HardDrive className="h-5 w-5"/>
                            <span className="text-sm">
                                {(() => {
                                    const pct = metrics?.disk?.percent;
                                    const used = metrics?.disk?.usedHuman;
                                    const total = metrics?.disk?.totalHuman;
                                    const pctText = (typeof pct === 'number') ? `${pct}%` : 'N/A';
                                    const usedText = used ?? 'N/A';
                                    const totalText = total ?? 'N/A';
                                    return `HDD Space - ${pctText} (${usedText} of ${totalText})`;
                                })()}
                            </span>
                        </h2>
                        <Progress value={typeof metrics?.disk?.percent === 'number' ? metrics!.disk!.percent! : 0}/>
                    </div>
                </div>

                {/* SSH Tunnels - Full mobile support */}
                {currentHostConfig?.tunnelConnections && currentHostConfig.tunnelConnections.length > 0 && (
                    <div className="mx-4 mb-4">
                        <div className="rounded-lg border-2 border-[#303032] bg-[#0e0e10] p-3">
                            <h3 className="font-semibold text-base mb-3">SSH Tunnels</h3>
                            <div className="space-y-3 max-h-64 overflow-y-auto">
                                {currentHostConfig.tunnelConnections.map((tunnel: TunnelConnection, idx: number) => {
                                    const status = getTunnelStatus(idx);
                                    const statusDisplay = getTunnelStatusDisplay(status);
                                    const tunnelName = `${currentHostConfig.name || `${currentHostConfig.username}@${currentHostConfig.ip}`}_${tunnel.sourcePort}_${tunnel.endpointPort}`;
                                    const isActionLoading = tunnelActions[tunnelName];
                                    const statusValue = status?.status?.toUpperCase() || 'DISCONNECTED';
                                    const isConnected = statusValue === 'CONNECTED';
                                    const isConnecting = statusValue === 'CONNECTING';
                                    const isDisconnecting = statusValue === 'DISCONNECTING';
                                    const isRetrying = statusValue === 'RETRYING';
                                    const isWaiting = statusValue === 'WAITING';

                                    return (
                                        <div key={`tunnel-${idx}`} className={`border rounded-lg p-3 min-w-0 ${statusDisplay.bgColor} ${statusDisplay.borderColor}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                                    <span className={`${statusDisplay.color} mt-0.5 flex-shrink-0`}>
                                                        {statusDisplay.icon}
                                                    </span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-medium break-words">
                                                            Port {tunnel.sourcePort} → {tunnel.endpointHost}:{tunnel.endpointPort}
                                                        </div>
                                                        <div className={`text-xs ${statusDisplay.color} font-medium`}>
                                                            {statusDisplay.text}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-1 flex-shrink-0 min-w-[120px]">
                                                    {!isActionLoading ? (
                                                        <div className="flex flex-col gap-1">
                                                            {isConnected ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleTunnelAction('disconnect', currentHostConfig, idx)}
                                                                    className="h-7 px-2 text-red-600 dark:text-red-400 border-red-500/30 dark:border-red-400/30 hover:bg-red-500/10 dark:hover:bg-red-400/10 hover:border-red-500/50 dark:hover:border-red-400/50 text-xs"
                                                                >
                                                                    <Square className="h-3 w-3 mr-1"/>
                                                                    Disconnect
                                                                </Button>
                                                            ) : isRetrying || isWaiting ? (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleTunnelAction('cancel', currentHostConfig, idx)}
                                                                    className="h-7 px-2 text-orange-600 dark:text-orange-400 border-orange-500/30 dark:border-orange-400/30 hover:bg-orange-500/10 dark:hover:bg-orange-400/10 hover:border-orange-500/50 dark:hover:border-orange-400/50 text-xs"
                                                                >
                                                                    <X className="h-3 w-3 mr-1"/>
                                                                    Cancel
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleTunnelAction('connect', currentHostConfig, idx)}
                                                                    disabled={isConnecting || isDisconnecting}
                                                                    className="h-7 px-2 text-green-600 dark:text-green-400 border-green-500/30 dark:border-green-400/30 hover:bg-green-500/10 dark:hover:bg-green-400/10 hover:border-green-500/50 dark:hover:border-green-400/50 text-xs"
                                                                >
                                                                    <Play className="h-3 w-3 mr-1"/>
                                                                    Connect
                                                                </Button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            disabled
                                                            className="h-7 px-2 text-muted-foreground border-border text-xs"
                                                        >
                                                            <Loader2 className="h-3 w-3 mr-1 animate-spin"/>
                                                            {isConnected ? 'Disconnecting...' : isRetrying || isWaiting ? 'Canceling...' : 'Connecting...'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            {(statusValue === 'ERROR' || statusValue === 'FAILED') && status?.reason && (
                                                <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-500/10 dark:bg-red-400/10 rounded px-3 py-2 border border-red-500/20 dark:border-red-400/20">
                                                    <div className="font-medium mb-1">Error:</div>
                                                    {status.reason}
                                                </div>
                                            )}

                                            {(statusValue === 'RETRYING' || statusValue === 'WAITING') && status?.retryCount && status?.maxRetries && (
                                                <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-500/10 dark:bg-yellow-400/10 rounded px-3 py-2 border border-yellow-500/20 dark:border-yellow-400/20">
                                                    <div className="font-medium mb-1">
                                                        {statusValue === 'WAITING' ? 'Waiting for retry' : 'Retrying connection'}
                                                    </div>
                                                    <div>
                                                        Attempt {status.retryCount} of {status.maxRetries}
                                                        {status.nextRetryIn && (
                                                            <span> • Next retry in {status.nextRetryIn} seconds</span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
