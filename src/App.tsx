import React, {useEffect} from "react"

import {Homepage} from "@/apps/Homepage/Homepage.tsx"
import {SSH} from "@/apps/SSH/Terminal/SSH.tsx"
import {SSHTunnel} from "@/apps/SSH/Tunnel/SSHTunnel.tsx";
import {ConfigEditor} from "@/apps/SSH/Config Editor/ConfigEditor.tsx";
import {Tools} from "@/apps/Tools/Tools.tsx";
import {SSHManager} from "@/apps/SSH/Manager/SSHManager.tsx"

function App() {
    const [view, setView] = React.useState<string>("homepage")

    const renderActiveView = () => {
        switch (view) {
            case "homepage":
                return <Homepage
                    onSelectView={setView}
                />
            case "ssh_manager":
                return <SSHManager
                    onSelectView={setView}
                />
            case "terminal":
                return <SSH
                    onSelectView={setView}
                />
            case "tunnel":
                return <SSHTunnel
                    onSelectView={setView}
                />
            case "config_editor":
                return <ConfigEditor
                    onSelectView={setView}
                />
            case "tools":
                return <Tools
                    onSelectView={setView}
                />
        }
    }

    return (
        <div className="flex">
            <main>
                {renderActiveView()}
            </main>
        </div>
    )
}

export default App