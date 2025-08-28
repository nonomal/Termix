import React, {createContext, useContext, useState, useRef, type ReactNode} from 'react';

export interface Tab {
    id: number;
    type: 'home' | 'terminal' | 'ssh_manager' | 'server' | 'admin' | 'file_manager';
    title: string;
    hostConfig?: any;
    terminalRef?: React.RefObject<any>;
}

interface TabContextType {
    tabs: Tab[];
    currentTab: number | null;
    allSplitScreenTab: number[];
    addTab: (tab: Omit<Tab, 'id'>) => number;
    removeTab: (tabId: number) => void;
    setCurrentTab: (tabId: number) => void;
    setSplitScreenTab: (tabId: number) => void;
    getTab: (tabId: number) => Tab | undefined;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function useTabs() {
    const context = useContext(TabContext);
    if (context === undefined) {
        throw new Error('useTabs must be used within a TabProvider');
    }
    return context;
}

interface TabProviderProps {
    children: ReactNode;
}

export function TabProvider({children}: TabProviderProps) {
    const [tabs, setTabs] = useState<Tab[]>([
        {id: 1, type: 'home', title: 'Home'}
    ]);
    const [currentTab, setCurrentTab] = useState<number>(1);
    const [allSplitScreenTab, setAllSplitScreenTab] = useState<number[]>([]);
    const nextTabId = useRef(2);

    function computeUniqueTitle(tabType: Tab['type'], desiredTitle: string | undefined): string {
        const defaultTitle = tabType === 'server' ? 'Server' : (tabType === 'file_manager' ? 'File Manager' : 'Terminal');
        const baseTitle = (desiredTitle || defaultTitle).trim();
        const match = baseTitle.match(/^(.*) \((\d+)\)$/);
        const root = match ? match[1] : baseTitle;

        const usedNumbers = new Set<number>();
        let rootUsed = false;
        tabs.forEach(t => {
            if (!t.title) return;
            if (t.title === root) {
                rootUsed = true;
                return;
            }
            const m = t.title.match(new RegExp(`^${root.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&")} \\((\\d+)\\)$`));
            if (m) {
                const n = parseInt(m[1], 10);
                if (!isNaN(n)) usedNumbers.add(n);
            }
        });

        if (!rootUsed) return root;
        let n = 2;
        while (usedNumbers.has(n)) n += 1;
        return `${root} (${n})`;
    }

    const addTab = (tabData: Omit<Tab, 'id'>): number => {
        const id = nextTabId.current++;
        const needsUniqueTitle = tabData.type === 'terminal' || tabData.type === 'server' || tabData.type === 'file_manager';
        const effectiveTitle = needsUniqueTitle ? computeUniqueTitle(tabData.type, tabData.title) : (tabData.title || '');
        const newTab: Tab = {
            ...tabData,
            id,
            title: effectiveTitle,
            terminalRef: tabData.type === 'terminal' ? React.createRef<any>() : undefined
        };
        setTabs(prev => [...prev, newTab]);
        setCurrentTab(id);
        setAllSplitScreenTab(prev => prev.filter(tid => tid !== id));
        return id;
    };

    const removeTab = (tabId: number) => {
        const tab = tabs.find(t => t.id === tabId);
        if (tab && tab.terminalRef?.current && typeof tab.terminalRef.current.disconnect === "function") {
            tab.terminalRef.current.disconnect();
        }

        setTabs(prev => prev.filter(tab => tab.id !== tabId));
        setAllSplitScreenTab(prev => prev.filter(id => id !== tabId));

        if (currentTab === tabId) {
            const remainingTabs = tabs.filter(tab => tab.id !== tabId);
            setCurrentTab(remainingTabs.length > 0 ? remainingTabs[0].id : 1);
        }
    };

    const setSplitScreenTab = (tabId: number) => {
        setAllSplitScreenTab(prev => {
            if (prev.includes(tabId)) {
                return prev.filter(id => id !== tabId);
            } else if (prev.length < 3) {
                return [...prev, tabId];
            }
            return prev;
        });
    };

    const getTab = (tabId: number) => {
        return tabs.find(tab => tab.id === tabId);
    };

    const value: TabContextType = {
        tabs,
        currentTab,
        allSplitScreenTab,
        addTab,
        removeTab,
        setCurrentTab,
        setSplitScreenTab,
        getTab,
    };

    return (
        <TabContext.Provider value={value}>
            {children}
        </TabContext.Provider>
    );
}
