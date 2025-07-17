import React from "react";
import {ToolsSidebar} from "@/apps/Tools/ToolsSidebar.tsx";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

export function Tools({ onSelectView }: ConfigEditorProps): React.ReactElement {
    return (
        <div>
            <ToolsSidebar
                onSelectView={onSelectView}
            />

            Template
        </div>
    )
}