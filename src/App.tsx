import React, {useState, useEffect} from "react"
import {LeftSidebar} from "@/ui/Navigation/LeftSidebar.tsx"
import {Homepage} from "@/ui/Homepage/Homepage.tsx"
import {AppView} from "@/ui/Navigation/AppView.tsx"
import {HostManager} from "@/ui/apps/Host Manager/HostManager.tsx"
import {TabProvider, useTabs} from "@/ui/Navigation/Tabs/TabContext.tsx"
import {TopNavbar} from "@/ui/Navigation/TopNavbar.tsx";
import { AdminSettings } from "@/ui/Admin/AdminSettings";
import { Toaster } from "@/components/ui/sonner";
import { getUserInfo } from "@/ui/main-axios.ts";

function getCookie(name: string) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, "");
}

function setCookie(name: string, value: string, days = 7) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function AppContent() {
    const [view, setView] = useState<string>("homepage")
    const [mountedViews, setMountedViews] = useState<Set<string>>(new Set(["homepage"]))
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [username, setUsername] = useState<string | null>(null)
    const [isAdmin, setIsAdmin] = useState(false)
    const [authLoading, setAuthLoading] = useState(true)
    const [isTopbarOpen, setIsTopbarOpen] = useState<boolean>(true)
    const {currentTab, tabs} = useTabs();

    useEffect(() => {
        const checkAuth = () => {
            const jwt = getCookie("jwt");
            if (jwt) {
                setAuthLoading(true);
                getUserInfo()
                    .then((meRes) => {
                        setIsAuthenticated(true);
                        setIsAdmin(!!meRes.is_admin);
                        setUsername(meRes.username || null);
                    })
                    .catch((err) => {
                        setIsAuthenticated(false);
                        setIsAdmin(false);
                        setUsername(null);
                        document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                    })
                    .finally(() => setAuthLoading(false));
            } else {
                setIsAuthenticated(false);
                setIsAdmin(false);
                setUsername(null);
                setAuthLoading(false);
            }
        }

        checkAuth()

        const handleStorageChange = () => checkAuth()
        window.addEventListener('storage', handleStorageChange)

        return () => window.removeEventListener('storage', handleStorageChange)
    }, [])

    const handleSelectView = (nextView: string) => {
        setMountedViews((prev) => {
            if (prev.has(nextView)) return prev
            const next = new Set(prev)
            next.add(nextView)
            return next
        })
        setView(nextView)
    }

    const handleAuthSuccess = (authData: { isAdmin: boolean; username: string | null; userId: string | null }) => {
        setIsAuthenticated(true)
        setIsAdmin(authData.isAdmin)
        setUsername(authData.username)
    }

    const currentTabData = tabs.find(tab => tab.id === currentTab);
    const showTerminalView = currentTabData?.type === 'terminal' || currentTabData?.type === 'server' || currentTabData?.type === 'file_manager';
    const showHome = currentTabData?.type === 'home';
    const showSshManager = currentTabData?.type === 'ssh_manager';
    const showAdmin = currentTabData?.type === 'admin';

    return (
        <div>
            {!isAuthenticated && !authLoading && (
                <div>
                    <div className="absolute inset-0" style={{
                        backgroundImage: `linear-gradient(
                            135deg,
                            transparent 0%,
                            transparent 49%,
                            rgba(255, 255, 255, 0.03) 49%,
                            rgba(255, 255, 255, 0.03) 51%,
                            transparent 51%,
                            transparent 100%
                        )`,
                        backgroundSize: '80px 80px'
                    }} />
                </div>
            )}

            {!isAuthenticated && !authLoading && (
                <div className="fixed inset-0 flex items-center justify-center z-[10000]">
                    <Homepage 
                        onSelectView={handleSelectView}
                        isAuthenticated={isAuthenticated}
                        authLoading={authLoading}
                        onAuthSuccess={handleAuthSuccess}
                        isTopbarOpen={isTopbarOpen}
                    />
                </div>
            )}

            {isAuthenticated && (
                <LeftSidebar
                    onSelectView={handleSelectView}
                    disabled={!isAuthenticated || authLoading}
                    isAdmin={isAdmin}
                    username={username}
                >
                    <div
                        className="h-screen w-full"
                        style={{
                            visibility: showTerminalView ? "visible" : "hidden",
                            pointerEvents: showTerminalView ? "auto" : "none",
                            height: showTerminalView ? "100vh" : 0,
                            width: showTerminalView ? "100%" : 0,
                            position: showTerminalView ? "static" : "absolute",
                            overflow: "hidden",
                        }}
                    >
                        <AppView isTopbarOpen={isTopbarOpen} />
                    </div>

                    <div
                        className="h-screen w-full"
                        style={{
                            visibility: showHome ? "visible" : "hidden",
                            pointerEvents: showHome ? "auto" : "none",
                            height: showHome ? "100vh" : 0,
                            width: showHome ? "100%" : 0,
                            position: showHome ? "static" : "absolute",
                            overflow: "hidden",
                        }}
                    >
                        <Homepage 
                            onSelectView={handleSelectView}
                            isAuthenticated={isAuthenticated}
                            authLoading={authLoading}
                            onAuthSuccess={handleAuthSuccess}
                            isTopbarOpen={isTopbarOpen}
                        />
                    </div>

                    <div
                        className="h-screen w-full"
                        style={{
                            visibility: showSshManager ? "visible" : "hidden",
                            pointerEvents: showSshManager ? "auto" : "none",
                            height: showSshManager ? "100vh" : 0,
                            width: showSshManager ? "100%" : 0,
                            position: showSshManager ? "static" : "absolute",
                            overflow: "hidden",
                        }}
                    >
                        <HostManager onSelectView={handleSelectView} isTopbarOpen={isTopbarOpen} />
                    </div>

                    <div
                        className="h-screen w-full"
                        style={{
                            visibility: showAdmin ? "visible" : "hidden",
                            pointerEvents: showAdmin ? "auto" : "none",
                            height: showAdmin ? "100vh" : 0,
                            width: showAdmin ? "100%" : 0,
                            position: showAdmin ? "static" : "absolute",
                            overflow: "hidden",
                        }}
                    >
                        <AdminSettings isTopbarOpen={isTopbarOpen} />
                    </div>

                    <TopNavbar isTopbarOpen={isTopbarOpen} setIsTopbarOpen={setIsTopbarOpen}/>
                </LeftSidebar>
            )}
            <Toaster 
                position="bottom-right"
                richColors={false}
                closeButton
                duration={5000}
                offset={20}
            />
        </div>
    )
}

function App() {
    return (
        <TabProvider>
            <AppContent />
        </TabProvider>
    );
}

export default App