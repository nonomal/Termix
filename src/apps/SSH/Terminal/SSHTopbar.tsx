import {SSHTabList} from "@/apps/SSH/Terminal/SSHTabList.tsx";
import React from "react";

interface TerminalTab {
    id: number;
    title: string;
}

interface SSHTopbarProps {
    allTabs: TerminalTab[];
    currentTab: number;
    setActiveTab: (tab: number) => void;
    allSplitScreenTab: number[];
    setSplitScreenTab: (tab: number) => void;
    setCloseTab: (tab: number) => void;
}

export function SSHTopbar({ allTabs, currentTab, setActiveTab, allSplitScreenTab, setSplitScreenTab, setCloseTab }: SSHTopbarProps): React.ReactElement {
    return (
        <div className="flex h-11.5 z-100" style={{
            position: 'absolute',
            left: 0,
            width: '100%',
            backgroundColor: '#18181b',
            borderBottom: '1px solid #222224',
        }}>
            <SSHTabList
                allTabs={allTabs}
                currentTab={currentTab}
                setActiveTab={setActiveTab}
                allSplitScreenTab={allSplitScreenTab}
                setSplitScreenTab={setSplitScreenTab}
                setCloseTab={setCloseTab}
            />
        </div>
    )
}