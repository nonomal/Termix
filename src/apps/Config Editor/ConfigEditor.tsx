import {ConfigEditorSidebar} from "@/apps/Config Editor/ConfigEditorSidebar.tsx";
import React from "react";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

export function ConfigEditor({ onSelectView }: ConfigEditorProps): React.ReactElement {
    return (
        <div>
            <ConfigEditorSidebar
                onSelectView={onSelectView}
            />

            Config Editor
        </div>
    )
}