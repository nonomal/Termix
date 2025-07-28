import React from "react";
import {TemplateSidebar} from "@/apps/Template/TemplateSidebar.tsx";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

export function Template({onSelectView}: ConfigEditorProps): React.ReactElement {
    return (
        <div>
            <TemplateSidebar
                onSelectView={onSelectView}
            />

            Template
        </div>
    )
}