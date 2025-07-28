import React from 'react';
import { Card } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Trash2, Folder, File, Plus, Pin } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useState } from 'react';
import { cn } from '@/lib/utils.ts';

interface FileItem {
    name: string;
    path: string;
    isPinned?: boolean;
    type: 'file' | 'directory';
    sshSessionId?: string;
}

interface ShortcutItem {
    name: string;
    path: string;
}

interface ConfigHomeViewProps {
    recent: FileItem[];
    pinned: FileItem[];
    shortcuts: ShortcutItem[];
    onOpenFile: (file: FileItem) => void;
    onRemoveRecent: (file: FileItem) => void;
    onPinFile: (file: FileItem) => void;
    onUnpinFile: (file: FileItem) => void;
    onOpenShortcut: (shortcut: ShortcutItem) => void;
    onRemoveShortcut: (shortcut: ShortcutItem) => void;
    onAddShortcut: (path: string) => void;
}

export function ConfigHomeView({
    recent,
    pinned,
    shortcuts,
    onOpenFile,
    onRemoveRecent,
    onPinFile,
    onUnpinFile,
    onOpenShortcut,
    onRemoveShortcut,
    onAddShortcut
}: ConfigHomeViewProps) {
    const [tab, setTab] = useState<'recent' | 'pinned' | 'shortcuts'>('recent');
    const [newShortcut, setNewShortcut] = useState('');



    const renderFileCard = (file: FileItem, onRemove: () => void, onPin?: () => void, isPinned = false) => (
        <div key={file.path} className="flex items-center gap-2 px-3 py-2 bg-[#18181b] border border-[#23232a] rounded hover:border-[#434345] transition-colors">
            <div 
                className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                onClick={() => onOpenFile(file)}
            >
                {file.type === 'directory' ? 
                    <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" /> : 
                    <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white break-words leading-tight">
                        {file.name}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                {onPin && (
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 px-1.5 bg-[#23232a] hover:bg-[#2d2d30] rounded-md"
                        onClick={onPin}
                    >
                        <Pin className={`w-3 h-3 ${isPinned ? 'text-yellow-400 fill-current' : 'text-muted-foreground'}`} />
                    </Button>
                )}
                {onRemove && (
                    <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-6 px-1.5 bg-[#23232a] hover:bg-[#2d2d30] rounded-md"
                        onClick={onRemove}
                    >
                        <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                )}
            </div>
        </div>
    );

    const renderShortcutCard = (shortcut: ShortcutItem) => (
        <div key={shortcut.path} className="flex items-center gap-2 px-3 py-2 bg-[#18181b] border border-[#23232a] rounded hover:border-[#434345] transition-colors">
            <div 
                className="flex items-center gap-2 flex-1 cursor-pointer min-w-0"
                onClick={() => onOpenShortcut(shortcut)}
            >
                <Folder className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white break-words leading-tight">
                        {shortcut.path}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
                <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-6 px-1.5 bg-[#23232a] hover:bg-[#2d2d30] rounded-md"
                    onClick={() => onRemoveShortcut(shortcut)}
                >
                    <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
            </div>
        </div>
    );

    return (
        <div className="p-4 flex flex-col gap-4 h-full bg-[#09090b]">
            <Tabs value={tab} onValueChange={v => setTab(v as 'recent' | 'pinned' | 'shortcuts')} className="w-full">
                <TabsList className="mb-4 bg-[#18181b] border border-[#23232a]">
                    <TabsTrigger value="recent" className="data-[state=active]:bg-[#23232a]">Recent</TabsTrigger>
                    <TabsTrigger value="pinned" className="data-[state=active]:bg-[#23232a]">Pinned</TabsTrigger>
                    <TabsTrigger value="shortcuts" className="data-[state=active]:bg-[#23232a]">Folder Shortcuts</TabsTrigger>
                </TabsList>
                
                <TabsContent value="recent" className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {recent.length === 0 ? (
                            <div className="flex items-center justify-center py-8 col-span-full">
                                <span className="text-sm text-muted-foreground">No recent files.</span>
                            </div>
                        ) : recent.map((file) => 
                            renderFileCard(
                                file, 
                                () => onRemoveRecent(file),
                                () => file.isPinned ? onUnpinFile(file) : onPinFile(file),
                                file.isPinned
                            )
                        )}
                    </div>
                </TabsContent>
                
                <TabsContent value="pinned" className="mt-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {pinned.length === 0 ? (
                            <div className="flex items-center justify-center py-8 col-span-full">
                                <span className="text-sm text-muted-foreground">No pinned files.</span>
                            </div>
                        ) : pinned.map((file) => 
                            renderFileCard(
                                file, 
                                undefined, // No remove function for pinned items
                                () => onUnpinFile(file), // Use pin function for unpinning
                                true
                            )
                        )}
                    </div>
                </TabsContent>
                
                <TabsContent value="shortcuts" className="mt-0">
                    <div className="flex items-center gap-3 mb-4 p-3 bg-[#18181b] border border-[#23232a] rounded-lg">
                        <Input
                            placeholder="Enter folder path"
                            value={newShortcut}
                            onChange={e => setNewShortcut(e.target.value)}
                            className="flex-1 bg-[#23232a] border-[#434345] text-white placeholder:text-muted-foreground"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && newShortcut.trim()) {
                                    onAddShortcut(newShortcut.trim());
                                    setNewShortcut('');
                                }
                            }}
                        />
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 bg-[#23232a] border-[#434345] hover:bg-[#2d2d30] rounded-md"
                            onClick={() => {
                                if (newShortcut.trim()) {
                                    onAddShortcut(newShortcut.trim());
                                    setNewShortcut('');
                                }
                            }}
                        >
                            <Plus className="w-3.5 h-3.5 mr-1" />
                            Add
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {shortcuts.length === 0 ? (
                            <div className="flex items-center justify-center py-4 col-span-full">
                                <span className="text-sm text-muted-foreground">No shortcuts.</span>
                            </div>
                        ) : shortcuts.map((shortcut) => 
                            renderShortcutCard(shortcut)
                        )}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
} 