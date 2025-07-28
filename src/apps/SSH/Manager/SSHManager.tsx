import React, {useState} from "react";
import {SSHManagerSidebar} from "@/apps/SSH/Manager/SSHManagerSidebar.tsx";
import {SSHManagerHostViewer} from "@/apps/SSH/Manager/SSHManagerHostViewer.tsx"
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import {SSHManagerHostEditor} from "@/apps/SSH/Manager/SSHManagerHostEditor.tsx";

interface ConfigEditorProps {
    onSelectView: (view: string) => void;
}

interface SSHHost {
    id: number;
    name: string;
    ip: string;
    port: number;
    username: string;
    folder: string;
    tags: string[];
    pin: boolean;
    authType: string;
    password?: string;
    key?: string;
    keyPassword?: string;
    keyType?: string;
    enableTerminal: boolean;
    enableTunnel: boolean;
    enableConfigEditor: boolean;
    defaultPath: string;
    tunnelConnections: any[];
    createdAt: string;
    updatedAt: string;
}

export function SSHManager({onSelectView}: ConfigEditorProps): React.ReactElement {
    const [activeTab, setActiveTab] = useState("host_viewer");
    const [editingHost, setEditingHost] = useState<SSHHost | null>(null);

    const handleEditHost = (host: SSHHost) => {
        setEditingHost(host);
        setActiveTab("add_host");
    };

    const handleFormSubmit = () => {
        setEditingHost(null);
        setActiveTab("host_viewer");
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        if (value === "host_viewer") {
            setEditingHost(null);
        }
    };

    return (
        <div>
            <SSHManagerSidebar
                onSelectView={onSelectView}
            />

            <div className="flex w-screen h-screen overflow-hidden">
                <div className="w-[256px]"/>

                <div
                    className="flex-1 bg-[#18181b] m-[35px] text-white p-4 rounded-md w-[1200px] border h-[calc(100vh-70px)] flex flex-col min-h-0">
                    <Tabs value={activeTab} onValueChange={handleTabChange}
                          className="flex-1 flex flex-col h-full min-h-0">
                        <TabsList>
                            <TabsTrigger value="host_viewer">Host Viewer</TabsTrigger>
                            <TabsTrigger value="add_host">
                                {editingHost ? "Edit Host" : "Add Host"}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="host_viewer" className="flex-1 flex flex-col h-full min-h-0">
                            <Separator className="p-0.25 mt-1 mb-1"/>
                            <SSHManagerHostViewer onEditHost={handleEditHost}/>
                        </TabsContent>
                        <TabsContent value="add_host" className="flex-1 flex flex-col h-full min-h-0">
                            <Separator className="p-0.25 mt-1 mb-1"/>
                            <div className="flex flex-col h-full min-h-0">
                                <SSHManagerHostEditor
                                    editingHost={editingHost}
                                    onFormSubmit={handleFormSubmit}
                                />
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    )
}