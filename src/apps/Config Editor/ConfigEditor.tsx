import React, { useState } from "react";
import {ConfigEditorSidebar} from "@/apps/Config Editor/ConfigEditorSidebar.tsx";
import {ConfigCodeEditor} from "@/apps/Config Editor/ConfigCodeEditor.tsx";
import {ConfigTopbar} from "@/apps/Config Editor/ConfigTopbar.tsx";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

export function ConfigEditor({onSelectView}: ConfigEditorProps): React.ReactElement {
    const [content, setContent] = useState<string>("");
    const [fileName, setFileName] = useState<string>("config.yaml");
    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
            {/* Sidebar - fixed width, full height */}
            <div style={{ position: 'absolute', top: 0, left: 0, width: 256, height: '100vh', zIndex: 20 }}>
                <ConfigEditorSidebar onSelectView={onSelectView} />
            </div>
            {/* Topbar - fixed height, full width minus sidebar */}
            <div style={{ position: 'absolute', top: 0, left: 256, right: 0, height: 46, zIndex: 30 }}>
                <ConfigTopbar />
            </div>
            {/* Editor area - fills remaining space, with padding for sidebar and topbar */}
            <div style={{ position: 'absolute', top: 46, left: 256, right: 0, bottom: 0, overflow: 'hidden', zIndex: 10 }}>
                <ConfigCodeEditor
                    content={content}
                    fileName={fileName}
                    onContentChange={setContent}
                />
            </div>
        </div>
    )
}