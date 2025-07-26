import React from 'react';
import { Card } from '@/components/ui/card.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Star, Trash2, Folder, File, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useState } from 'react';

interface FileItem {
    name: string;
    path: string;
    isStarred?: boolean;
    type: 'file' | 'directory';
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
    onOpenShortcut,
    onRemoveShortcut,
    onAddShortcut,
}: ConfigHomeViewProps) {
    const [tab, setTab] = useState<'recent' | 'pinned' | 'shortcuts'>('recent');
    const [newShortcut, setNewShortcut] = useState('');
    return (
        <div className="p-6 flex flex-col gap-8 h-full bg-[#09090b]">
            <Tabs value={tab} onValueChange={v => setTab(v as 'recent' | 'pinned' | 'shortcuts')} className="w-full">
                <TabsList className="mb-1">
                    <TabsTrigger value="recent">Recent</TabsTrigger>
                    <TabsTrigger value="pinned">Pinned</TabsTrigger>
                    <TabsTrigger value="shortcuts">Folder Shortcuts</TabsTrigger>
                </TabsList>
                <TabsContent value="recent">
                    <div className="flex flex-wrap gap-3">
                        {recent.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No recent files.</span>
                        ) : recent.map((file, index) => (
                            <Card key={`${file.path}-${index}`} className="flex items-center gap-2 px-3 py-2 bg-[#18181b] border border-[#23232a] rounded">
                                <Button variant="ghost" className="p-0 h-7 w-7" onClick={() => onOpenFile(file)}>
                                    {file.type === 'directory' ? <Folder className="w-4 h-4 text-blue-400" /> : <File className="w-4 h-4 text-muted-foreground" />}
                                </Button>
                                <span className="text-sm text-white truncate max-w-[120px]">{file.name}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPinFile(file)}>
                                    <Star className={`w-4 h-4 ${file.isStarred ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemoveRecent(file)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value="pinned">
                    <div className="flex flex-wrap gap-3">
                        {pinned.length === 0 ? (
                            <span className="text-xs text-muted-foreground">No pinned files.</span>
                        ) : pinned.map((file, index) => (
                            <Card key={`${file.path}-${index}`} className="flex items-center gap-2 px-3 py-2 bg-[#18181b] border border-[#23232a] rounded">
                                <Button variant="ghost" className="p-0 h-7 w-7" onClick={() => onOpenFile(file)}>
                                    {file.type === 'directory' ? <Folder className="w-4 h-4 text-blue-400" /> : <File className="w-4 h-4 text-muted-foreground" />}
                                </Button>
                                <span className="text-sm text-white truncate max-w-[120px]">{file.name}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPinFile(file)}>
                                    <Star className={`w-4 h-4 ${file.isStarred ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                                </Button>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
                <TabsContent value="shortcuts">
                    <div className="flex items-center gap-2 mb-0">
                        <Input
                            placeholder="Enter folder path"
                            value={newShortcut}
                            onChange={e => setNewShortcut(e.target.value)}
                            className="flex-1"
                        />
                        <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            onClick={() => {
                                if (newShortcut.trim()) {
                                    onAddShortcut(newShortcut.trim());
                                    setNewShortcut('');
                                }
                            }}
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {shortcuts.length === 0 ? (
                            <span className="text-xs text-muted-foreground mt-4">No shortcuts.</span>
                        ) : shortcuts.map((shortcut, index) => (
                            <Card key={`${shortcut.path}-${index}`} className="flex items-center gap-2 px-3 py-2 bg-[#18181b] border border-[#23232a] rounded">
                                <Button variant="ghost" className="p-0 h-7 w-7" onClick={() => onOpenShortcut(shortcut)}>
                                    <Folder className="w-4 h-4 text-blue-400" />
                                </Button>
                                <span className="text-sm text-white truncate max-w-[120px]">{shortcut.name || shortcut.path.split('/').pop()}</span>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onRemoveShortcut(shortcut)}>
                                    <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
} 