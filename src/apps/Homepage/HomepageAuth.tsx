import React, {useState, useEffect} from "react";
import {cn} from "@/lib/utils";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {Label} from "@/components/ui/label";
import {Alert, AlertTitle, AlertDescription} from "@/components/ui/alert";
import axios from "axios";

function setCookie(name: string, value: string, days = 7) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name: string) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, "");
}

const apiBase =
    typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:8081/users"
        : "/users";

const API = axios.create({
    baseURL: apiBase,
});

interface HomepageAuthProps extends React.ComponentProps<"div"> {
    setLoggedIn: (loggedIn: boolean) => void;
    setIsAdmin: (isAdmin: boolean) => void;
    setUsername: (username: string | null) => void;
    loggedIn: boolean;
    authLoading: boolean;
    dbError: string | null;
    setDbError: (error: string | null) => void;
}

export function HomepageAuth({
                                 className,
                                 setLoggedIn,
                                 setIsAdmin,
                                 setUsername,
                                 loggedIn,
                                 authLoading,
                                 dbError,
                                 setDbError,
                                 ...props
                             }: HomepageAuthProps) {
    const [tab, setTab] = useState<"login" | "signup">("login");
    const [localUsername, setLocalUsername] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [internalLoggedIn, setInternalLoggedIn] = useState(false);
    const [firstUser, setFirstUser] = useState(false);
    const [registrationAllowed, setRegistrationAllowed] = useState(true);

    useEffect(() => {
        setInternalLoggedIn(loggedIn);
    }, [loggedIn]);

    useEffect(() => {
        API.get("/registration-allowed").then(res => {
            setRegistrationAllowed(res.data.allowed);
        });
    }, []);

    useEffect(() => {
        API.get("/count").then(res => {
            if (res.data.count === 0) {
                setFirstUser(true);
                setTab("signup");
            } else {
                setFirstUser(false);
            }
            setDbError(null);
        }).catch(() => {
            setDbError("Could not connect to the database. Please try again later.");
        });
    }, [setDbError]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            let res, meRes;
            if (tab === "login") {
                res = await API.post("/get", {username: localUsername, password});
            } else {
                await API.post("/create", {username: localUsername, password});
                res = await API.post("/get", {username: localUsername, password});
            }
            setCookie("jwt", res.data.token);
            [meRes] = await Promise.all([
                API.get("/me", {headers: {Authorization: `Bearer ${res.data.token}`}}),
                API.get("/db-health")
            ]);
            setInternalLoggedIn(true);
            setLoggedIn(true);
            setIsAdmin(!!meRes.data.is_admin);
            setUsername(meRes.data.username || null);
            setDbError(null);
        } catch (err: any) {
            setError(err?.response?.data?.error || "Unknown error");
            setInternalLoggedIn(false);
            setLoggedIn(false);
            setIsAdmin(false);
            setUsername(null);
            setCookie("jwt", "", -1);
            if (err?.response?.data?.error?.includes("Database")) {
                setDbError("Could not connect to the database. Please try again later.");
            } else {
                setDbError(null);
            }
        } finally {
            setLoading(false);
        }
    }

    const Spinner = (
        <svg className="animate-spin mr-2 h-4 w-4 text-white inline-block" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
    );

    return (
        <div
            className={cn(
                "flex-1 flex justify-center items-center min-h-screen bg-background",
                className
            )}
            {...props}
        >
            <div
                className={`w-[420px] max-w-full bg-background rounded-xl shadow-lg p-6 flex flex-col ${internalLoggedIn ? '' : 'border border-border'}`}>
                {dbError && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{dbError}</AlertDescription>
                    </Alert>
                )}
                {firstUser && !dbError && !internalLoggedIn && (
                    <Alert variant="default" className="mb-4">
                        <AlertTitle>First User</AlertTitle>
                        <AlertDescription className="inline">
                            You are the first user and will be made an admin. You can view admin settings in the sidebar user dropdown. If you think this is a mistake, check the docker logs, or create a{" "}
                            <a
                                href="https://github.com/LukeGus/Termix/issues/new"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 underline hover:text-blue-800 inline"
                            >
                                GitHub issue
                            </a>.
                        </AlertDescription>
                    </Alert>
                )}
                {!registrationAllowed && !internalLoggedIn && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTitle>Registration Disabled</AlertTitle>
                        <AlertDescription>
                            New account registration is currently disabled by an admin. Please log in or contact an
                            administrator.
                        </AlertDescription>
                    </Alert>
                )}
                {(internalLoggedIn || (authLoading && getCookie("jwt"))) && (
                    <div className="flex flex-1 justify-center items-center p-0 m-0">
                        <div className="flex flex-col items-center gap-4">
                            <Alert className="my-2">
                                <AlertTitle>Logged in!</AlertTitle>
                                <AlertDescription>
                                    You are logged in! Use the sidebar to access all available tools. To get started,
                                    create an SSH Host in the SSH Manager tab. Once created, you can connect to that
                                    host using the other apps in the sidebar.
                                </AlertDescription>
                            </Alert>

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
                                    Fund
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
                {(!internalLoggedIn && (!authLoading || !getCookie("jwt"))) && (
                    <>
                        <div className="flex gap-2 mb-6">
                            <button
                                type="button"
                                className={cn(
                                    "flex-1 py-2 text-base font-medium rounded-md transition-all",
                                    tab === "login"
                                        ? "bg-primary text-primary-foreground shadow"
                                        : "bg-muted text-muted-foreground hover:bg-accent"
                                )}
                                onClick={() => setTab("login")}
                                aria-selected={tab === "login"}
                                disabled={loading || firstUser}
                            >
                                Login
                            </button>
                            <button
                                type="button"
                                className={cn(
                                    "flex-1 py-2 text-base font-medium rounded-md transition-all",
                                    tab === "signup"
                                        ? "bg-primary text-primary-foreground shadow"
                                        : "bg-muted text-muted-foreground hover:bg-accent"
                                )}
                                onClick={() => setTab("signup")}
                                aria-selected={tab === "signup"}
                                disabled={loading || !registrationAllowed}
                            >
                                Sign Up
                            </button>
                        </div>
                        <div className="mb-6 text-center">
                            <h2 className="text-xl font-bold mb-1">
                                {tab === "login" ? "Login to your account" : "Create a new account"}
                            </h2>
                        </div>
                        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="username">Username</Label>
                                <Input
                                    id="username"
                                    type="text"
                                    required
                                    className="h-11 text-base"
                                    value={localUsername}
                                    onChange={e => setLocalUsername(e.target.value)}
                                    disabled={loading || internalLoggedIn}
                                />
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="password">Password</Label>
                                <Input id="password" type="password" required className="h-11 text-base"
                                       value={password} onChange={e => setPassword(e.target.value)}
                                       disabled={loading || internalLoggedIn}/>
                            </div>
                            <Button type="submit" className="w-full h-11 mt-2 text-base font-semibold"
                                    disabled={loading || internalLoggedIn}>
                                {loading ? Spinner : (tab === "login" ? "Login" : "Sign Up")}
                            </Button>
                        </form>
                    </>
                )}
                {error && (
                    <Alert variant="destructive" className="mt-4">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    );
}