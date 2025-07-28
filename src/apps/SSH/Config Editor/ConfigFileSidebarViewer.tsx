import React from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Card } from '@/components/ui/card.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import {Plus, Folder, File, Star, Trash2, Edit, Link2, Server, Pin} from 'lucide-react';

interface SSHConnection {
    id: string;
    name: string;
    ip: string;
    port: number;
    username: string;
    isPinned?: boolean;
}

interface FileItem {
    name: string;
    type: 'file' | 'directory' | 'link';
    path: string;
    isStarred?: boolean;
}

interface ConfigFileSidebarViewerProps {
    sshConnections: SSHConnection[];
    onAddSSH: () => void;
    onConnectSSH: (conn: SSHConnection) => void;
    onEditSSH: (conn: SSHConnection) => void;
    onDeleteSSH: (conn: SSHConnection) => void;
    onPinSSH: (conn: SSHConnection) => void;
    currentPath: string;
    files: FileItem[];
    onOpenFile: (file: FileItem) => void;
    onOpenFolder: (folder: FileItem) => void;
    onStarFile: (file: FileItem) => void;
    onDeleteFile: (file: FileItem) => void;
    isLoading?: boolean;
    error?: string;
    isSSHMode: boolean;
    onSwitchToLocal: () => void;
    onSwitchToSSH: (conn: SSHConnection) => void;
    currentSSH?: SSHConnection;
}

export function ConfigFileSidebarViewer({
    sshConnections,
    onAddSSH,
    onConnectSSH,
    onEditSSH,
    onDeleteSSH,
    onPinSSH,
    currentPath,
    files,
    onOpenFile,
    onOpenFolder,
    onStarFile,
    onDeleteFile,
    isLoading,
    error,
    isSSHMode,
    onSwitchToLocal,
    onSwitchToSSH,
    currentSSH,
}: ConfigFileSidebarViewerProps) {
    return (
        <div className="flex flex-col h-full">
            {/* SSH Connections */}
            <div className="p-2 bg-[#18181b] border-b border-[#23232a]">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-semibold">SSH Connections</span>
                    <Button size="icon" variant="outline" onClick={onAddSSH} className="ml-2 h-7 w-7">
                        <Plus className="w-4 h-4" />
                    </Button>
                </div>
                <div className="flex flex-col gap-1">
                    <Button
                        variant={!isSSHMode ? 'secondary' : 'ghost'}
                        className="w-full justify-start text-left px-2 py-1.5 rounded"
                        onClick={onSwitchToLocal}
                    >
                        <Server className="w-4 h-4 mr-2" /> Local Files
                    </Button>
                    {sshConnections.map((conn) => (
                        <div key={conn.id} className="flex items-center gap-1 group">
                            <Button
                                variant={isSSHMode && currentSSH?.id === conn.id ? 'secondary' : 'ghost'}
                                className="flex-1 justify-start text-left px-2 py-1.5 rounded"
                                onClick={() => onSwitchToSSH(conn)}
                            >
                                <Link2 className="w-4 h-4 mr-2" />
                                {conn.name || conn.ip}
                                {conn.isPinned && <Pin className="w-3 h-3 ml-1 text-yellow-400" />}
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onPinSSH(conn)}>
                                <Pin className={`w-4 h-4 ${conn.isPinned ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEditSSH(conn)}>
                                <Edit className="w-4 h-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDeleteSSH(conn)}>
                                <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                        </div>
                    ))}
                </div>
            </div>
            {/* File/Folder Viewer */}
            <div className="flex-1 bg-[#09090b] p-2 overflow-y-auto">
                <div className="mb-2 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-semibold">{isSSHMode ? 'SSH Path' : 'Local Path'}</span>
                    <span className="text-xs text-white truncate">{currentPath}</span>
                </div>
                {isLoading ? (
                    <div className="text-xs text-muted-foreground">Loading...</div>
                ) : error ? (
                    <div className="text-xs text-red-500">{error}</div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {files.map((item) => (
                            <Card key={item.path} className="flex items-center gap-2 px-2 py-1 bg-[#18181b] border border-[#23232a] rounded">
                                <div className="flex items-center gap-2 flex-1 cursor-pointer" onClick={() => item.type === 'directory' ? onOpenFolder(item) : onOpenFile(item)}>
                                    {item.type === 'directory' ? <Folder className="w-4 h-4 text-blue-400" /> : <File className="w-4 h-4 text-muted-foreground" />}
                                    <span className="text-sm text-white truncate">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onStarFile(item)}>
                                        <Pin className={`w-4 h-4 ${item.isStarred ? 'text-yellow-400' : 'text-muted-foreground'}`} />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDeleteFile(item)}>
                                        <Trash2 className="w-4 h-4 text-red-500" />
                                    </Button>
                                </div>
                            </Card>
                        ))}
                        {files.length === 0 && <div className="text-xs text-muted-foreground">No files or folders found.</div>}
                    </div>
                )}
            </div>
        </div>
    );
} 