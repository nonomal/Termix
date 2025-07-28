import React, {useState, useRef, useEffect} from "react";
import {SSHSidebar} from "@/apps/SSH/Terminal/SSHSidebar.tsx";
import {SSHTerminal} from "./SSHTerminal.tsx";
import {SSHTopbar} from "@/apps/SSH/Terminal/SSHTopbar.tsx";
import {ResizablePanelGroup, ResizablePanel, ResizableHandle} from '@/components/ui/resizable.tsx';
import * as ResizablePrimitive from "react-resizable-panels";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

type Tab = {
    id: number;
    title: string;
    hostConfig: any;
    terminalRef: React.RefObject<any>;
};

export function SSH({onSelectView}: ConfigEditorProps): React.ReactElement {
    const [allTabs, setAllTabs] = useState<Tab[]>([]);
    const [currentTab, setCurrentTab] = useState<number | null>(null);
    const [allSplitScreenTab, setAllSplitScreenTab] = useState<number[]>([]);
    const nextTabId = useRef(1);

    const [panelRects, setPanelRects] = useState<Record<string, DOMRect | null>>({});
    const panelRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const panelGroupRefs = useRef<{ [key: string]: any }>({});

    const setActiveTab = (tabId: number) => {
        setCurrentTab(tabId);
    };

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

    const updatePanelRects = () => {
        setPanelRects((prev) => {
            const next: Record<string, DOMRect | null> = {...prev};
            Object.entries(panelRefs.current).forEach(([id, ref]) => {
                if (ref) {
                    next[id] = ref.getBoundingClientRect();
                }
            });
            return next;
        });
    };

    useEffect(() => {
        const observers: ResizeObserver[] = [];
        Object.entries(panelRefs.current).forEach(([id, ref]) => {
            if (ref) {
                const observer = new ResizeObserver(() => updatePanelRects());
                observer.observe(ref);
                observers.push(observer);
            }
        });
        updatePanelRects();
        return () => {
            observers.forEach((observer) => observer.disconnect());
        };
    }, [allSplitScreenTab, currentTab, allTabs.length]);

    const renderAllTerminals = () => {
        const layoutStyles: Record<number, React.CSSProperties> = {};
        const splitTabs = allTabs.filter((tab) => allSplitScreenTab.includes(tab.id));
        const mainTab = allTabs.find((tab) => tab.id === currentTab);
        const layoutTabs = [mainTab, ...splitTabs.filter((t) => t && t.id !== (mainTab && mainTab.id))].filter((t): t is Tab => !!t);
        if (allSplitScreenTab.length === 0 && mainTab) {
            layoutStyles[mainTab.id] = {
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 20,
                display: 'block',
                pointerEvents: 'auto',
            };
        } else {
            layoutTabs.forEach((tab) => {
                const rect = panelRects[String(tab.id)];
                if (rect) {
                    const parentRect = panelRefs.current['parent']?.getBoundingClientRect();
                    let top = rect.top, left = rect.left, width = rect.width, height = rect.height;
                    if (parentRect) {
                        top = rect.top - parentRect.top;
                        left = rect.left - parentRect.left;
                    }
                    layoutStyles[tab.id] = {
                        position: 'absolute',
                        top: top + 28,
                        left,
                        width,
                        height: height - 28,
                        zIndex: 20,
                        display: 'block',
                        pointerEvents: 'auto',
                    };
                }
            });
        }
        return (
            <div ref={el => {
                panelRefs.current['parent'] = el;
            }} style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 1,
                overflow: 'hidden'
            }}>
                {allTabs.map((tab) => {
                    const style = layoutStyles[tab.id]
                        ? {...layoutStyles[tab.id], overflow: 'hidden'}
                        : {display: 'none', overflow: 'hidden'};
                    const isVisible = !!layoutStyles[tab.id];
                    return (
                        <div key={tab.id} style={style} data-terminal-id={tab.id}>
                            <SSHTerminal
                                key={tab.id}
                                ref={tab.terminalRef}
                                hostConfig={tab.hostConfig}
                                isVisible={isVisible}
                                title={tab.title}
                                showTitle={false}
                                splitScreen={allSplitScreenTab.length > 0}
                            />
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderSplitOverlays = () => {
        const splitTabs = allTabs.filter((tab) => allSplitScreenTab.includes(tab.id));
        const mainTab = allTabs.find((tab) => tab.id === currentTab);
        const layoutTabs = [mainTab, ...splitTabs.filter((t) => t && t.id !== (mainTab && mainTab.id))].filter((t): t is Tab => !!t);
        if (allSplitScreenTab.length === 0) return null;

        if (layoutTabs.length === 2) {
            const [tab1, tab2] = layoutTabs;
            return (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10,
                    pointerEvents: 'none'
                }}>
                    <ResizablePrimitive.PanelGroup
                        ref={el => {
                            panelGroupRefs.current['main'] = el;
                        }}
                        direction="horizontal"
                        className="h-full w-full"
                        id="main-horizontal"
                    >
                        <ResizablePanel key={tab1.id} defaultSize={50} minSize={20}
                                        className="!overflow-hidden h-full w-full" id={`panel-${tab1.id}`} order={1}>
                            <div ref={el => {
                                panelRefs.current[String(tab1.id)] = el;
                            }} style={{
                                height: '100%',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                background: 'transparent',
                                margin: 0,
                                padding: 0,
                                position: 'relative'
                            }}>
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
                                    pointerEvents: 'auto',
                                    zIndex: 11,
                                }}>{tab1.title}</div>
                            </div>
                        </ResizablePanel>
                        <ResizableHandle style={{pointerEvents: 'auto', zIndex: 12}}/>
                        <ResizablePanel key={tab2.id} defaultSize={50} minSize={20}
                                        className="!overflow-hidden h-full w-full" id={`panel-${tab2.id}`} order={2}>
                            <div ref={el => {
                                panelRefs.current[String(tab2.id)] = el;
                            }} style={{
                                height: '100%',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                background: 'transparent',
                                margin: 0,
                                padding: 0,
                                position: 'relative'
                            }}>
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
                                    pointerEvents: 'auto',
                                    zIndex: 11,
                                }}>{tab2.title}</div>
                            </div>
                        </ResizablePanel>
                    </ResizablePrimitive.PanelGroup>
                </div>
            );
        }
        if (layoutTabs.length === 3) {
            return (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10,
                    pointerEvents: 'none'
                }}>
                    <ResizablePrimitive.PanelGroup
                        ref={el => {
                            panelGroupRefs.current['main'] = el;
                        }}
                        direction="vertical"
                        className="h-full w-full"
                        id="main-vertical"
                    >
                        <ResizablePanel defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full"
                                        id="top-panel" order={1}>
                            <ResizablePanelGroup ref={el => {
                                panelGroupRefs.current['top'] = el;
                            }} direction="horizontal" className="h-full w-full" id="top-horizontal">
                                <ResizablePanel key={layoutTabs[0].id} defaultSize={50} minSize={20}
                                                className="!overflow-hidden h-full w-full"
                                                id={`panel-${layoutTabs[0].id}`} order={1}>
                                    <div ref={el => {
                                        panelRefs.current[String(layoutTabs[0].id)] = el;
                                    }} style={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        background: 'transparent',
                                        margin: 0,
                                        padding: 0,
                                        position: 'relative'
                                    }}>
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
                                            pointerEvents: 'auto',
                                            zIndex: 11,
                                        }}>{layoutTabs[0].title}</div>
                                    </div>
                                </ResizablePanel>
                                <ResizableHandle style={{pointerEvents: 'auto', zIndex: 12}}/>
                                <ResizablePanel key={layoutTabs[1].id} defaultSize={50} minSize={20}
                                                className="!overflow-hidden h-full w-full"
                                                id={`panel-${layoutTabs[1].id}`} order={2}>
                                    <div ref={el => {
                                        panelRefs.current[String(layoutTabs[1].id)] = el;
                                    }} style={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        background: 'transparent',
                                        margin: 0,
                                        padding: 0,
                                        position: 'relative'
                                    }}>
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
                                            pointerEvents: 'auto',
                                            zIndex: 11,
                                        }}>{layoutTabs[1].title}</div>
                                    </div>
                                </ResizablePanel>
                            </ResizablePanelGroup>
                        </ResizablePanel>
                        <ResizableHandle style={{pointerEvents: 'auto', zIndex: 12}}/>
                        <ResizablePanel defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full"
                                        id="bottom-panel" order={2}>
                            <div ref={el => {
                                panelRefs.current[String(layoutTabs[2].id)] = el;
                            }} style={{
                                height: '100%',
                                width: '100%',
                                display: 'flex',
                                flexDirection: 'column',
                                background: 'transparent',
                                margin: 0,
                                padding: 0,
                                position: 'relative'
                            }}>
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
                                    pointerEvents: 'auto',
                                    zIndex: 11,
                                }}>{layoutTabs[2].title}</div>
                            </div>
                        </ResizablePanel>
                    </ResizablePrimitive.PanelGroup>
                </div>
            );
        }
        if (layoutTabs.length === 4) {
            return (
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    zIndex: 10,
                    pointerEvents: 'none'
                }}>
                    <ResizablePrimitive.PanelGroup
                        ref={el => {
                            panelGroupRefs.current['main'] = el;
                        }}
                        direction="vertical"
                        className="h-full w-full"
                        id="main-vertical"
                    >
                        <ResizablePanel defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full"
                                        id="top-panel" order={1}>
                            <ResizablePanelGroup ref={el => {
                                panelGroupRefs.current['top'] = el;
                            }} direction="horizontal" className="h-full w-full" id="top-horizontal">
                                <ResizablePanel key={layoutTabs[0].id} defaultSize={50} minSize={20}
                                                className="!overflow-hidden h-full w-full"
                                                id={`panel-${layoutTabs[0].id}`} order={1}>
                                    <div ref={el => {
                                        panelRefs.current[String(layoutTabs[0].id)] = el;
                                    }} style={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        background: 'transparent',
                                        margin: 0,
                                        padding: 0,
                                        position: 'relative'
                                    }}>
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
                                            pointerEvents: 'auto',
                                            zIndex: 11,
                                        }}>{layoutTabs[0].title}</div>
                                    </div>
                                </ResizablePanel>
                                <ResizableHandle style={{pointerEvents: 'auto', zIndex: 12}}/>
                                <ResizablePanel key={layoutTabs[1].id} defaultSize={50} minSize={20}
                                                className="!overflow-hidden h-full w-full"
                                                id={`panel-${layoutTabs[1].id}`} order={2}>
                                    <div ref={el => {
                                        panelRefs.current[String(layoutTabs[1].id)] = el;
                                    }} style={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        background: 'transparent',
                                        margin: 0,
                                        padding: 0,
                                        position: 'relative'
                                    }}>
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
                                            pointerEvents: 'auto',
                                            zIndex: 11,
                                        }}>{layoutTabs[1].title}</div>
                                    </div>
                                </ResizablePanel>
                            </ResizablePanelGroup>
                        </ResizablePanel>
                        <ResizableHandle style={{pointerEvents: 'auto', zIndex: 12}}/>
                        <ResizablePanel defaultSize={50} minSize={20} className="!overflow-hidden h-full w-full"
                                        id="bottom-panel" order={2}>
                            <ResizablePanelGroup ref={el => {
                                panelGroupRefs.current['bottom'] = el;
                            }} direction="horizontal" className="h-full w-full" id="bottom-horizontal">
                                <ResizablePanel key={layoutTabs[2].id} defaultSize={50} minSize={20}
                                                className="!overflow-hidden h-full w-full"
                                                id={`panel-${layoutTabs[2].id}`} order={1}>
                                    <div ref={el => {
                                        panelRefs.current[String(layoutTabs[2].id)] = el;
                                    }} style={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        background: 'transparent',
                                        margin: 0,
                                        padding: 0,
                                        position: 'relative'
                                    }}>
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
                                            pointerEvents: 'auto',
                                            zIndex: 11,
                                        }}>{layoutTabs[2].title}</div>
                                    </div>
                                </ResizablePanel>
                                <ResizableHandle style={{pointerEvents: 'auto', zIndex: 12}}/>
                                <ResizablePanel key={layoutTabs[3].id} defaultSize={50} minSize={20}
                                                className="!overflow-hidden h-full w-full"
                                                id={`panel-${layoutTabs[3].id}`} order={2}>
                                    <div ref={el => {
                                        panelRefs.current[String(layoutTabs[3].id)] = el;
                                    }} style={{
                                        height: '100%',
                                        width: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        background: 'transparent',
                                        margin: 0,
                                        padding: 0,
                                        position: 'relative'
                                    }}>
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
                                            pointerEvents: 'auto',
                                            zIndex: 11,
                                        }}>{layoutTabs[3].title}</div>
                                    </div>
                                </ResizablePanel>
                            </ResizablePanelGroup>
                        </ResizablePanel>
                    </ResizablePrimitive.PanelGroup>
                </div>
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

    const getUniqueTabTitle = (baseTitle: string) => {
        let title = baseTitle;
        let count = 1;
        const existingTitles = allTabs.map(t => t.title);
        while (existingTitles.includes(title)) {
            title = `${baseTitle} (${count})`;
            count++;
        }
        return title;
    };

    const onHostConnect = (hostConfig: any) => {
        const baseTitle = hostConfig.name?.trim() ? hostConfig.name : `${hostConfig.ip || "Host"}:${hostConfig.port || 22}`;
        const title = getUniqueTabTitle(baseTitle);
        const terminalRef = React.createRef<any>();
        const id = nextTabId.current++;
        const newTab: Tab = {
            id,
            title,
            hostConfig,
            terminalRef,
        };
        setAllTabs((prev) => [...prev, newTab]);
        setCurrentTab(id);
        setAllSplitScreenTab((prev) => prev.filter((tid) => tid !== id));
    };

    return (
        <div style={{display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden'}}>
            <div style={{
                width: 256,
                flexShrink: 0,
                height: '100vh',
                position: 'relative',
                zIndex: 2,
                margin: 0,
                padding: 0,
                border: 'none'
            }}>
                <SSHSidebar
                    onSelectView={onSelectView}
                    onAddHostSubmit={onAddHostSubmit}
                    onHostConnect={onHostConnect}
                    allTabs={allTabs}
                    runCommandOnTabs={(tabIds: number[], command: string) => {
                        allTabs.forEach(tab => {
                            if (tabIds.includes(tab.id) && tab.terminalRef?.current?.sendInput) {
                                tab.terminalRef.current.sendInput(command);
                            }
                        });
                    }}
                />
            </div>
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
                <div style={{position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 10}}>
                    <SSHTopbar
                        allTabs={allTabs}
                        currentTab={currentTab ?? -1}
                        setActiveTab={setActiveTab}
                        allSplitScreenTab={allSplitScreenTab}
                        setSplitScreenTab={setSplitScreenTab}
                        setCloseTab={setCloseTab}
                    />
                </div>
                <div style={{height: 'calc(100% - 46px)', marginTop: 46, position: 'relative'}}>
                    {allTabs.length === 0 && (
                        <div style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            background: '#18181b',
                            border: '1px solid #434345',
                            borderRadius: '8px',
                            padding: '24px',
                            textAlign: 'center',
                            color: '#f7f7f7',
                            maxWidth: '400px',
                            zIndex: 30
                        }}>
                            <div style={{fontSize: '18px', fontWeight: 'bold', marginBottom: '12px'}}>
                                Welcome to Termix SSH
                            </div>
                            <div style={{fontSize: '14px', color: '#a1a1aa', lineHeight: '1.5'}}>
                                Click on any host title in the sidebar to open a terminal connection, or use the "Add
                                Host" button to create a new connection.
                            </div>
                        </div>
                    )}
                    {allSplitScreenTab.length > 0 && (
                        <div style={{position: 'absolute', top: 0, right: 0, zIndex: 20, height: 28}}>
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
                                onClick={() => {
                                    if (allSplitScreenTab.length === 1) {
                                        panelGroupRefs.current['main']?.setLayout([50, 50]);
                                    } else if (allSplitScreenTab.length === 2) {
                                        panelGroupRefs.current['main']?.setLayout([50, 50]);
                                        panelGroupRefs.current['top']?.setLayout([50, 50]);
                                    } else if (allSplitScreenTab.length === 3) {
                                        panelGroupRefs.current['main']?.setLayout([50, 50]);
                                        panelGroupRefs.current['top']?.setLayout([50, 50]);
                                        panelGroupRefs.current['bottom']?.setLayout([50, 50]);
                                    }
                                }}
                            >
                                Reset Split Sizes
                            </button>
                        </div>
                    )}
                    {renderAllTerminals()}
                    {renderSplitOverlays()}
                </div>
            </div>
        </div>
    );
}