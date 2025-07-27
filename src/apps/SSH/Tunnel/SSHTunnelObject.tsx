import React from "react";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { Loader2, Pin, Terminal, Network, FileEdit, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge.tsx";

const CONNECTION_STATES = {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected",
    VERIFYING: "verifying",
    FAILED: "failed",
    UNSTABLE: "unstable",
    RETRYING: "retrying",
    DISCONNECTING: "disconnecting"
};

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

interface SSHTunnelObjectProps {
    host: SSHHost;
    onConnect?: (hostId: number) => void;
    onDisconnect?: (hostId: number) => void;
    connectionState?: keyof typeof CONNECTION_STATES | string;
    statusReason?: string;
    statusErrorType?: string;
    statusRetryCount?: number;
    statusMaxRetries?: number;
    statusNextRetryIn?: number;
    statusRetryExhausted?: boolean;
}

export function SSHTunnelObject({ 
    host, 
    onConnect, 
    onDisconnect, 
    connectionState = "DISCONNECTED",
    statusReason,
    statusErrorType,
    statusRetryCount,
    statusMaxRetries,
    statusNextRetryIn,
    statusRetryExhausted
}: SSHTunnelObjectProps): React.ReactElement {
    const getStatusColor = (state: string) => {
        const upperState = state.toUpperCase();
        switch (upperState) {
            case "CONNECTED":
                return "bg-green-500";
            case "CONNECTING":
            case "VERIFYING":
            case "RETRYING":
                return "bg-yellow-500";
            case "FAILED":
                return "bg-red-500";
            case "UNSTABLE":
                return "bg-orange-500";
            default:
                return "bg-gray-500";
        }
    };

    const getStatusText = (state: string) => {
        const upperState = state.toUpperCase();
        switch (upperState) {
            case "CONNECTED":
                return "Connected";
            case "CONNECTING":
                return "Connecting";
            case "VERIFYING":
                return "Verifying";
            case "FAILED":
                return "Failed";
            case "UNSTABLE":
                return "Unstable";
            case "RETRYING":
                return "Retrying";
            default:
                return "Disconnected";
        }
    };

    const isConnected = connectionState === "CONNECTED" || connectionState === "connected";
    const isConnecting = ["CONNECTING", "VERIFYING", "RETRYING", "connecting", "verifying", "retrying"].includes(connectionState);
    const isDisconnecting = connectionState === "DISCONNECTING" || connectionState === "disconnecting";

    return (
        <Card className="w-full bg-card border-border shadow-sm hover:shadow-md transition-shadow relative group p-0">
            <div className="p-3">
                {/* Host Header */}
                <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                        {host.pin && <Pin className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-card-foreground truncate">
                                {host.name || `${host.username}@${host.ip}`}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">
                                {host.ip}:{host.port} • {host.username}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(connectionState)}`} />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {getStatusText(connectionState)}
                        </span>
                    </div>
                </div>
                
                {/* Tags */}
                {host.tags && host.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                        {host.tags.slice(0, 3).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs px-1 py-0">
                                <Tag className="h-2 w-2 mr-0.5" />
                                {tag}
                            </Badge>
                        ))}
                        {host.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs px-1 py-0">
                                +{host.tags.length - 3}
                            </Badge>
                        )}
                    </div>
                )}
                
                <Separator className="mb-2" />
                
                {/* Tunnel Connections */}
                <div className="space-y-2 mb-3">
                    <h4 className="text-sm font-medium text-card-foreground">Tunnel Connections</h4>
                    {host.tunnelConnections && host.tunnelConnections.length > 0 ? (
                        <div className="space-y-1">
                            {host.tunnelConnections.map((tunnel, index) => (
                                <div key={index} className="text-xs bg-muted/50 rounded px-2 py-1">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground">Port {tunnel.sourcePort} → {tunnel.endpointHost}:{tunnel.endpointPort}</span>
                                        {tunnel.autoStart && (
                                            <Badge variant="outline" className="text-xs px-1 py-0">
                                                Auto
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted-foreground">No tunnel connections configured</p>
                    )}
                </div>
                
                {/* Error/Status Reason */}
                {((connectionState === "FAILED" || connectionState === "UNSTABLE") && statusReason) && (
                    <div className="mb-2 text-xs text-red-500 bg-red-500/10 rounded px-2 py-1 border border-red-500/20">
                        {statusReason}
                        {statusReason && statusReason.includes('Max retries exhausted') && (
                            <>
                                <br />
                                <span>
                                    Check your Docker logs for the error reason, join the <a href="https://discord.com/invite/jVQGdvHDrf" target="_blank" rel="noopener noreferrer" className="underline text-blue-400">Discord</a> or create a <a href="https://github.com/LukeGus/Termix/issues/new" target="_blank" rel="noopener noreferrer" className="underline text-blue-400">GitHub issue</a> for help.
                                </span>
                            </>
                        )}
                    </div>
                )}
                
                {/* Retry Info */}
                {connectionState === "RETRYING" && statusRetryCount && statusMaxRetries && (
                    <div className="mb-2 text-xs text-yellow-600 bg-yellow-500/10 rounded px-2 py-1 border border-yellow-500/20">
                        Retry {statusRetryCount}/{statusMaxRetries}
                        {statusNextRetryIn && (
                            <span> • Next retry in {statusNextRetryIn}s</span>
                        )}
                    </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Button 
                        onClick={() => onConnect?.(host.id)}
                        disabled={isConnected || isConnecting || isDisconnecting}
                        className="flex-1"
                        variant={isConnected ? "secondary" : "default"}
                    >
                        {isConnecting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Connecting...
                            </>
                        ) : isConnected ? (
                            "Connected"
                        ) : (
                            "Connect"
                        )}
                    </Button>
                    <Button 
                        onClick={() => onDisconnect?.(host.id)}
                        disabled={!isConnected || isDisconnecting || isConnecting}
                        variant="outline"
                        className="flex-1"
                    >
                        {isDisconnecting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Disconnecting...
                            </>
                        ) : (
                            "Disconnect"
                        )}
                    </Button>
                </div>
            </div>
        </Card>
    );
}