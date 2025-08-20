import {TerminalComponent} from "@/ui/mobile/Apps/Terminal/TerminalComponent.tsx";

export function MobileApp() {
    return (
        <div className="mobile-app-container">
                <TerminalComponent
                    hostConfig={{
                        ip: "192.210.197.55",
                        port: 22,
                        username: "root",
                        password: "bugatti$123",
                        authType: "password",
                    }}
                />
        </div>
    )
}