import React, {useEffect, useState} from "react";
import {Status, StatusIndicator} from "@/components/ui/shadcn-io/status";
import {Button} from "@/components/ui/button.tsx";
import {ButtonGroup} from "@/components/ui/button-group.tsx";
import {Server, Terminal} from "lucide-react";
import {useTabs} from "@/ui/desktop/Navigation/Tabs/TabContext.tsx";
import {getServerStatusById} from "@/ui/main-axios.ts";

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
    enableFileManager: boolean;
    defaultPath: string;
    tunnelConnections: any[];
    createdAt: string;
    updatedAt: string;
}

interface HostProps {
    host: SSHHost;
}

export function Host({host}: HostProps): React.ReactElement {
    const {addTab} = useTabs();
    const [serverStatus, setServerStatus] = useState<'online' | 'offline'>('offline');
    const tags = Array.isArray(host.tags) ? host.tags : [];
    const hasTags = tags.length > 0;

    const title = host.name?.trim() ? host.name : `${host.username}@${host.ip}:${host.port}`;

    useEffect(() => {
        let cancelled = false;
        let intervalId: number | undefined;

        const fetchStatus = async () => {
            try {
                const res = await getServerStatusById(host.id);
                if (!cancelled) {
                    setServerStatus(res?.status === 'online' ? 'online' : 'offline');
                }
            } catch {
                if (!cancelled) setServerStatus('offline');
            }
        };

        fetchStatus();
        intervalId = window.setInterval(fetchStatus, 60_000);

        return () => {
            cancelled = true;
            if (intervalId) window.clearInterval(intervalId);
        };
    }, [host.id]);

    const handleTerminalClick = () => {
        addTab({type: 'terminal', title, hostConfig: host});
    };

    const handleServerClick = () => {
        addTab({type: 'server', title, hostConfig: host});
    };

    return (
        <div>
            <div className="flex items-center gap-2">
                <Status status={serverStatus} className="!bg-transparent !p-0.75 flex-shrink-0">
                    <StatusIndicator/>
                </Status>
                <p className="font-semibold flex-1 min-w-0 break-words text-sm">
                    {host.name || host.ip}
                </p>
                <ButtonGroup className="flex-shrink-0">
                    <Button variant="outline" className="!px-2 border-1 border-[#303032]" onClick={handleServerClick}>
                        <Server/>
                    </Button>
                    {host.enableTerminal && (
                        <Button
                            variant="outline"
                            className="!px-2 border-1 border-[#303032]"
                            onClick={handleTerminalClick}
                        >
                            <Terminal/>
                        </Button>
                    )}
                </ButtonGroup>
            </div>
            {hasTags && (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                    {tags.map((tag: string) => (
                        <div key={tag} className="bg-[#18181b] border-1 border-[#303032] pl-2 pr-2 rounded-[10px]">
                            <p className="text-sm">{tag}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}