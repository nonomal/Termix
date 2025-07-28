import React from "react";
import {Button} from "@/components/ui/button.tsx";
import {X, SeparatorVertical} from "lucide-react"

interface TerminalTab {
    id: number;
    title: string;
}

interface SSHTabListProps {
    allTabs: TerminalTab[];
    currentTab: number;
    setActiveTab: (tab: number) => void;
    allSplitScreenTab: number[];
    setSplitScreenTab: (tab: number) => void;
    setCloseTab: (tab: number) => void;
}

export function SSHTabList({
                               allTabs,
                               currentTab,
                               setActiveTab,
                               allSplitScreenTab = [],
                               setSplitScreenTab,
                               setCloseTab,
                           }: SSHTabListProps): React.ReactElement {
    const isSplitScreenActive = allSplitScreenTab.length > 0;

    return (
        <div className="inline-flex items-center h-full px-[0.5rem] overflow-x-auto">
            {allTabs.map((terminal, index) => {
                const isActive = terminal.id === currentTab;
                const isSplit = allSplitScreenTab.includes(terminal.id);
                const isSplitButtonDisabled =
                    (isActive && !isSplitScreenActive) ||
                    (allSplitScreenTab.length >= 3 && !isSplit);

                return (
                    <div
                        key={terminal.id}
                        className={index < allTabs.length - 1 ? "mr-[0.5rem]" : ""}
                    >
                        <div className="inline-flex rounded-md shadow-sm" role="group">
                            <Button
                                onClick={() => setActiveTab(terminal.id)}
                                disabled={isSplit}
                                variant="outline"
                                className={`rounded-r-none ${isActive ? '!bg-[#1d1d1f] !text-white !border-[#2d2d30] !hover:bg-[#1d1d1f] !active:bg-[#1d1d1f] !focus:bg-[#1d1d1f] !hover:text-white !active:text-white !focus:text-white' : ''}`}
                            >
                                {terminal.title}
                            </Button>

                            <Button
                                onClick={() => setSplitScreenTab(terminal.id)}
                                disabled={isSplitButtonDisabled || isActive}
                                variant="outline"
                                className="rounded-none p-0 !w-9 !h-9"
                            >
                                <SeparatorVertical className="!w-5 !h-5" strokeWidth={2.5}/>
                            </Button>

                            <Button
                                onClick={() => setCloseTab(terminal.id)}
                                disabled={(isSplitScreenActive && isActive) || isSplit}
                                variant="outline"
                                className="rounded-l-none p-0 !w-9 !h-9"
                            >
                                <X className="!w-5 !h-5" strokeWidth={2.5}/>
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}