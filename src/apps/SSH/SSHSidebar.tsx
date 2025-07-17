import React from 'react';

import {
    CornerDownLeft,
    Plus
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
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger
} from "@/components/ui/sheet.tsx";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form.tsx";
import { useForm } from "react-hook-form"
import { Input } from "@/components/ui/input.tsx";

interface SidebarProps {
    onSelectView: (view: string) => void;
    onAddHostSubmit: (data: any) => void;
}

export function SSHSidebar({ onSelectView, onAddHostSubmit }: SidebarProps): React.ReactElement {
    const addHostForm = useForm({
        defaultValues: {
        }
    })

    const onAddHostSubmitReset = (data: any) => {
        addHostForm.reset();
        onAddHostSubmit(data);
    }

    return (
        <SidebarProvider>
            <Sidebar className="h-full flex flex-col">
                <SidebarContent className="flex flex-col flex-grow h-full">
                    <SidebarGroup className="flex flex-col flex-grow h-full">
                        <SidebarGroupLabel className="text-lg text-center font-bold text-white">
                            Termix / SSH
                        </SidebarGroupLabel>
                        <Separator className="p-0.25 mt-1 mb-1" />
                        <SidebarGroupContent className="flex flex-col flex-grow h-full">
                            <SidebarMenu className="flex flex-col flex-grow h-full">

                                <SidebarMenuItem key="Homepage">
                                    <Button
                                        className="w-full mt-2 mb-2 h-8"
                                        onClick={() => onSelectView("homepage")}
                                        variant="outline"
                                    >
                                        <CornerDownLeft />
                                        Return
                                    </Button>
                                    <Separator className="p-0.25 mt-1 mb-1" />
                                </SidebarMenuItem>

                                <SidebarMenuItem key="AddHost">
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button
                                                className="w-full mt-2 mb-2 h-8"
                                                variant="outline"
                                            >
                                                <Plus />
                                                Add Host
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent
                                            side="left"
                                            className="w-[256px] fixed top-0 left-0 h-full z-[100] flex flex-col"
                                        >
                                            <SheetHeader className="pb-0.5">
                                                <SheetTitle>Add Host</SheetTitle>
                                            </SheetHeader>

                                            {/* Scrollable content */}
                                            <div className="flex-1 overflow-y-auto px-4">
                                                <Form {...addHostForm}>
                                                    <form
                                                        id="add-host-form"
                                                        onSubmit={addHostForm.handleSubmit(onAddHostSubmitReset)}
                                                        className="space-y-3"
                                                    >
                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="ip"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>IP</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="127.0.0.1" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="port"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Port</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="22" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="username"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Username</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="username123" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />

                                                        <FormField
                                                            control={addHostForm.control}
                                                            name="password"
                                                            render={({ field }) => (
                                                                <FormItem>
                                                                    <FormLabel>Password</FormLabel>
                                                                    <FormControl>
                                                                        <Input placeholder="password123" {...field} />
                                                                    </FormControl>
                                                                    <FormMessage />
                                                                </FormItem>
                                                            )}
                                                        />
                                                    </form>
                                                </Form>
                                            </div>

                                            <Separator className="p-0.25 mt-2" />
                                            <SheetFooter className="px-4 pt-1 pb-4">
                                                <SheetClose asChild>
                                                    <Button type="submit" form="add-host-form">
                                                        Add Host
                                                    </Button>
                                                </SheetClose>
                                                <SheetClose asChild>
                                                    <Button variant="outline">Close</Button>
                                                </SheetClose>
                                            </SheetFooter>
                                        </SheetContent>
                                    </Sheet>
                                </SidebarMenuItem>

                                <SidebarMenuItem key="Main" className="flex flex-col flex-grow">
                                    <div className="flex w-full flex-grow rounded-md bg-[#09090b] border border-[#434345] p-2 mb-1">

                                    </div>
                                </SidebarMenuItem>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
            </Sidebar>
        </SidebarProvider>
    );
}