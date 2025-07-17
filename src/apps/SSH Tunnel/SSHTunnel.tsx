import React from "react";
import {SSHTunnelSidebar} from "@/apps/SSH Tunnel/SSHTunnelSidebar.tsx";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

export function SSHTunnel({ onSelectView }: ConfigEditorProps): React.ReactElement {
    return (
        <div>
            <SSHTunnelSidebar
                onSelectView={onSelectView}
            />

            SSH Tunnel
        </div>
    )
}