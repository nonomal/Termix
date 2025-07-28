import React from 'react';

import {
    CornerDownLeft
} from "lucide-react"

import {
    Button
} from "@/components/ui/button.tsx"

import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem, SidebarProvider,
} from "@/components/ui/sidebar.tsx"

import {
    Separator,
} from "@/components/ui/separator.tsx"

interface SidebarProps {
    onSelectView: (view: string) => void;
}

export function TemplateSidebar({onSelectView}: SidebarProps): React.ReactElement {
    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel className="text-lg font-bold text-white flex items-center gap-2">
                            Termix / Template
                        </SidebarGroupLabel>
                        <Separator className="p-0.25 mt-1 mb-1"/>
                        <SidebarGroupContent className="flex flex-col flex-grow">
                            <SidebarMenu>

                                <SidebarMenuItem key={"Homepage"}>
                                    <Button className="w-full mt-2 mb-2 h-8" onClick={() => onSelectView("homepage")}
                                            variant="outline">
                                        <CornerDownLeft/>
                                        Return
                                    </Button>
                                    <Separator className="p-0.25 mt-1 mb-1"/>
                                </SidebarMenuItem>

                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
        </SidebarProvider>
    )
}