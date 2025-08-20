import React, {useEffect, useState} from "react";
import {HomepageAuth} from "@/ui/desktop/Homepage/HomepageAuth.tsx";
import axios from "axios";
import {HomepageUpdateLog} from "@/ui/desktop/Homepage/HompageUpdateLog.tsx";
import {HomepageAlertManager} from "@/ui/desktop/Homepage/HomepageAlertManager.tsx";
import {Button} from "@/components/ui/button.tsx";

interface HomepageProps {
    onSelectView: (view: string) => void;
    isAuthenticated: boolean;
    authLoading: boolean;
    onAuthSuccess: (authData: { isAdmin: boolean; username: string | null; userId: string | null }) => void;
    isTopbarOpen?: boolean;
}

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

const apiBase = import.meta.env.DEV ? "http://localhost:8081/users" : "/users";

const API = axios.create({
    baseURL: apiBase,
});

export function Homepage({
                             onSelectView,
                             isAuthenticated,
                             authLoading,
                             onAuthSuccess,
                             isTopbarOpen = true
                         }: HomepageProps): React.ReactElement {
    const [loggedIn, setLoggedIn] = useState(isAuthenticated);
    const [isAdmin, setIsAdmin] = useState(false);
    const [username, setUsername] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [dbError, setDbError] = useState<string | null>(null);

    useEffect(() => {
        setLoggedIn(isAuthenticated);
    }, [isAuthenticated]);

    useEffect(() => {
        if (isAuthenticated) {
            const jwt = getCookie("jwt");
            if (jwt) {
                Promise.all([
                    API.get("/me", {headers: {Authorization: `Bearer ${jwt}`}}),
                    API.get("/db-health")
                ])
                    .then(([meRes]) => {
                        setIsAdmin(!!meRes.data.is_admin);
                        setUsername(meRes.data.username || null);
                        setUserId(meRes.data.userId || null);
                        setDbError(null);
                    })
                    .catch((err) => {
                        setIsAdmin(false);
                        setUsername(null);
                        setUserId(null);
                        if (err?.response?.data?.error?.includes("Database")) {
                            setDbError("Could not connect to the database. Please try again later.");
                        } else {
                            setDbError(null);
                        }
                    });
            }
        }
    }, [isAuthenticated]);

    return (
        <div
            className={`w-full min-h-svh grid place-items-center relative transition-[padding-top] duration-200 ease-linear ${
                isTopbarOpen ? 'pt-[66px]' : 'pt-2'
            }`}>
            <div className="flex flex-row items-center justify-center gap-8 relative z-[10000]">
                <HomepageAuth
                    setLoggedIn={setLoggedIn}
                    setIsAdmin={setIsAdmin}
                    setUsername={setUsername}
                    setUserId={setUserId}
                    loggedIn={loggedIn}
                    authLoading={authLoading}
                    dbError={dbError}
                    setDbError={setDbError}
                    onAuthSuccess={onAuthSuccess}
                />

                <div className="flex flex-row items-center justify-center gap-8">
                    {loggedIn && (
                        <div className="flex flex-col items-center gap-4 w-[350px]">
                            <div
                                className="my-2 text-center bg-muted/50 border-2 border-[#303032] rounded-lg p-4 w-full">
                                <h3 className="text-lg font-semibold mb-2">Logged in!</h3>
                                <p className="text-muted-foreground">
                                    You are logged in! Use the sidebar to access all available tools. To get started,
                                    create an SSH Host in the SSH Manager tab. Once created, you can connect to that
                                    host using the other apps in the sidebar.
                                </p>
                            </div>

                            <div className="flex flex-row items-center gap-2">
                                <Button
                                    variant="link"
                                    className="text-sm"
                                    onClick={() => window.open('https://github.com/LukeGus/Termix', '_blank')}
                                >
                                    GitHub
                                </Button>
                                <div className="w-px h-4 bg-border"></div>
                                <Button
                                    variant="link"
                                    className="text-sm"
                                    onClick={() => window.open('https://github.com/LukeGus/Termix/issues/new', '_blank')}
                                >
                                    Feedback
                                </Button>
                                <div className="w-px h-4 bg-border"></div>
                                <Button
                                    variant="link"
                                    className="text-sm"
                                    onClick={() => window.open('https://discord.com/invite/jVQGdvHDrf', '_blank')}
                                >
                                    Discord
                                </Button>
                                <div className="w-px h-4 bg-border"></div>
                                <Button
                                    variant="link"
                                    className="text-sm"
                                    onClick={() => window.open('https://github.com/sponsors/LukeGus', '_blank')}
                                >
                                    Donate
                                </Button>
                            </div>
                        </div>
                    )}

                    <HomepageUpdateLog
                        loggedIn={loggedIn}
                    />
                </div>
            </div>

            <HomepageAlertManager
                userId={userId}
                loggedIn={loggedIn}
            />
        </div>
    );
}