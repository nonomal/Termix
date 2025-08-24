import React, { useState, useEffect, useRef } from 'react';
import { TerminalComponent } from "@/ui/mobile/Apps/Terminal/TerminalComponent.tsx";
import { ServerComponent } from "@/ui/mobile/Apps/Server/ServerComponent.tsx";
import { MobileLeftSidebar } from "@/ui/mobile/Apps/Navigation/LeftSidebar.tsx";
import { MobileBottomNavbar } from "@/ui/mobile/Apps/Navigation/BottomNavbar.tsx";
import { MobileTabProvider, useMobileTabs } from "@/ui/mobile/Apps/Navigation/TabContext.tsx";
import { MobileAuth } from "@/ui/mobile/Apps/Auth/MobileAuth.tsx";
import axios from "axios";

function getCookie(name: string) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, "");
}

const apiBase = import.meta.env.DEV ? "http://localhost:8081/users" : "/users";
const API = axios.create({ baseURL: apiBase });

function MobileAppContent() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);
    const [authLoading, setAuthLoading] = useState(true);
    const [dbError, setDbError] = useState<string | null>(null);
    const { tabs, currentTab, setCurrentTab, removeTab, addTab } = useMobileTabs();
    const terminalRefs = useRef<Map<number, any>>(new Map());

    // Check authentication status on component mount
    useEffect(() => {
        const checkAuth = async () => {
            setAuthLoading(true);
            try {
                const jwt = getCookie("jwt");
                if (jwt) {
                    const res = await API.get("/me", {headers: {Authorization: `Bearer ${jwt}`}});
                    setIsAdmin(!!res.data.is_admin);
                    setUsername(res.data.username || null);
                    setLoggedIn(true);
                    setDbError(null);
                } else {
                    setLoggedIn(false);
                    setIsAdmin(false);
                    setUsername(null);
                }
            } catch (err) {
                setLoggedIn(false);
                setIsAdmin(false);
                setUsername(null);
                // Clear invalid JWT
                document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            } finally {
                setAuthLoading(false);
            }
        };

        checkAuth();
    }, []);

    const handleAuthSuccess = (authData: { isAdmin: boolean; username: string | null; userId: string | null }) => {
        setLoggedIn(true);
        setIsAdmin(authData.isAdmin);
        setUsername(authData.username);
        setDbError(null);
    };

    const handleLogout = () => {
        setLoggedIn(false);
        setIsAdmin(false);
        setUsername(null);
        document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        // Clear all tabs on logout
        tabs.forEach(tab => removeTab(tab.id));
    };

    const handleOpenSidebar = () => {
        setIsSidebarOpen(true);
    };

    const handleCloseSidebar = () => {
        setIsSidebarOpen(false);
    };

    const generateNumberedTitle = (hostName: string, type: string) => {
        const existingTabs = tabs.filter(tab => 
            tab.type === type && 
            tab.hostConfig && 
            tab.hostConfig.name === hostName
        );
        
        if (existingTabs.length === 0) {
            return hostName;
        } else {
            return `${hostName} (${existingTabs.length + 1})`;
        }
    };

    const handleSelectView = (view: string, hostConfig?: any) => {
        // Add a new tab for the selected view with the actual selected host
        if (view === 'terminal' && hostConfig) {
            const hostName = hostConfig.name || hostConfig.username || 'Terminal';
            addTab({
                type: 'terminal',
                title: generateNumberedTitle(hostName, 'terminal'),
                hostConfig: hostConfig
            });
        } else if (view === 'server' && hostConfig) {
            const hostName = hostConfig.name || hostConfig.username || 'Server';
            addTab({
                type: 'server',
                title: generateNumberedTitle(hostName, 'server'),
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
            <div className="h-[calc(100%-50px)] relative"> {/* Subtract bottom navbar height from total height */}
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
                isAdmin={isAdmin}
                username={username || 'user'}
                onLogout={handleLogout}
            />

            {/* Authentication Modal */}
            {!loggedIn && !authLoading && (
                <MobileAuth
                    setLoggedIn={setLoggedIn}
                    setIsAdmin={setIsAdmin}
                    setUsername={setUsername}
                    setUserId={() => {}} // Not used in mobile
                    loggedIn={loggedIn}
                    authLoading={authLoading}
                    dbError={dbError}
                    setDbError={setDbError}
                    onAuthSuccess={handleAuthSuccess}
                />
            )}
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