import React, {useState} from 'react';

import {
    CornerDownLeft,
    Hammer, Pin
} from "lucide-react"

import {
    Button
} from "@/components/ui/button.tsx"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem, SidebarProvider,
} from "@/components/ui/sidebar.tsx"

import {
    Separator,
} from "@/components/ui/separator.tsx"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from "@/components/ui/sheet.tsx";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion.tsx";
import {ScrollArea} from "@/components/ui/scroll-area.tsx";
import {Input} from "@/components/ui/input.tsx";
import {getSSHHosts} from "@/apps/SSH/ssh-axios";

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
    tunnelConnections: any[];
    createdAt: string;
    updatedAt: string;
}

interface SidebarProps {
    onSelectView: (view: string) => void;
    onHostConnect: (hostConfig: any) => void;
    allTabs: { id: number; title: string; terminalRef: React.RefObject<any> }[];
    runCommandOnTabs: (tabIds: number[], command: string) => void;
}

export function SSHSidebar({onSelectView, onHostConnect, allTabs, runCommandOnTabs}: SidebarProps): React.ReactElement {
    const [hosts, setHosts] = useState<SSHHost[]>([]);
    const [hostsLoading, setHostsLoading] = useState(false);
    const [hostsError, setHostsError] = useState<string | null>(null);
    const prevHostsRef = React.useRef<SSHHost[]>([]);

    const fetchHosts = React.useCallback(async () => {
        setHostsLoading(true);
        setHostsError(null);
        try {
            const newHosts = await getSSHHosts();
            const terminalHosts = newHosts.filter(host => host.enableTerminal);

            const prevHosts = prevHostsRef.current;
            const isSame =
                terminalHosts.length === prevHosts.length &&
                terminalHosts.every((h: SSHHost, i: number) => {
                    const prev = prevHosts[i];
                    if (!prev) return false;
                    return (
                        h.id === prev.id &&
                        h.name === prev.name &&
                        h.folder === prev.folder &&
                        h.ip === prev.ip &&
                        h.port === prev.port &&
                        h.username === prev.username &&
                        h.password === prev.password &&
                        h.authType === prev.authType &&
                        h.key === prev.key &&
                        h.pin === prev.pin &&
                        JSON.stringify(h.tags) === JSON.stringify(prev.tags)
                    );
                });
            if (!isSame) {
                setHosts(terminalHosts);
                prevHostsRef.current = terminalHosts;
            }
        } catch (err: any) {
            setHostsError('Failed to load hosts');
        } finally {
            setHostsLoading(false);
        }
    }, []);

    React.useEffect(() => {
        fetchHosts();
        const interval = setInterval(fetchHosts, 10000);
        return () => clearInterval(interval);
    }, [fetchHosts]);

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    React.useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearch(search), 200);
        return () => clearTimeout(handler);
    }, [search]);

    const filteredHosts = React.useMemo(() => {
        if (!debouncedSearch.trim()) return hosts;
        const q = debouncedSearch.trim().toLowerCase();
        return hosts.filter(h => {
            const searchableText = [
                h.name || '',
                h.username,
                h.ip,
                h.folder || '',
                ...(h.tags || []),
                h.authType,
                h.defaultPath || ''
            ].join(' ').toLowerCase();
            return searchableText.includes(q);
        });
    }, [hosts, debouncedSearch]);

    const hostsByFolder = React.useMemo(() => {
        const map: Record<string, SSHHost[]> = {};
        filteredHosts.forEach(h => {
            const folder = h.folder && h.folder.trim() ? h.folder : 'No Folder';
            if (!map[folder]) map[folder] = [];
            map[folder].push(h);
        });
        return map;
    }, [filteredHosts]);

    const sortedFolders = React.useMemo(() => {
        const folders = Object.keys(hostsByFolder);
        folders.sort((a, b) => {
            if (a === 'No Folder') return -1;
            if (b === 'No Folder') return 1;
            return a.localeCompare(b);
        });
        return folders;
    }, [hostsByFolder]);

    const getSortedHosts = (arr: SSHHost[]) => {
        const pinned = arr.filter(h => h.pin).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        const rest = arr.filter(h => !h.pin).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        return [...pinned, ...rest];
    };

    const [toolsSheetOpen, setToolsSheetOpen] = useState(false);
    const [toolsCommand, setToolsCommand] = useState("");
    const [selectedTabIds, setSelectedTabIds] = useState<number[]>([]);

    const handleTabToggle = (tabId: number) => {
        setSelectedTabIds(prev => prev.includes(tabId) ? prev.filter(id => id !== tabId) : [...prev, tabId]);
    };

    const handleRunCommand = () => {
        if (selectedTabIds.length && toolsCommand.trim()) {
            let cmd = toolsCommand;
            if (!cmd.endsWith("\n")) cmd += "\n";
            runCommandOnTabs(selectedTabIds, cmd);
            setToolsCommand("");
        }
    };

    return (
        <SidebarProvider>
            <Sidebar className="h-full flex flex-col overflow-hidden">
                <SidebarContent className="flex flex-col flex-grow h-full overflow-hidden">
                    <SidebarGroup className="flex flex-col flex-grow h-full overflow-hidden">
                        <SidebarGroupLabel className="text-lg font-bold text-white flex items-center gap-2">
                            Termix / Terminal
                        </SidebarGroupLabel>
                        <Separator className="p-0.25 mt-1 mb-1"/>
                        <SidebarGroupContent className="flex flex-col flex-grow h-full overflow-hidden">
                            <SidebarMenu className="flex flex-col flex-grow h-full overflow-hidden">

                                <SidebarMenuItem key="Homepage">
                                    <Button
                                        className="w-full mt-2 mb-2 h-8"
                                        onClick={() => onSelectView("homepage")}
                                        variant="outline"
                                    >
                                        <CornerDownLeft/>
                                        Return
                                    </Button>
                                    <Separator className="p-0.25 mt-1 mb-1"/>
                                </SidebarMenuItem>

                                <SidebarMenuItem key="Main" className="flex flex-col flex-grow overflow-hidden">
                                    <div
                                        className="w-full flex-grow rounded-md bg-[#09090b] border border-[#434345] overflow-hidden p-0 m-0 relative flex flex-col min-h-0">
                                        <div className="w-full px-2 pt-2 pb-2 bg-[#09090b] z-10">
                                            <Input
                                                value={search}
                                                onChange={e => setSearch(e.target.value)}
                                                placeholder="Search hosts by name, username, IP, folder, tags..."
                                                className="w-full h-8 text-sm bg-background border border-border rounded"
                                                autoComplete="off"
                                            />
                                        </div>
                                        <div style={{display: 'flex', justifyContent: 'center'}}>
                                            <Separator className="w-full h-px bg-[#434345] my-2"
                                                       style={{maxWidth: 213, margin: '0 auto'}}/>
                                        </div>
                                        {hostsError && (
                                            <div className="px-2 py-1 mt-2">
                                                <div
                                                    className="text-xs text-red-500 bg-red-500/10 rounded px-2 py-1 border border-red-500/20">{hostsError}</div>
                                            </div>
                                        )}
                                        <div className="flex-1 min-h-0">
                                            <ScrollArea className="w-full h-full">
                                                <Accordion key={`host-accordion-${sortedFolders.length}`}
                                                           type="multiple" className="w-full"
                                                           defaultValue={sortedFolders.length > 0 ? sortedFolders : undefined}>
                                                    {sortedFolders.map((folder, idx) => (
                                                        <React.Fragment key={folder}>
                                                            <AccordionItem value={folder}
                                                                           className={idx === 0 ? "mt-0 !border-b-transparent" : "mt-2 !border-b-transparent"}>
                                                                <AccordionTrigger
                                                                    className="text-base font-semibold rounded-t-none px-3 py-2"
                                                                    style={{marginTop: idx === 0 ? 0 : undefined}}>{folder}</AccordionTrigger>
                                                                <AccordionContent
                                                                    className="flex flex-col gap-1 px-3 pb-2 pt-1">
                                                                    {getSortedHosts(hostsByFolder[folder]).map(host => (
                                                                        <div key={host.id}
                                                                             className="w-full overflow-hidden">
                                                                            <HostMenuItem
                                                                                host={host}
                                                                                onHostConnect={onHostConnect}
                                                                            />
                                                                        </div>
                                                                    ))}
                                                                </AccordionContent>
                                                            </AccordionItem>
                                                            {idx < sortedFolders.length - 1 && (
                                                                <div
                                                                    style={{display: 'flex', justifyContent: 'center'}}>
                                                                    <Separator className="h-px bg-[#434345] my-1"
                                                                               style={{width: 213}}/>
                                                                </div>
                                                            )}
                                                        </React.Fragment>
                                                    ))}
                                                </Accordion>
                                            </ScrollArea>
                                        </div>
                                    </div>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                        <div className="bg-sidebar">
                            <Sheet open={toolsSheetOpen} onOpenChange={setToolsSheetOpen}>
                                <SheetTrigger asChild>
                                    <Button
                                        className="w-full h-8 mt-2"
                                        variant="outline"
                                        onClick={() => setToolsSheetOpen(true)}
                                    >
                                        <Hammer className="mr-2 h-4 w-4"/>
                                        Tools
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left"
                                              className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col">
                                    <SheetHeader className="pb-0.5">
                                        <SheetTitle>Tools</SheetTitle>
                                    </SheetHeader>
                                    <div className="flex-1 overflow-y-auto px-2 pt-2">
                                        <Accordion type="single" collapsible defaultValue="multiwindow">
                                            <AccordionItem value="multiwindow">
                                                <AccordionTrigger className="text-base font-semibold">Run multiwindow
                                                    commands</AccordionTrigger>
                                                <AccordionContent>
                                                    <textarea
                                                        className="w-full min-h-[120px] max-h-48 rounded-md border border-input text-foreground p-2 text-sm font-mono resize-vertical focus:outline-none focus:ring-0"
                                                        placeholder="Enter command(s) to run on selected tabs..."
                                                        value={toolsCommand}
                                                        onChange={e => setToolsCommand(e.target.value)}
                                                        style={{
                                                            fontFamily: 'monospace',
                                                            marginBottom: 8,
                                                            background: '#141416'
                                                        }}
                                                    />
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        {allTabs.map(tab => (
                                                            <Button
                                                                key={tab.id}
                                                                type="button"
                                                                variant={selectedTabIds.includes(tab.id) ? "secondary" : "outline"}
                                                                size="sm"
                                                                className="rounded-full px-3 py-1 text-xs flex items-center gap-1"
                                                                onClick={() => handleTabToggle(tab.id)}
                                                            >
                                                                {tab.title}
                                                            </Button>
                                                        ))}
                                                    </div>
                                                    <Button
                                                        className="w-full"
                                                        variant="outline"
                                                        onClick={handleRunCommand}
                                                        disabled={!toolsCommand.trim() || !selectedTabIds.length}
                                                    >
                                                        Run Command
                                                    </Button>
                                                </AccordionContent>
                                            </AccordionItem>
                                        </Accordion>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        </div>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
        </SidebarProvider>
    );
}

const HostMenuItem = React.memo(function HostMenuItem({host, onHostConnect}: {
    host: SSHHost;
    onHostConnect: (hostConfig: any) => void
}) {
    const tags = Array.isArray(host.tags) ? host.tags : [];
    const hasTags = tags.length > 0;
    return (
        <div className="relative group flex flex-col mb-1 w-full overflow-hidden">
            <div className={`flex flex-col w-full rounded overflow-hidden border border-[#434345] bg-[#18181b] h-full`}>
                <div className="flex w-full h-10">
                    <div
                        className="flex items-center h-full px-2 w-full hover:bg-muted transition-colors cursor-pointer"
                        onClick={() => onHostConnect(host)}
                    >
                        <div className="flex items-center w-full">
                            {host.pin &&
                                <Pin className="h-4.5 mr-1 w-4.5 mt-0.5 text-yellow-500 flex-shrink-0"/>
                            }
                            <span className="font-medium truncate">{host.name || host.ip}</span>
                        </div>
                    </div>
                </div>
                {hasTags && (
                    <div
                        className="border-t border-border bg-[#18181b] flex items-center gap-1 px-2 py-2 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-muted-foreground/30 scrollbar-track-transparent"
                        style={{height: 30}}>
                        {tags.map((tag: string) => (
                            <span key={tag}
                                  className="bg-muted-foreground/10 text-xs rounded-full px-2 py-0.5 text-muted-foreground whitespace-nowrap border border-border flex-shrink-0 hover:bg-muted transition-colors">
                                {tag}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
});