import React from 'react';
import {
    Computer,
    Server,
    File,
    Hammer, ChevronUp, User2, HardDrive
} from "lucide-react";

import {
    Sidebar,
    SidebarContent, SidebarFooter,
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
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from "@radix-ui/react-dropdown-menu";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
    SheetClose
} from "@/components/ui/sheet";
import {Checkbox} from "@/components/ui/checkbox.tsx";
import axios from "axios";
import {Button} from "@/components/ui/button.tsx";

interface SidebarProps {
    onSelectView: (view: string) => void;
    disabled?: boolean;
    isAdmin?: boolean;
    username?: string | null;
}

function handleLogout() {
    document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    window.location.reload();
}

function getCookie(name: string) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, "");
}

const apiBase =
    typeof window !== "undefined" && window.location.hostname === "localhost"
        ? "http://localhost:8081/users"
        : "/users";

const API = axios.create({
    baseURL: apiBase,
});

export function HomepageSidebar({
                                    onSelectView,
                                    getView,
                                    disabled,
                                    isAdmin,
                                    username
                                }: SidebarProps): React.ReactElement {
    const [adminSheetOpen, setAdminSheetOpen] = React.useState(false);
    const [allowRegistration, setAllowRegistration] = React.useState(true);
    const [regLoading, setRegLoading] = React.useState(false);
    React.useEffect(() => {
        if (adminSheetOpen) {
            API.get("/registration-allowed").then(res => {
                setAllowRegistration(res.data.allowed);
            });
        }
    }, [adminSheetOpen]);
    const handleToggle = async (checked: boolean) => {
        setRegLoading(true);
        const jwt = getCookie("jwt");
        try {
            await API.patch(
                "/registration-allowed",
                {allowed: checked},
                {headers: {Authorization: `Bearer ${jwt}`}}
            );
            setAllowRegistration(checked);
        } catch (e) {
        } finally {
            setRegLoading(false);
        }
    };

    return (
        <div>
            <SidebarProvider>
                <Sidebar>
                    <SidebarContent>
                        <SidebarGroup>
                            <SidebarGroupLabel className="text-lg font-bold text-white flex items-center gap-2">
                                Termix
                            </SidebarGroupLabel>
                            <Separator className="p-0.25 mt-1 mb-1"/>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    <SidebarMenuItem key={"SSH Manager"}>
                                        <SidebarMenuButton onClick={() => onSelectView("ssh_manager")}
                                                           disabled={disabled}>
                                            <HardDrive/>
                                            <span>SSH Manager</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                    <div className="ml-5">
                                        <SidebarMenuItem key={"Terminal"}>
                                            <SidebarMenuButton onClick={() => onSelectView("terminal")}
                                                               disabled={disabled}>
                                                <Computer/>
                                                <span>Terminal</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem key={"Tunnel"}>
                                            <SidebarMenuButton onClick={() => onSelectView("tunnel")}
                                                               disabled={disabled}>
                                                <Server/>
                                                <span>Tunnel</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                        <SidebarMenuItem key={"Config Editor"}>
                                            <SidebarMenuButton onClick={() => onSelectView("config_editor")}
                                                               disabled={disabled}>
                                                <File/>
                                                <span>Config Editor</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    </div>
                                    <SidebarMenuItem key={"Tools"}>
                                        <SidebarMenuButton onClick={() => window.open("https://dashix.dev", "_blank")} disabled={disabled}>
                                            <Hammer/>
                                            <span>Tools</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>
                    </SidebarContent>
                    <Separator className="p-0.25 mt-1 mb-1"/>
                    <SidebarFooter>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <SidebarMenuButton
                                            className="data-[state=open]:opacity-90 w-full"
                                            style={{width: '100%'}}
                                            disabled={disabled}
                                        >
                                            <User2/> {username ? username : 'Signed out'}
                                            <ChevronUp className="ml-auto"/>
                                        </SidebarMenuButton>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        side="top"
                                        align="start"
                                        sideOffset={6}
                                        className="min-w-[var(--radix-popper-anchor-width)] bg-sidebar-accent text-sidebar-accent-foreground border border-border rounded-md shadow-2xl p-1"
                                    >
                                        {isAdmin && (
                                            <DropdownMenuItem
                                                className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none"
                                                onSelect={() => setAdminSheetOpen(true)}>
                                                <span>Admin Settings</span>
                                            </DropdownMenuItem>
                                        )}
                                        <DropdownMenuItem
                                            className="rounded px-2 py-1.5 hover:bg-white/15 hover:text-accent-foreground focus:bg-white/20 focus:text-accent-foreground cursor-pointer focus:outline-none"
                                            onSelect={handleLogout}>
                                            <span>Sign out</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarFooter>
                    {/* Admin Settings Sheet (always rendered, only openable if isAdmin) */}
                    {isAdmin && (
                        <Sheet open={adminSheetOpen} onOpenChange={setAdminSheetOpen}>
                            <SheetContent side="left" className="w-[320px]">
                                <SheetHeader>
                                    <SheetTitle>Admin Settings</SheetTitle>
                                </SheetHeader>
                                <div className="pt-1 pb-4 px-4 flex flex-col gap-4">
                                    <label className="flex items-center gap-2">
                                        <Checkbox checked={allowRegistration} onCheckedChange={handleToggle}
                                                  disabled={regLoading}/>
                                        Allow new account registration
                                    </label>
                                </div>
                                <SheetFooter className="px-4 pt-1 pb-4">
                                    <Separator className="p-0.25 mt-2 mb-2"/>
                                    <SheetClose asChild>
                                        <Button variant="outline">Close</Button>
                                    </SheetClose>
                                </SheetFooter>
                            </SheetContent>
                        </Sheet>
                    )}
                </Sidebar>
            </SidebarProvider>
        </div>
    )
}