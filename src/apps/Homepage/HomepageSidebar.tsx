import React from 'react';
import {
    Computer,
    Server,
    File,
    Hammer
} from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem, SidebarProvider,
} from "@/components/ui/sidebar.tsx"

import {
    Separator,
} from "@/components/ui/separator.tsx"

interface SidebarProps {
    onSelectView: (view: string) => void;
}

export function HomepageSidebar({ onSelectView }: SidebarProps): React.ReactElement {
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel className="text-lg text-center font-bold text-white">
                            Termix
                        </SidebarGroupLabel>
                        <Separator className="p-0.25 mt-1 mb-1" />
                        <SidebarGroupContent>
                            <SidebarMenu>

                                {/* Sidebar Items */}
                                <SidebarMenuItem key={"SSH"}>
                                    <SidebarMenuButton asChild onClick={() => onSelectView("ssh")}>
                                        <div>
                                            <Computer/>
                                            <span>{"SSH"}</span>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem key={"SSH Tunnel"}>
                                    <SidebarMenuButton asChild onClick={() => onSelectView("ssh_tunnel")}>
                                        <div>
                                            <Server/>
                                            <span>{"SSH Tunnel"}</span>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem key={"Config Editor"}>
                                    <SidebarMenuButton asChild onClick={() => onSelectView("config_editor")}>
                                        <div>
                                            <File/>
                                            <span>{"Config Editor"}</span>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                <SidebarMenuItem key={"Tools"}>
                                    <SidebarMenuButton asChild onClick={() => onSelectView("tools")}>
                                        <div>
                                            <Hammer/>
                                            <span>{"Tools"}</span>
                                        </div>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>

                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
        </SidebarProvider>
    )
}