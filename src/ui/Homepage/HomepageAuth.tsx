import React, {useState, useEffect} from "react";
import {cn} from "../../lib/utils.ts";
import {Button} from "../../components/ui/button.tsx";
import {Input} from "../../components/ui/input.tsx";
import {Label} from "../../components/ui/label.tsx";
import {Alert, AlertTitle, AlertDescription} from "../../components/ui/alert.tsx";
import {
    registerUser,
    loginUser,
    getUserInfo,
    getRegistrationAllowed,
    getOIDCConfig,
    getUserCount,
    initiatePasswordReset,
    verifyPasswordResetCode,
    completePasswordReset,
    getOIDCAuthorizeUrl
} from "../main-axios.ts";

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



interface HomepageAuthProps extends React.ComponentProps<"div"> {
    setLoggedIn: (loggedIn: boolean) => void;
    setIsAdmin: (isAdmin: boolean) => void;
    setUsername: (username: string | null) => void;
    setUserId: (userId: string | null) => void;
    loggedIn: boolean;
    authLoading: boolean;
    dbError: string | null;
    setDbError: (error: string | null) => void;
    onAuthSuccess: (authData: { isAdmin: boolean; username: string | null; userId: string | null }) => void;
}

export function HomepageAuth({
                                 className,
                                 setLoggedIn,
                                 setIsAdmin,
                                 setUsername,
                                 setUserId,
                                 loggedIn,
                                 authLoading,
                                 dbError,
                                 setDbError,
                                 onAuthSuccess,
                                 ...props
                             }: HomepageAuthProps) {
    const [tab, setTab] = useState<"login" | "signup" | "external" | "reset">("login");
    const [localUsername, setLocalUsername] = useState("");
    const [password, setPassword] = useState("");
    const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [oidcLoading, setOidcLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [internalLoggedIn, setInternalLoggedIn] = useState(false);
    const [firstUser, setFirstUser] = useState(false);
    const [registrationAllowed, setRegistrationAllowed] = useState(true);
    const [oidcConfigured, setOidcConfigured] = useState(false);

    const [resetStep, setResetStep] = useState<"initiate" | "verify" | "newPassword">("initiate");
    const [resetCode, setResetCode] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [tempToken, setTempToken] = useState("");
    const [resetLoading, setResetLoading] = useState(false);
    const [resetSuccess, setResetSuccess] = useState(false);

    useEffect(() => {
        setInternalLoggedIn(loggedIn);
    }, [loggedIn]);

    useEffect(() => {
        getRegistrationAllowed().then(res => {
            setRegistrationAllowed(res.allowed);
        });
    }, []);

    useEffect(() => {
        getOIDCConfig().then((response) => {
            if (response) {
                setOidcConfigured(true);
            } else {
                setOidcConfigured(false);
            }
        }).catch((error) => {
            if (error.response?.status === 404) {
                setOidcConfigured(false);
            } else {
                setOidcConfigured(false);
            }
        });
    }, []);

    useEffect(() => {
        getUserCount().then(res => {
            if (res.count === 0) {
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

        if (!localUsername.trim()) {
            setError("Username is required");
            setLoading(false);
            return;
        }

        try {
            let res, meRes;
            if (tab === "login") {
                res = await loginUser(localUsername, password);
            } else {
                if (password !== signupConfirmPassword) {
                    setError("Passwords do not match");
                    setLoading(false);
                    return;
                }
                if (password.length < 6) {
                    setError("Password must be at least 6 characters long");
                    setLoading(false);
                    return;
                }

                await registerUser(localUsername, password);
                res = await loginUser(localUsername, password);
            }
            
            if (!res || !res.token) {
                throw new Error('No token received from login');
            }
            
            setCookie("jwt", res.token);
            [meRes] = await Promise.all([
                getUserInfo(),
            ]);
            
            setInternalLoggedIn(true);
            setLoggedIn(true);
            setIsAdmin(!!meRes.is_admin);
            setUsername(meRes.username || null);
            setUserId(meRes.userId || null);
            setDbError(null);
            onAuthSuccess({
                isAdmin: !!meRes.is_admin,
                username: meRes.username || null,
                userId: meRes.userId || null
            });
            setInternalLoggedIn(true);
            if (tab === "signup") {
                setSignupConfirmPassword("");
            }
        } catch (err: any) {
            setError(err?.response?.data?.error || err?.message || "Unknown error");
            setInternalLoggedIn(false);
            setLoggedIn(false);
            setIsAdmin(false);
            setUsername(null);
            setUserId(null);
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

    async function handleInitiatePasswordReset() {
        setError(null);
        setResetLoading(true);
        try {
            const result = await initiatePasswordReset(localUsername);
            setResetStep("verify");
            setError(null);
        } catch (err: any) {
            setError(err?.response?.data?.error || err?.message || "Failed to initiate password reset");
        } finally {
            setResetLoading(false);
        }
    }

    async function handleVerifyResetCode() {
        setError(null);
        setResetLoading(true);
        try {
            const response = await verifyPasswordResetCode(localUsername, resetCode);
            setTempToken(response.tempToken);
            setResetStep("newPassword");
            setError(null);
        } catch (err: any) {
            setError(err?.response?.data?.error || "Failed to verify reset code");
        } finally {
            setResetLoading(false);
        }
    }

    async function handleCompletePasswordReset() {
        setError(null);
        setResetLoading(true);

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            setResetLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters long");
            setResetLoading(false);
            return;
        }

        try {
            await completePasswordReset(localUsername, tempToken, newPassword);

            setResetStep("initiate");
            setResetCode("");
            setNewPassword("");
            setConfirmPassword("");
            setTempToken("");
            setError(null);

            setResetSuccess(true);
        } catch (err: any) {
            setError(err?.response?.data?.error || "Failed to complete password reset");
        } finally {
            setResetLoading(false);
        }
    }

    function resetPasswordState() {
        setResetStep("initiate");
        setResetCode("");
        setNewPassword("");
        setConfirmPassword("");
        setTempToken("");
        setError(null);
        setResetSuccess(false);
        setSignupConfirmPassword("");
    }

    function clearFormFields() {
        setPassword("");
        setSignupConfirmPassword("");
        setError(null);
    }

    async function handleOIDCLogin() {
        setError(null);
        setOidcLoading(true);
        try {
            const authResponse = await getOIDCAuthorizeUrl();
            const {auth_url: authUrl} = authResponse;

            if (!authUrl || authUrl === 'undefined') {
                throw new Error('Invalid authorization URL received from backend');
            }

            window.location.replace(authUrl);
        } catch (err: any) {
            setError(err?.response?.data?.error || err?.message || "Failed to start OIDC login");
            setOidcLoading(false);
        }
    }

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const token = urlParams.get('token');
        const error = urlParams.get('error');

        if (error) {
            setError(`OIDC authentication failed: ${error}`);
            setOidcLoading(false);
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (success && token) {
            setOidcLoading(true);
            setError(null);

            setCookie("jwt", token);
            getUserInfo()
                .then(meRes => {
                    setInternalLoggedIn(true);
                    setLoggedIn(true);
                    setIsAdmin(!!meRes.is_admin);
                    setUsername(meRes.username || null);
                    setUserId(meRes.id || null);
                    setDbError(null);
                    onAuthSuccess({
                        isAdmin: !!meRes.is_admin,
                        username: meRes.username || null,
                        userId: meRes.id || null
                    });
                    setInternalLoggedIn(true);
                    window.history.replaceState({}, document.title, window.location.pathname);
                })
                .catch(err => {
                    setError("Failed to get user info after OIDC login");
                    setInternalLoggedIn(false);
                    setLoggedIn(false);
                    setIsAdmin(false);
                    setUsername(null);
                    setUserId(null);
                    setCookie("jwt", "", -1);
                    window.history.replaceState({}, document.title, window.location.pathname);
                })
                .finally(() => {
                    setOidcLoading(false);
                });
        }
    }, []);

    const Spinner = (
        <svg className="animate-spin mr-2 h-4 w-4 text-white inline-block" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
        </svg>
    );

    return (
        <div
            className={`w-[420px] max-w-full p-6 flex flex-col bg-[#18181b] border-2 border-[#303032] rounded-md ${className || ''}`}
            {...props}
        >
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
                        You are the first user and will be made an admin. You can view admin settings in the sidebar
                        user dropdown. If you think this is a mistake, check the docker logs, or create a{" "}
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
                            onClick={() => {
                                setTab("login");
                                if (tab === "reset") resetPasswordState();
                                if (tab === "signup") clearFormFields();
                            }}
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
                            onClick={() => {
                                setTab("signup");
                                if (tab === "reset") resetPasswordState();
                                if (tab === "login") clearFormFields();
                            }}
                            aria-selected={tab === "signup"}
                            disabled={loading || !registrationAllowed}
                        >
                            Sign Up
                        </button>
                        {oidcConfigured && (
                            <button
                                type="button"
                                className={cn(
                                    "flex-1 py-2 text-base font-medium rounded-md transition-all",
                                    tab === "external"
                                        ? "bg-primary text-primary-foreground shadow"
                                        : "bg-muted text-muted-foreground hover:bg-accent"
                                )}
                                onClick={() => {
                                    setTab("external");
                                    if (tab === "reset") resetPasswordState();
                                    if (tab === "login" || tab === "signup") clearFormFields();
                                }}
                                aria-selected={tab === "external"}
                                disabled={oidcLoading}
                            >
                                External
                            </button>
                        )}
                    </div>
                    <div className="mb-6 text-center">
                        <h2 className="text-xl font-bold mb-1">
                            {tab === "login" ? "Login to your account" :
                                tab === "signup" ? "Create a new account" :
                                    tab === "external" ? "Login with external provider" :
                                        "Reset your password"}
                        </h2>
                    </div>

                    {tab === "external" || tab === "reset" ? (
                        <div className="flex flex-col gap-5">
                            {tab === "external" && (
                                <>
                                    <div className="text-center text-muted-foreground mb-4">
                                        <p>Login using your configured external identity provider</p>
                                    </div>
                                    <Button
                                        type="button"
                                        className="w-full h-11 mt-2 text-base font-semibold"
                                        disabled={oidcLoading}
                                        onClick={handleOIDCLogin}
                                    >
                                        {oidcLoading ? Spinner : "Login with External Provider"}
                                    </Button>
                                </>
                            )}
                            {tab === "reset" && (
                                <>
                                    {resetStep === "initiate" && (
                                        <>
                                            <div className="text-center text-muted-foreground mb-4">
                                                <p>Enter your username to receive a password reset code. The code
                                                    will be logged in the docker container logs.</p>
                                            </div>
                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="reset-username">Username</Label>
                                                    <Input
                                                        id="reset-username"
                                                        type="text"
                                                        required
                                                        className="h-11 text-base"
                                                        value={localUsername}
                                                        onChange={e => setLocalUsername(e.target.value)}
                                                        disabled={resetLoading}
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    className="w-full h-11 text-base font-semibold"
                                                    disabled={resetLoading || !localUsername.trim()}
                                                    onClick={handleInitiatePasswordReset}
                                                >
                                                    {resetLoading ? Spinner : "Send Reset Code"}
                                                </Button>
                                            </div>
                                        </>
                                    )}

                                    {resetStep === "verify" && (
                                        <>
                                            <div className="text-center text-muted-foreground mb-4">
                                                <p>Enter the 6-digit code from the docker container logs for
                                                    user: <strong>{localUsername}</strong></p>
                                            </div>
                                            <div className="flex flex-col gap-4">
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="reset-code">Reset Code</Label>
                                                    <Input
                                                        id="reset-code"
                                                        type="text"
                                                        required
                                                        maxLength={6}
                                                        className="h-11 text-base text-center text-lg tracking-widest"
                                                        value={resetCode}
                                                        onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                                                        disabled={resetLoading}
                                                        placeholder="000000"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    className="w-full h-11 text-base font-semibold"
                                                    disabled={resetLoading || resetCode.length !== 6}
                                                    onClick={handleVerifyResetCode}
                                                >
                                                    {resetLoading ? Spinner : "Verify Code"}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full h-11 text-base font-semibold"
                                                    disabled={resetLoading}
                                                    onClick={() => {
                                                        setResetStep("initiate");
                                                        setResetCode("");
                                                    }}
                                                >
                                                    Back
                                                </Button>
                                            </div>
                                        </>
                                    )}

                                    {resetSuccess && (
                                        <>
                                            <Alert className="mb-4">
                                                <AlertTitle>Success!</AlertTitle>
                                                <AlertDescription>
                                                    Your password has been successfully reset! You can now log in
                                                    with your new password.
                                                </AlertDescription>
                                            </Alert>
                                            <Button
                                                type="button"
                                                className="w-full h-11 text-base font-semibold"
                                                onClick={() => {
                                                    setTab("login");
                                                    resetPasswordState();
                                                }}
                                            >
                                                Go to Login
                                            </Button>
                                        </>
                                    )}

                                    {resetStep === "newPassword" && !resetSuccess && (
                                        <>
                                            <div className="text-center text-muted-foreground mb-4">
                                                <p>Enter your new password for
                                                    user: <strong>{localUsername}</strong></p>
                                            </div>
                                            <div className="flex flex-col gap-5">
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="new-password">New Password</Label>
                                                    <Input
                                                        id="new-password"
                                                        type="password"
                                                        required
                                                        className="h-11 text-base focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                                                        value={newPassword}
                                                        onChange={e => setNewPassword(e.target.value)}
                                                        disabled={resetLoading}
                                                        autoComplete="new-password"
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    <Label htmlFor="confirm-password">Confirm Password</Label>
                                                    <Input
                                                        id="confirm-password"
                                                        type="password"
                                                        required
                                                        className="h-11 text-base focus:ring-2 focus:ring-primary/50 transition-all duration-200"
                                                        value={confirmPassword}
                                                        onChange={e => setConfirmPassword(e.target.value)}
                                                        disabled={resetLoading}
                                                        autoComplete="new-password"
                                                    />
                                                </div>
                                                <Button
                                                    type="button"
                                                    className="w-full h-11 text-base font-semibold"
                                                    disabled={resetLoading || !newPassword || !confirmPassword}
                                                    onClick={handleCompletePasswordReset}
                                                >
                                                    {resetLoading ? Spinner : "Reset Password"}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="w-full h-11 text-base font-semibold"
                                                    disabled={resetLoading}
                                                    onClick={() => {
                                                        setResetStep("verify");
                                                        setNewPassword("");
                                                        setConfirmPassword("");
                                                    }}
                                                >
                                                    Back
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    ) : (
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
                            {tab === "signup" && (
                                <div className="flex flex-col gap-2">
                                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                                    <Input id="signup-confirm-password" type="password" required
                                           className="h-11 text-base"
                                           value={signupConfirmPassword}
                                           onChange={e => setSignupConfirmPassword(e.target.value)}
                                           disabled={loading || internalLoggedIn}/>
                                </div>
                            )}
                            <Button type="submit" className="w-full h-11 mt-2 text-base font-semibold"
                                    disabled={loading || internalLoggedIn}>
                                {loading ? Spinner : (tab === "login" ? "Login" : "Sign Up")}
                            </Button>
                            {tab === "login" && (
                                <Button type="button" variant="outline"
                                        className="w-full h-11 text-base font-semibold"
                                        disabled={loading || internalLoggedIn}
                                        onClick={() => {
                                            setTab("reset");
                                            resetPasswordState();
                                            clearFormFields();
                                        }}
                                >
                                    Reset Password
                                </Button>
                            )}
                        </form>
                    )}
                </>
            )}
            {error && (
                <Alert variant="destructive" className="mt-4">
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
        </div>
    );
}