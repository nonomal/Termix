import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Home } from 'lucide-react';

interface ConfigTab {
    id: string | number;
    title: string;
}

interface ConfigTabListProps {
    tabs: ConfigTab[];
    activeTab: string | number;
    setActiveTab: (tab: string | number) => void;
    closeTab: (tab: string | number) => void;
    onHomeClick: () => void;
}

export function ConfigTabList({ tabs, activeTab, setActiveTab, closeTab, onHomeClick }: ConfigTabListProps) {
    return (
        <div className="inline-flex items-center h-full px-[0.5rem] overflow-x-auto">
            <Button
                onClick={onHomeClick}
                variant="outline"
                className={`h-7 mr-[0.5rem] rounded-md flex items-center ${activeTab === 'home' ? '!bg-[#1d1d1f] !text-white !border-[#2d2d30] !hover:bg-[#1d1d1f] !active:bg-[#1d1d1f] !focus:bg-[#1d1d1f] !hover:text-white !active:text-white !focus:text-white' : ''}`}
            >
                <Home className="w-4 h-4" />
            </Button>
            {tabs.map((tab, index) => {
                const isActive = tab.id === activeTab;
                return (
                    <div key={tab.id} className={index < tabs.length - 1 ? 'mr-[0.5rem]' : ''}>
                        <div className="inline-flex rounded-md shadow-sm" role="group">
                            <Button
                                onClick={() => setActiveTab(tab.id)}
                                variant="outline"
                                className={`h-7 rounded-r-none flex items-center ${isActive ? '!bg-[#1d1d1f] !text-white !border-[#2d2d30] !hover:bg-[#1d1d1f] !active:bg-[#1d1d1f] !focus:bg-[#1d1d1f] !hover:text-white !active:text-white !focus:text-white' : ''}`}
                            >
                                {tab.title}
                            </Button>
                            <Button
                                onClick={() => closeTab(tab.id)}
                                variant="outline"
                                className="h-7 rounded-l-none p-0 !w-7 !h-7 flex items-center"
                            >
                                <X className="!w-4 !h-4" strokeWidth={2.5} />
                            </Button>
                        </div>
                    </div>
                );
            })}
        </div>
    );
} 