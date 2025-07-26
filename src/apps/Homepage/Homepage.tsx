import {HomepageSidebar} from "@/apps/Homepage/HomepageSidebar.tsx";
import React, {useEffect, useState} from "react";
import {HomepageAuth} from "@/apps/Homepage/HomepageAuth.tsx";

interface HomepageProps {
    onSelectView: (view: string) => void;
}

export function Homepage({onSelectView}: HomepageProps): React.ReactElement {
    const [loggedIn, setLoggedIn] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [username, setUsername] = useState<string | null>(null);

    return (
        <div className="flex min-h-screen">
            <HomepageSidebar
                onSelectView={onSelectView}
                disabled={!loggedIn}
                isAdmin={isAdmin}
                username={loggedIn ? username : null}
            />
            <div className="flex-1 bg-background"/>
            <div
                className="fixed inset-y-0 right-0 flex justify-center items-center z-50"
                style={{left: 256}}
            >
                <HomepageAuth
                    setLoggedIn={setLoggedIn}
                    setIsAdmin={setIsAdmin}
                    setUsername={setUsername}
                />
            </div>
        </div>
    );
}