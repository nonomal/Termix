import React, { useState, useEffect, useRef } from 'react';
import { TerminalComponent } from "@/ui/mobile/Apps/Terminal/TerminalComponent.tsx";
import { ServerComponent } from "@/ui/mobile/Apps/Server/ServerComponent.tsx";
import { MobileLeftSidebar } from "@/ui/mobile/Apps/Navigation/LeftSidebar.tsx";
import { MobileBottomNavbar } from "@/ui/mobile/Apps/Navigation/BottomNavbar.tsx";
import { MobileTabProvider, useMobileTabs } from "@/ui/mobile/Apps/Navigation/TabContext.tsx";

function MobileAppContent() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { tabs, currentTab, setCurrentTab, removeTab, addTab } = useMobileTabs();
    const terminalRefs = useRef<Map<number, any>>(new Map());

    const handleOpenSidebar = () => {
        setIsSidebarOpen(true);
    };

    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
    };

    const handleSelectView = (view: string, hostConfig?: any) => {
        // Add a new tab for the selected view with the actual selected host
        if (view === 'terminal' && hostConfig) {
            addTab({
                type: 'terminal',
                title: hostConfig.name || hostConfig.username || 'Terminal',
                hostConfig: hostConfig
            });
        } else if (view === 'server' && hostConfig) {
            addTab({
                type: 'server',
                title: hostConfig.name || hostConfig.username || 'Server',
                hostConfig: hostConfig
            });
        } else if (view === 'admin') {
            addTab({
                type: 'admin',
                title: 'Admin',
                hostConfig: null
            });
        }
    };

    const handleTabChange = (tabId: number) => {
        setCurrentTab(tabId);
    };

    const handleCloseTab = (tabId: number) => {
        // Disconnect terminal if closing a terminal tab
        if (tabs.find(t => t.id === tabId)?.type === 'terminal') {
            const terminalRef = terminalRefs.current.get(tabId);
            if (terminalRef?.disconnect) {
                terminalRef.disconnect();
            }
            terminalRefs.current.delete(tabId);
        }

        removeTab(tabId);
    };

    // Store terminal refs
    const handleTerminalRef = (tabId: number, ref: any) => {
        if (ref) {
            terminalRefs.current.set(tabId, ref);
        }
    };

    return (
        <div className="h-screen w-screen bg-[#18181b] overflow-hidden">
            {/* Main Content Area - Render ALL tabs but only show active one */}
            <div className="h-full pb-[50px] relative"> {/* pb-[50px] accounts for bottom navbar height */}
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        className={`absolute inset-0 ${
                            tab.isActive ? 'block' : 'hidden'
                        }`}
                    >
                        {tab.type === 'terminal' && tab.hostConfig && (
                            <TerminalComponent 
                                hostConfig={tab.hostConfig}
                                isVisible={tab.isActive}
                                ref={(ref) => handleTerminalRef(tab.id, ref)}
                            />
                        )}
                        {tab.type === 'server' && tab.hostConfig && (
                            <ServerComponent hostConfig={tab.hostConfig} />
                        )}
                        {tab.type === 'admin' && (
                            <div className="h-full w-full bg-[#18181b] text-white p-4 flex items-center justify-center">
                                <div className="text-center">
                                    <h2 className="text-xl font-semibold mb-2">Admin Settings</h2>
                                    <p className="text-gray-400">Administrative controls</p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                
                {/* Show welcome screen when no tabs */}
                {tabs.length === 0 && (
                    <div className="h-full w-full bg-[#18181b] text-white p-4 flex items-center justify-center">
                        <div className="text-center">
                            <h2 className="text-xl font-semibold mb-2">Welcome to Termix</h2>
                            <p className="text-gray-400">Open the sidebar to connect to a host</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Navigation Bar */}
            <MobileBottomNavbar
                tabs={tabs}
                currentTab={currentTab}
                onTabChange={handleTabChange}
                onOpenSidebar={handleOpenSidebar}
                onCloseTab={handleCloseTab}
            />

            {/* Left Sidebar */}
            <MobileLeftSidebar
                isOpen={isSidebarOpen}
                onClose={handleCloseSidebar}
                onSelectView={handleSelectView}
                isAdmin={false}
                username="user"
            />
        </div>
    );
}

export function MobileApp() {
    return (
        <MobileTabProvider>
            <MobileAppContent />
        </MobileTabProvider>
    );
}