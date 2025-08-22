import React, { createContext, useContext, useState, useCallback } from 'react';

interface Tab {
    id: number;
    type: string;
    title: string;
    isActive: boolean;
    hostConfig?: any;
}

interface TabContextType {
    tabs: Tab[];
    currentTab: number | null;
    addTab: (tab: Omit<Tab, 'id' | 'isActive'>) => number;
    setCurrentTab: (id: number) => void;
    removeTab: (id: number) => void;
    updateTab: (id: number, updates: Partial<Tab>) => void;
}

const TabContext = createContext<TabContextType | undefined>(undefined);

export function useMobileTabs() {
    const context = useContext(TabContext);
    if (!context) {
        throw new Error('useMobileTabs must be used within a MobileTabProvider');
    }
    return context;
}

interface MobileTabProviderProps {
    children: React.ReactNode;
}

export function MobileTabProvider({ children }: MobileTabProviderProps) {
    const [tabs, setTabs] = useState<Tab[]>([]);
    const [currentTab, setCurrentTabState] = useState<number | null>(null);

    const addTab = useCallback((tab: Omit<Tab, 'id' | 'isActive'>) => {
        const newId = Math.max(...tabs.map(t => t.id), 0) + 1;
        const newTab: Tab = {
            ...tab,
            id: newId,
            isActive: true, // New tab becomes active
        };
        
        // Set all other tabs to inactive and add the new active tab
        setTabs(prev => prev.map(t => ({ ...t, isActive: false })).concat(newTab));
        setCurrentTabState(newId);
        return newId;
    }, [tabs]);

    const setCurrentTab = useCallback((id: number) => {
        setTabs(prev => prev.map(t => ({ ...t, isActive: t.id === id })));
        setCurrentTabState(id);
    }, []);

    const removeTab = useCallback((id: number) => {
        setTabs(prev => {
            const newTabs = prev.filter(t => t.id !== id);
            
            // If removing current tab, switch to first available tab or null
            if (id === currentTab) {
                if (newTabs.length > 0) {
                    const nextTabId = newTabs[0].id;
                    setCurrentTabState(nextTabId);
                    return newTabs.map(t => ({ ...t, isActive: t.id === nextTabId }));
                } else {
                    setCurrentTabState(null);
                    return [];
                }
            }
            
            return newTabs;
        });
    }, [currentTab]);

    const updateTab = useCallback((id: number, updates: Partial<Tab>) => {
        setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
    }, []);

    const value: TabContextType = {
        tabs,
        currentTab,
        addTab,
        setCurrentTab,
        removeTab,
        updateTab,
    };

    return (
        <TabContext.Provider value={value}>
            {children}
        </TabContext.Provider>
    );
}
