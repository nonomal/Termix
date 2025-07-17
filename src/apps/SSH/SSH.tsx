import React, { useState, useRef } from "react";
import { SSHSidebar } from "@/apps/SSH/SSHSidebar.tsx";
import { SSHTerminal } from "./SSHTerminal.tsx";
import { SSHTopbar } from "@/apps/SSH/SSHTopbar.tsx";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

type Tab = {
    id: number;
    title: string;
    hostConfig: any;
    terminalRef: React.RefObject<any>;
};

function TerminalOverlay({ tabId, splitScreen }: { tabId: number, splitScreen: boolean }) {
    React.useEffect(() => {
        const el = document.getElementById(`terminal-container-${tabId}`);
        if (el) {
            el.style.opacity = '1';
            el.style.zIndex = '10';
            el.style.left = splitScreen ? '8px' : '0px';
            el.style.width = splitScreen ? 'calc(100% - 8px)' : '100%';
        }
        return () => {
            if (el) {
                el.style.opacity = '0';
                el.style.zIndex = '1';
            }
        };
    }, [tabId, splitScreen]);
    return <div style={{ width: '100%', height: '100%', position: 'relative' }} />;
}

export function SSH({ onSelectView }: ConfigEditorProps): React.ReactElement {
    const [allTabs, setAllTabs] = useState<Tab[]>([]);
    const [currentTab, setCurrentTab] = useState<number | null>(null);
    const [allSplitScreenTab, setAllSplitScreenTab] = useState<number[]>([]);
    const nextTabId = useRef(1);
    const [splitKey, setSplitKey] = useState(0);

    const setActiveTab = (tabId: number) => {
        setCurrentTab(tabId);
    };

    // Helper to fit all visible terminals
    const fitVisibleTerminals = () => {
        allTabs.forEach((terminal) => {
            const isVisible =
                (allSplitScreenTab.length === 0 && terminal.id === currentTab) ||
                (allSplitScreenTab.length > 0 && (terminal.id === currentTab || allSplitScreenTab.includes(terminal.id)));
            if (isVisible && terminal.terminalRef && terminal.terminalRef.current && typeof terminal.terminalRef.current.fit === 'function') {
                terminal.terminalRef.current.fit();
            }
        });
    };

    // Wrap setSplitScreenTab to fit before and after
    const setSplitScreenTab = (tabId: number) => {
        fitVisibleTerminals();
        setAllSplitScreenTab((prev) => {
            let next;
            if (prev.includes(tabId)) {
                next = prev.filter((id) => id !== tabId);
            } else if (prev.length < 3) {
                next = [...prev, tabId];
            } else {
                next = prev;
            }
            setTimeout(() => fitVisibleTerminals(), 0);
            return next;
        });
    };

    const setCloseTab = (tabId: number) => {
        // Find the tab and call disconnect on its terminal
        const tab = allTabs.find((t) => t.id === tabId);
        if (tab && tab.terminalRef && tab.terminalRef.current && typeof tab.terminalRef.current.disconnect === "function") {
            tab.terminalRef.current.disconnect();
        }
        setAllTabs((prev) => prev.filter((tab) => tab.id !== tabId));
        setAllSplitScreenTab((prev) => prev.filter((id) => id !== tabId));
        if (currentTab === tabId) {
            const remainingTabs = allTabs.filter((tab) => tab.id !== tabId);
            setCurrentTab(remainingTabs.length > 0 ? remainingTabs[0].id : null);
        }
    };

    // Render all terminals absolutely positioned, always mounted
    const renderAllTerminals = () => (
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
            {allTabs.map((tab) => (
                <div
                    key={tab.id}
                    id={`terminal-container-${tab.id}`}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 1,
                        opacity: 0,
                        pointerEvents: 'auto',
                        transition: 'opacity 0.15s',
                    }}
                    data-terminal-id={tab.id}
                >
                    <SSHTerminal
                        key={tab.id}
                        ref={tab.terminalRef}
                        hostConfig={tab.hostConfig}
                        isVisible={false}
                        title={tab.title}
                        showTitle={false}
                        splitScreen={false}
                    />
                </div>
            ))}
        </div>
    );

    // Helper to show a terminal in a panel by toggling zIndex/opacity
    const showTerminal = (tab: Tab, splitScreen: boolean) => (
        <TerminalOverlay tabId={tab.id} splitScreen={splitScreen} />
    );

    const renderTerminals = () => {
        if (allSplitScreenTab.length === 0) {
            return (
                <>
                    {allTabs.map((tab) => (
                        <div
                            key={tab.id}
                            style={{
                                height: '100%',
                                width: '100%',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                zIndex: tab.id === currentTab ? 10 : 1,
                                opacity: tab.id === currentTab ? 1 : 0,
                                transition: 'opacity 0.15s',
                                marginTop: 0,
                            }}
                        >
                            <TerminalOverlay tabId={tab.id} splitScreen={false} />
                        </div>
                    ))}
                </>
            );
        }

        // Split screen logic
        const splitTabs = allTabs.filter((tab) => allSplitScreenTab.includes(tab.id));
        const mainTab = allTabs.find((tab) => tab.id === currentTab);
        const layoutTabs = [mainTab, ...splitTabs.filter((t) => t && t.id !== currentTab)].filter((t): t is Tab => !!t);

        // 2 splits: horizontal
        if (layoutTabs.length === 2) {
            const [tab1, tab2] = layoutTabs;
            return (
                <ResizablePanelGroup key={splitKey} direction="horizontal" className="h-full w-full">
                    <ResizablePanel key={tab1.id} defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                        <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                            <div style={{
                                background: '#18181b',
                                color: '#fff',
                                fontSize: 13,
                                height: 28,
                                lineHeight: '28px',
                                padding: '0 10px',
                                borderBottom: '1px solid #222224',
                                letterSpacing: 1,
                                margin: 0,
                            }}>{tab1.title}</div>
                            <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                {showTerminal(tab1, true)}
                            </div>
                        </div>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel key={tab2.id} defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                        <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                            <div style={{
                                background: '#18181b',
                                color: '#fff',
                                fontSize: 13,
                                height: 28,
                                lineHeight: '28px',
                                padding: '0 10px',
                                borderBottom: '1px solid #222224',
                                letterSpacing: 1,
                                margin: 0,
                            }}>{tab2.title}</div>
                            <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                {showTerminal(tab2, true)}
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            );
        }

        // 3 splits: vertical group (top: horizontal with 2, bottom: single)
        if (layoutTabs.length === 3) {
            return (
                <ResizablePanelGroup key={splitKey} direction="vertical" className="h-full w-full">
                    <ResizablePanel defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                            {/* Left/top panel */}
                            <ResizablePanel key={layoutTabs[0].id} defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                                <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                                    <div style={{
                                        background: '#18181b',
                                        color: '#fff',
                                        fontSize: 13,
                                        height: 28,
                                        lineHeight: '28px',
                                        padding: '0 10px',
                                        borderBottom: '1px solid #222224',
                                        letterSpacing: 1,
                                        margin: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}>{layoutTabs[0].title}</div>
                                    <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                        {showTerminal(layoutTabs[0], true)}
                                    </div>
                                </div>
                            </ResizablePanel>
                            <ResizableHandle />
                            {/* Right/top panel (no reset button here) */}
                            <ResizablePanel key={layoutTabs[1].id} defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                                <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                                    <div style={{
                                        background: '#18181b',
                                        color: '#fff',
                                        fontSize: 13,
                                        height: 28,
                                        lineHeight: '28px',
                                        padding: '0 10px',
                                        borderBottom: '1px solid #222224',
                                        letterSpacing: 1,
                                        margin: 0,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                    }}>
                                        <span>{layoutTabs[1].title}</span>
                                    </div>
                                    <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                        {showTerminal(layoutTabs[1], true)}
                                    </div>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                        <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                            <div style={{
                                background: '#18181b',
                                color: '#fff',
                                fontSize: 13,
                                height: 28,
                                lineHeight: '28px',
                                padding: '0 10px',
                                borderBottom: '1px solid #222224',
                                letterSpacing: 1,
                                margin: 0,
                                display: 'flex',
                                alignItems: 'center',
                            }}>{layoutTabs[2].title}</div>
                            <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                {showTerminal(layoutTabs[2], true)}
                            </div>
                        </div>
                    </ResizablePanel>
                </ResizablePanelGroup>
            );
        }

        // 4 splits: 2x2 grid (vertical group with two horizontal groups)
        if (layoutTabs.length === 4) {
            return (
                <ResizablePanelGroup key={splitKey} direction="vertical" className="h-full w-full">
                    <ResizablePanel defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                            <ResizablePanel key={layoutTabs[0].id} defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                                <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                                    <div style={{
                                        background: '#18181b',
                                        color: '#fff',
                                        fontSize: 13,
                                        height: 28,
                                        lineHeight: '28px',
                                        padding: '0 10px',
                                        borderBottom: '1px solid #222224',
                                        letterSpacing: 1,
                                        margin: 0,
                                    }}>{layoutTabs[0].title}</div>
                                    <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                        {showTerminal(layoutTabs[0], true)}
                                    </div>
                                </div>
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel key={layoutTabs[1].id} defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                                <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                                    <div style={{
                                        background: '#18181b',
                                        color: '#fff',
                                        fontSize: 13,
                                        height: 28,
                                        lineHeight: '28px',
                                        padding: '0 10px',
                                        borderBottom: '1px solid #222224',
                                        letterSpacing: 1,
                                        margin: 0,
                                    }}>{layoutTabs[1].title}</div>
                                    <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                        {showTerminal(layoutTabs[1], true)}
                                    </div>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                    <ResizableHandle />
                    <ResizablePanel defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
                            <ResizablePanel key={layoutTabs[2].id} defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                                <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                                    <div style={{
                                        background: '#18181b',
                                        color: '#fff',
                                        fontSize: 13,
                                        height: 28,
                                        lineHeight: '28px',
                                        padding: '0 10px',
                                        borderBottom: '1px solid #222224',
                                        letterSpacing: 1,
                                        margin: 0,
                                    }}>{layoutTabs[2].title}</div>
                                    <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                        {showTerminal(layoutTabs[2], true)}
                                    </div>
                                </div>
                            </ResizablePanel>
                            <ResizableHandle />
                            <ResizablePanel key={layoutTabs[3].id} defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full">
                                <div style={{height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#09090b', margin: 0, padding: 0, position: 'relative'}}>
                                    <div style={{
                                        background: '#18181b',
                                        color: '#fff',
                                        fontSize: 13,
                                        height: 28,
                                        lineHeight: '28px',
                                        padding: '0 10px',
                                        borderBottom: '1px solid #222224',
                                        letterSpacing: 1,
                                        margin: 0,
                                    }}>{layoutTabs[3].title}</div>
                                    <div style={{flex: 1, position: 'relative', height: '100%', width: '100%', margin: 0, padding: 0}}>
                                        {showTerminal(layoutTabs[3], true)}
                                    </div>
                                </div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </ResizablePanel>
                </ResizablePanelGroup>
            );
        }
        return null;
    };

    const onAddHostSubmit = (data: any) => {
        const id = nextTabId.current++;
        const title = `${data.ip || "Host"}:${data.port || 22}`;
        const terminalRef = React.createRef<any>();
        const newTab: Tab = {
            id,
            title,
            hostConfig: data,
            terminalRef,
        };
        setAllTabs((prev) => [...prev, newTab]);
        setCurrentTab(id);
        setAllSplitScreenTab((prev) => prev.filter((tid) => tid !== id));
    };

    const getLayoutStyle = () => {
        if (allSplitScreenTab.length === 0) {
            return "flex flex-col h-full w-full";
        } else if (allSplitScreenTab.length === 1) {
            return "grid grid-cols-2 h-full w-full";
        } else if (allSplitScreenTab.length === 2) {
            return "grid grid-cols-2 grid-rows-2 h-full w-full";
        } else {
            return "grid grid-cols-2 grid-rows-2 h-full w-full";
        }
    };

    return (
        <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            {/* Sidebar: fixed width */}
            <div style={{ width: 256, flexShrink: 0, height: '100vh', position: 'relative', zIndex: 2, margin: 0, padding: 0, border: 'none' }}>
            <SSHSidebar
                onSelectView={onSelectView}
                onAddHostSubmit={onAddHostSubmit}
            />
            </div>
            {/* Main area: fills the rest */}
            <div
                className="terminal-container"
                style={{
                    flex: 1,
                    height: '100vh',
                    position: 'relative',
                    overflow: 'hidden',
                    margin: 0,
                    padding: 0,
                    border: 'none',
                }}
            >
                {/* Always render the topbar at the top */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 10 }}>
            <SSHTopbar
                allTabs={allTabs}
                        currentTab={currentTab ?? -1}
                setActiveTab={setActiveTab}
                allSplitScreenTab={allSplitScreenTab}
                setSplitScreenTab={setSplitScreenTab}
                setCloseTab={setCloseTab}
            />
        </div>
                {/* Split area below the topbar */}
                <div style={{ height: 'calc(100% - 46px)', marginTop: 46, position: 'relative' }}>
                    {/* Absolutely render all terminals for persistence */}
                    {allSplitScreenTab.length > 0 && (
                        <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 20, height: 28 }}>
                            <button
                                style={{
                                    background: '#18181b',
                                    color: '#fff',
                                    borderLeft: '1px solid #222224',
                                    borderRight: '1px solid #222224',
                                    borderTop: 'none',
                                    borderBottom: '1px solid #222224',
                                    borderRadius: 0,
                                    padding: '2px 10px',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    margin: 0,
                                    height: 28,
                                    display: 'flex',
                                    alignItems: 'center',
                                }}
                                onClick={() => setSplitKey((k) => k + 1)}
                            >
                                Reset Split Sizes
                            </button>
                        </div>
                    )}
                    {renderAllTerminals()}
                    {renderTerminals()}
                </div>
            </div>
        </div>
    );
}