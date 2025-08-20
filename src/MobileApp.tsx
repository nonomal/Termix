import {TerminalComponent} from "@/ui/desktop/Apps/Terminal/TerminalComponent.tsx";

export function MobileApp() {
    return (
        <div>
            <p>
                <TerminalComponent
                    hostConfig={{
                        ip: "192.210.197.55",
                        port: 22,
                        username: "root",
                        password: "bugatti$123",
                        authType: "password",
                    }}
                    isVisible={true}
                    title={"test"}
                    showTitle={false}
                    splitScreen={false}
                />
            </p>
        </div>
    )
}