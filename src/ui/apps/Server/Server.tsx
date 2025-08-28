import React from "react";
import {useSidebar} from "@/components/ui/sidebar";
import {Status, StatusIndicator} from "@/components/ui/shadcn-io/status";
import {Separator} from "@/components/ui/separator.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Progress} from "@/components/ui/progress"
import {Cpu, HardDrive, MemoryStick} from "lucide-react";
import {Tunnel} from "@/ui/apps/Tunnel/Tunnel.tsx";
import {getServerStatusById, getServerMetricsById, ServerMetrics} from "@/ui/main-axios.ts";
import {useTabs} from "@/ui/Navigation/Tabs/TabContext.tsx";

interface ServerProps {
    hostConfig?: any;
    title?: string;
    isVisible?: boolean;
    isTopbarOpen?: boolean;
    embedded?: boolean;
}

export function Server({
                           hostConfig,
                           title,
                           isVisible = true,
                           isTopbarOpen = true,
                           embedded = false
                       }: ServerProps): React.ReactElement {
    const {state: sidebarState} = useSidebar();
    const {addTab, tabs} = useTabs() as any;
    const [serverStatus, setServerStatus] = React.useState<'online' | 'offline'>('offline');
    const [metrics, setMetrics] = React.useState<ServerMetrics | null>(null);
    const [currentHostConfig, setCurrentHostConfig] = React.useState(hostConfig);

    React.useEffect(() => {
        setCurrentHostConfig(hostConfig);
    }, [hostConfig]);

    React.useEffect(() => {
        const fetchLatestHostConfig = async () => {
            if (hostConfig?.id) {
                try {
                    const {getSSHHosts} = await import('@/ui/main-axios.ts');
                    const hosts = await getSSHHosts();
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

        if (currentHostConfig?.id && isVisible) {
            fetchStatus();
            fetchMetrics();
            // Only poll when component is visible to reduce unnecessary connections
            intervalId = window.setInterval(() => {
                if (isVisible) {
                    fetchStatus();
                    fetchMetrics();
                }
            }, 300_000); // 5 minutes instead of 10 seconds
        }

        return () => {
            cancelled = true;
            if (intervalId) window.clearInterval(intervalId);
        };
    }, [currentHostConfig?.id, isVisible]);

    const topMarginPx = isTopbarOpen ? 74 : 16;
    const leftMarginPx = sidebarState === 'collapsed' ? 16 : 8;
    const bottomMarginPx = 8;

    // Check if a file manager tab for this host is already open
    const isFileManagerAlreadyOpen = React.useMemo(() => {
        if (!currentHostConfig) return false;
        return tabs.some((tab: any) => 
            tab.type === 'file_manager' && 
            tab.hostConfig?.id === currentHostConfig.id
        );
    }, [tabs, currentHostConfig]);

    const wrapperStyle: React.CSSProperties = embedded
        ? {opacity: isVisible ? 1 : 0, height: '100%', width: '100%'}
        : {
            opacity: isVisible ? 1 : 0,
            marginLeft: leftMarginPx,
            marginRight: 17,
            marginTop: topMarginPx,
            marginBottom: bottomMarginPx,
            height: `calc(100vh - ${topMarginPx + bottomMarginPx}px)`,
        };

    const containerClass = embedded
        ? "h-full w-full text-white overflow-hidden bg-transparent"
        : "bg-[#18181b] text-white rounded-lg border-2 border-[#303032] overflow-hidden";

    return (
        <div style={wrapperStyle} className={containerClass}>
            <div className="h-full w-full flex flex-col">

                {/* Top Header */}
                <div className="flex items-center justify-between px-3 pt-2 pb-2">
                    <div className="flex items-center gap-4">
                        <h1 className="font-bold text-lg">
                            {currentHostConfig?.folder} / {title}
                        </h1>
                        <Status status={serverStatus} className="!bg-transparent !p-0.75 flex-shrink-0">
                            <StatusIndicator/>
                        </Status>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            onClick={async () => {
                                if (currentHostConfig?.id) {
                                    try {
                                        const res = await getServerStatusById(currentHostConfig.id);
                                        setServerStatus(res?.status === 'online' ? 'online' : 'offline');
                                        const data = await getServerMetricsById(currentHostConfig.id);
                                        setMetrics(data);
                                    } catch {
                                        setServerStatus('offline');
                                        setMetrics(null);
                                    }
                                }
                            }}
                            title="Refresh status and metrics"
                        >
                            Refresh
                        </Button>
                        {currentHostConfig?.enableFileManager && (
                            <Button
                                variant="outline"
                                className="font-semibold"
                                disabled={isFileManagerAlreadyOpen}
                                title={isFileManagerAlreadyOpen ? "File Manager already open for this host" : "Open File Manager"}
                                onClick={() => {
                                    if (!currentHostConfig || isFileManagerAlreadyOpen) return;
                                    const titleBase = currentHostConfig?.name && currentHostConfig.name.trim() !== ''
                                        ? currentHostConfig.name.trim()
                                        : `${currentHostConfig.username}@${currentHostConfig.ip}`;
                                    addTab({
                                        type: 'file_manager',
                                        title: titleBase,
                                        hostConfig: currentHostConfig,
                                    });
                                }}
                            >
                                File Manager
                            </Button>
                        )}
                    </div>
                </div>
                <Separator className="p-0.25 w-full"/>

                {/* Stats */}
                <div className="rounded-lg border-2 border-[#303032] m-3 bg-[#0e0e10] flex flex-row items-stretch">
                    {/* CPU */}
                    <div className="flex-1 min-w-0 px-2 py-2">
                        <h1 className="font-bold xt-lg flex flex-row gap-2 mb-2">
                            <Cpu/>
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
                        </h1>

                        <Progress value={typeof metrics?.cpu?.percent === 'number' ? metrics!.cpu!.percent! : 0}/>
                    </div>

                    <Separator className="p-0.5 self-stretch" orientation="vertical"/>

                    {/* Memory */}
                    <div className="flex-1 min-w-0 px-2 py-2">
                        <h1 className="font-bold xt-lg flex flex-row gap-2 mb-2">
                            <MemoryStick/>
                            {(() => {
                                const pct = metrics?.memory?.percent;
                                const used = metrics?.memory?.usedGiB;
                                const total = metrics?.memory?.totalGiB;
                                const pctText = (typeof pct === 'number') ? `${pct}%` : 'N/A';
                                const usedText = (typeof used === 'number') ? `${used} GiB` : 'N/A';
                                const totalText = (typeof total === 'number') ? `${total} GiB` : 'N/A';
                                return `Memory Usage - ${pctText} (${usedText} of ${totalText})`;
                            })()}
                        </h1>

                        <Progress value={typeof metrics?.memory?.percent === 'number' ? metrics!.memory!.percent! : 0}/>
                    </div>

                    <Separator className="p-0.5 self-stretch" orientation="vertical"/>

                    {/* Root Storage */}
                    <div className="flex-1 min-w-0 px-2 py-2">
                        <h1 className="font-bold xt-lg flex flex-row gap-2 mb-2">
                            <HardDrive/>
                            {(() => {
                                const pct = metrics?.disk?.percent;
                                const used = metrics?.disk?.usedHuman;
                                const total = metrics?.disk?.totalHuman;
                                const pctText = (typeof pct === 'number') ? `${pct}%` : 'N/A';
                                const usedText = used ?? 'N/A';
                                const totalText = total ?? 'N/A';
                                return `Root Storage Space - ${pctText} (${usedText} of ${totalText})`;
                            })()}
                        </h1>

                        <Progress value={typeof metrics?.disk?.percent === 'number' ? metrics!.disk!.percent! : 0}/>
                    </div>
                </div>

                {/* SSH Tunnels */}
                {(currentHostConfig?.tunnelConnections && currentHostConfig.tunnelConnections.length > 0) && (
                    <div
                        className="rounded-lg border-2 border-[#303032] m-3 bg-[#0e0e10] h-[360px] overflow-hidden flex flex-col min-h-0">
                        <Tunnel
                            filterHostKey={(currentHostConfig?.name && currentHostConfig.name.trim() !== '') ? currentHostConfig.name : `${currentHostConfig?.username}@${currentHostConfig?.ip}`}/>
                    </div>
                )}

                <p className="px-4 pt-2 pb-2 text-sm text-gray-500">
                    Have ideas for what should come next for server management? Share them on{" "}
                    <a
                        href="https://github.com/LukeGus/Termix/issues/new"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                    >
                        GitHub
                    </a>
                    !
                </p>
            </div>
        </div>
    );
}
