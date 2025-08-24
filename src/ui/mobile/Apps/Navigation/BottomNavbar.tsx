import React, {useState} from "react";
import {Button} from "@/components/ui/button.tsx";
import {Menu, X, Terminal, Server} from "lucide-react";
import {Separator} from "@/components/ui/separator.tsx";

interface Tab {
    id: number;
    type: string;
    title: string;
    isActive: boolean;
}

interface MobileBottomNavbarProps {
    tabs: Tab[];
    currentTab: number | null;
    onTabChange: (tabId: number) => void;
    onOpenSidebar: () => void;
    onCloseTab?: (tabId: number) => void;
}

export function MobileBottomNavbar({
    tabs,
    currentTab,
    onTabChange,
    onOpenSidebar,
    onCloseTab,
}: MobileBottomNavbarProps): React.ReactElement {
    const getTabIcon = (type: string) => {
        switch (type) {
            case 'terminal':
                return <Terminal className="h-4 w-4" />;
            case 'server':
                return <Server className="h-4 w-4" />;
            default:
                return <Terminal className="h-4 w-4" />;
        }
    };

    const getTabTypeLabel = (type: string) => {
        switch (type) {
            case 'terminal':
                return 'Terminal';
            case 'server':
                return 'Server';
            default:
                return 'Terminal';
        }
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 h-[50px] !bg-[#131316] border-t-2 border-[#303032] z-30">
            <div className="flex items-center h-full px-1 pr-2 gap-2">
                {/* Sidebar Toggle Button */}
                <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenSidebar}
                    className="h-[35px] w-[35px] ml-2 p-0 flex-shrink-0 bg-[#18181b] !border-2 !border-[#303032]"
                >
                    <Menu className="h-4 w-4 text-white" />
                </Button>

                {/* Vertical Separator */}
                <div className="p-0.25 h-[35px] bg-[#303032] flex-shrink-0" />

                {/* Tabs Container */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden thin-scrollbar">
                    <div className="flex items-center gap-2 h-full min-w-max">
                        {tabs.map((tab) => (
                            <div
                                key={tab.id}
                                className={`flex items-center gap-2 px-3 py-2 border-2 h-[35px] border-[#303032] rounded-lg cursor-pointer transition-all duration-200 flex-shrink-0 ${
                                    tab.isActive
                                        ? 'bg-[#18181b] text-white'
                                        : 'bg-[#111113] text-gray-300 hover:bg-[#303032]'
                                }`}
                                onClick={() => onTabChange(tab.id)}
                            >
                                {getTabIcon(tab.type)}
                                <span className="text-sm font-medium whitespace-nowrap">
                                    {tab.title || getTabTypeLabel(tab.type)}
                                </span>
                                {onCloseTab && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onCloseTab(tab.id);
                                        }}
                                        className="h-5 w-5 p-0 ml-1 hover:bg-white/20 transition-colors"
                                    >
                                        <X className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Add custom CSS for mobile optimization */}
            <style>
                {`
                    .thin-scrollbar {
                        -ms-overflow-style: none;
                        scrollbar-width: none;
                    }
                    .thin-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                    
                    .overflow-x-auto {
                        -webkit-overflow-scrolling: touch;
                    }
                `}
            </style>
        </div>
    );
}
