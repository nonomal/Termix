import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Edit, Trash2 } from "lucide-react";

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

interface SSHTunnelObjectProps {
    hostConfig: any;
    onConnect?: () => void;
    onDisconnect?: () => void;
    onDelete?: () => void;
    onEdit?: () => void;
    connectionState?: keyof typeof CONNECTION_STATES;
    isPinned?: boolean;
}

export function SSHTunnelObject({ 
    hostConfig = {}, 
    onConnect, 
    onDisconnect, 
    onDelete,
    onEdit,
    connectionState = "DISCONNECTED",
    isPinned = false
}: SSHTunnelObjectProps): React.ReactElement {
    const getStatusColor = (state: keyof typeof CONNECTION_STATES) => {
        switch (state) {
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

    const getStatusText = (state: keyof typeof CONNECTION_STATES) => {
        switch (state) {
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



    const isConnected = connectionState === "CONNECTED";
    const isConnecting = ["CONNECTING", "VERIFYING", "RETRYING"].includes(connectionState);
    const isDisconnecting = connectionState === "DISCONNECTING";

    return (
        <Card className="w-full bg-card border-border shadow-sm hover:shadow-md transition-shadow relative group p-0">
            {/* Hover overlay buttons */}
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex gap-1">
                <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70 border-0"
                    onClick={onEdit}
                >
                    <Edit className="w-4 h-4" />
                </Button>
                <Button
                    size="sm"
                    variant="destructive"
                    className="h-8 w-8 p-0 bg-red-500/50 hover:bg-red-500/70 border-0"
                    onClick={onDelete}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            <div className="p-2">
                <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="text-lg font-semibold text-card-foreground flex-1 min-w-0">
                        <span className="break-words">
                            {isPinned && <span className="text-yellow-400 mr-1 flex-shrink-0">★</span>}
                            {hostConfig.name || "My SSH Tunnel"}
                        </span>
                    </div>
                    <div className="w-px h-4 bg-border mx-1"></div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <div className={`w-2 h-2 rounded-full ${getStatusColor(connectionState)}`} />
                        <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {getStatusText(connectionState)}
                        </span>
                    </div>
                </div>
                
                <Separator className="mb-1" />
                <div className="space-y-1 mb-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex-shrink-0 mr-2">Source:</span>
                        <span className="text-card-foreground font-mono text-right break-all">
                            {hostConfig.source || "localhost:22"}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex-shrink-0 mr-2">Endpoint:</span>
                        <span className="text-card-foreground font-mono text-right break-all">
                            {hostConfig.endpoint || "test:224"}
                        </span>
                    </div>
                </div>
                
                <Separator className="my-1" />
                {/* Error/Status Reason */}
                {((connectionState === "FAILED" || connectionState === "UNSTABLE") && hostConfig.statusReason) && (
                    <div className="mb-2 text-xs text-red-500 bg-red-500/10 rounded px-2 py-1 border border-red-500/20">
                        {hostConfig.statusReason}
                        {typeof hostConfig.statusReason === 'string' && hostConfig.statusReason.includes('Max retries exhausted') && (
                            <>
                                <br />
                                <span>
                                    Check your Docker logs for the error reason, join the <a href="https://discord.com/invite/jVQGdvHDrf" target="_blank" rel="noopener noreferrer" className="underline text-blue-400">Discord</a> or create a <a href="https://github.com/LukeGus/Termix/issues/new" target="_blank" rel="noopener noreferrer" className="underline text-blue-400">GitHub issue</a> for help.
                                </span>
                            </>
                        )}
                    </div>
                )}
                <div className="flex gap-2 mt-2">
                    <Button 
                        onClick={onConnect}
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
                        onClick={onDisconnect}
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