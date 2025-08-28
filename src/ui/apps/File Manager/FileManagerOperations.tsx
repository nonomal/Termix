import React, {useState, useRef, useEffect} from 'react';
import {Button} from '@/components/ui/button.tsx';
import {Input} from '@/components/ui/input.tsx';
import {Card} from '@/components/ui/card.tsx';
import {Separator} from '@/components/ui/separator.tsx';
import {
    Upload,
    FilePlus,
    FolderPlus,
    Trash2,
    Edit3,
    X,
    Check,
    AlertCircle,
    FileText,
    Folder
} from 'lucide-react';
import {cn} from '@/lib/utils.ts';

interface FileManagerOperationsProps {
    currentPath: string;
    sshSessionId: string | null;
    onOperationComplete: () => void;
    onError: (error: string) => void;
    onSuccess: (message: string) => void;
}

export function FileManagerOperations({
                                          currentPath,
                                          sshSessionId,
                                          onOperationComplete,
                                          onError,
                                          onSuccess
                                      }: FileManagerOperationsProps) {
    const [showUpload, setShowUpload] = useState(false);
    const [showCreateFile, setShowCreateFile] = useState(false);
    const [showCreateFolder, setShowCreateFolder] = useState(false);
    const [showDelete, setShowDelete] = useState(false);
    const [showRename, setShowRename] = useState(false);

    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [newFileName, setNewFileName] = useState('');
    const [newFolderName, setNewFolderName] = useState('');
    const [deletePath, setDeletePath] = useState('');
    const [deleteIsDirectory, setDeleteIsDirectory] = useState(false);
    const [renamePath, setRenamePath] = useState('');
    const [renameIsDirectory, setRenameIsDirectory] = useState(false);
    const [newName, setNewName] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [showTextLabels, setShowTextLabels] = useState(true);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const checkContainerWidth = () => {
            if (containerRef.current) {
                const width = containerRef.current.offsetWidth;
                setShowTextLabels(width > 240);
            }
        };

        checkContainerWidth();
        
        const resizeObserver = new ResizeObserver(checkContainerWidth);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            resizeObserver.disconnect();
        };
    }, []);

    const handleFileUpload = async () => {
        if (!uploadFile || !sshSessionId) return;

        setIsLoading(true);
        try {
            const content = await uploadFile.text();
            const {uploadSSHFile} = await import('@/ui/main-axios.ts');

            await uploadSSHFile(sshSessionId, currentPath, uploadFile.name, content);
            onSuccess(`File "${uploadFile.name}" uploaded successfully`);
            setShowUpload(false);
            setUploadFile(null);
            onOperationComplete();
        } catch (error: any) {
            onError(error?.response?.data?.error || 'Failed to upload file');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateFile = async () => {
        if (!newFileName.trim() || !sshSessionId) return;

        setIsLoading(true);
        try {
            const {createSSHFile} = await import('@/ui/main-axios.ts');

            await createSSHFile(sshSessionId, currentPath, newFileName.trim());
            onSuccess(`File "${newFileName.trim()}" created successfully`);
            setShowCreateFile(false);
            setNewFileName('');
            onOperationComplete();
        } catch (error: any) {
            onError(error?.response?.data?.error || 'Failed to create file');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim() || !sshSessionId) return;

        setIsLoading(true);
        try {
            const {createSSHFolder} = await import('@/ui/main-axios.ts');

            await createSSHFolder(sshSessionId, currentPath, newFolderName.trim());
            onSuccess(`Folder "${newFolderName.trim()}" created successfully`);
            setShowCreateFolder(false);
            setNewFolderName('');
            onOperationComplete();
        } catch (error: any) {
            onError(error?.response?.data?.error || 'Failed to create folder');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!deletePath || !sshSessionId) return;

        setIsLoading(true);
        try {
            const {deleteSSHItem} = await import('@/ui/main-axios.ts');

            await deleteSSHItem(sshSessionId, deletePath, deleteIsDirectory);
            onSuccess(`${deleteIsDirectory ? 'Folder' : 'File'} deleted successfully`);
            setShowDelete(false);
            setDeletePath('');
            setDeleteIsDirectory(false);
            onOperationComplete();
        } catch (error: any) {
            onError(error?.response?.data?.error || 'Failed to delete item');
        } finally {
            setIsLoading(false);
        }
    };

    const handleRename = async () => {
        if (!renamePath || !newName.trim() || !sshSessionId) return;

        setIsLoading(true);
        try {
            const {renameSSHItem} = await import('@/ui/main-axios.ts');

            await renameSSHItem(sshSessionId, renamePath, newName.trim());
            onSuccess(`${renameIsDirectory ? 'Folder' : 'File'} renamed successfully`);
            setShowRename(false);
            setRenamePath('');
            setRenameIsDirectory(false);
            setNewName('');
            onOperationComplete();
        } catch (error: any) {
            onError(error?.response?.data?.error || 'Failed to rename item');
        } finally {
            setIsLoading(false);
        }
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadFile(file);
        }
    };

    const resetStates = () => {
        setShowUpload(false);
        setShowCreateFile(false);
        setShowCreateFolder(false);
        setShowDelete(false);
        setShowRename(false);
        setUploadFile(null);
        setNewFileName('');
        setNewFolderName('');
        setDeletePath('');
        setDeleteIsDirectory(false);
        setRenamePath('');
        setRenameIsDirectory(false);
        setNewName('');
    };

    if (!sshSessionId) {
        return (
            <div className="p-4 text-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2"/>
                <p className="text-sm text-muted-foreground">Connect to SSH to use file operations</p>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUpload(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30]"
                    title="Upload File"
                >
                    <Upload className={cn("w-4 h-4", showTextLabels ? "mr-2" : "")}/>
                    {showTextLabels && <span className="truncate">Upload File</span>}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateFile(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30]"
                    title="New File"
                >
                    <FilePlus className={cn("w-4 h-4", showTextLabels ? "mr-2" : "")}/>
                    {showTextLabels && <span className="truncate">New File</span>}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateFolder(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30]"
                    title="New Folder"
                >
                    <FolderPlus className={cn("w-4 h-4", showTextLabels ? "mr-2" : "")}/>
                    {showTextLabels && <span className="truncate">New Folder</span>}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRename(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30]"
                    title="Rename"
                >
                    <Edit3 className={cn("w-4 h-4", showTextLabels ? "mr-2" : "")}/>
                    {showTextLabels && <span className="truncate">Rename</span>}
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDelete(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30] col-span-2"
                    title="Delete Item"
                >
                    <Trash2 className={cn("w-4 h-4", showTextLabels ? "mr-2" : "")}/>
                    {showTextLabels && <span className="truncate">Delete Item</span>}
                </Button>
            </div>

            <div className="bg-[#141416] border-2 border-[#373739] rounded-md p-3">
                <div className="flex items-start gap-2 text-sm">
                    <Folder className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5"/>
                    <div className="flex-1 min-w-0">
                        <span className="text-muted-foreground block mb-1">Current Path:</span>
                        <span className="text-white font-mono text-xs break-all leading-relaxed">{currentPath}</span>
                    </div>
                </div>
            </div>

            <Separator className="p-0.25 bg-[#303032]"/>

            {showUpload && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2 mb-1">
                                <Upload className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"/>
                                <span className="break-words">Upload File</span>
                            </h3>
                            <p className="text-xs text-muted-foreground break-words">
                                Max: 100MB (JSON) / 200MB (Binary)
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowUpload(false)}
                            className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div className="border-2 border-dashed border-[#434345] rounded-lg p-4 text-center">
                            {uploadFile ? (
                                <div className="space-y-3">
                                    <FileText className="w-12 h-12 text-blue-400 mx-auto"/>
                                    <p className="text-white font-medium text-sm break-words px-2">{uploadFile.name}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {(uploadFile.size / 1024).toFixed(2)} KB
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setUploadFile(null)}
                                        className="w-full text-sm h-8"
                                    >
                                        Remove File
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <Upload className="w-12 h-12 text-muted-foreground mx-auto"/>
                                    <p className="text-white text-sm break-words px-2">Click to select a file</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={openFileDialog}
                                        className="w-full text-sm h-8"
                                    >
                                        Choose File
                                    </Button>
                                </div>
                            )}
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="*/*"
                        />

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleFileUpload}
                                disabled={!uploadFile || isLoading}
                                className="w-full text-sm h-9"
                            >
                                {isLoading ? 'Uploading...' : 'Upload File'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowUpload(false)}
                                disabled={isLoading}
                                className="w-full text-sm h-9"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {showCreateFile && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-3 sm:p-4">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                                <FilePlus className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0"/>
                                <span className="break-words">Create New File</span>
                            </h3>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCreateFile(false)}
                            className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                File Name
                            </label>
                            <Input
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                placeholder="Enter file name (e.g., example.txt)"
                                className="bg-[#23232a] border-2 border-[#434345] text-white text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleCreateFile}
                                disabled={!newFileName.trim() || isLoading}
                                className="w-full text-sm h-9"
                            >
                                {isLoading ? 'Creating...' : 'Create File'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowCreateFile(false)}
                                disabled={isLoading}
                                className="w-full text-sm h-9"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {showCreateFolder && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-3">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                <FolderPlus className="w-6 h-6 flex-shrink-0"/>
                                <span className="break-words">Create New Folder</span>
                            </h3>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCreateFolder(false)}
                            className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                Folder Name
                            </label>
                            <Input
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Enter folder name"
                                className="bg-[#23232a] border-2 border-[#434345] text-white text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim() || isLoading}
                                className="w-full text-sm h-9"
                            >
                                {isLoading ? 'Creating...' : 'Create Folder'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowCreateFolder(false)}
                                disabled={isLoading}
                                className="w-full text-sm h-9"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {showDelete && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-3">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                <Trash2 className="w-6 h-6 text-red-400 flex-shrink-0"/>
                                <span className="break-words">Delete Item</span>
                            </h3>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDelete(false)}
                            className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                            <div className="flex items-start gap-2 text-red-300">
                                <AlertCircle className="w-5 h-5 flex-shrink-0"/>
                                <span className="text-sm font-medium break-words">Warning: This action cannot be undone</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                Item Path
                            </label>
                            <Input
                                value={deletePath}
                                onChange={(e) => setDeletePath(e.target.value)}
                                placeholder="Enter full path to item"
                                className="bg-[#23232a] border-2 border-[#434345] text-white text-sm"
                            />
                        </div>

                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="deleteIsDirectory"
                                checked={deleteIsDirectory}
                                onChange={(e) => setDeleteIsDirectory(e.target.checked)}
                                className="rounded border-[#434345] bg-[#23232a] mt-0.5 flex-shrink-0"
                            />
                            <label htmlFor="deleteIsDirectory" className="text-sm text-white break-words">
                                This is a directory (will delete recursively)
                            </label>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleDelete}
                                disabled={!deletePath || isLoading}
                                variant="destructive"
                                className="w-full text-sm h-9"
                            >
                                {isLoading ? 'Deleting...' : 'Delete Item'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowDelete(false)}
                                disabled={isLoading}
                                className="w-full text-sm h-9"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {showRename && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-3">
                    <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                            <h3 className="text-base font-semibold text-white flex items-center gap-2">
                                <Edit3 className="w-6 h-6 flex-shrink-0"/>
                                <span className="break-words">Rename Item</span>
                            </h3>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowRename(false)}
                            className="h-8 w-8 p-0 flex-shrink-0 ml-2"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                Current Path
                            </label>
                            <Input
                                value={renamePath}
                                onChange={(e) => setRenamePath(e.target.value)}
                                placeholder="Enter current path to item"
                                className="bg-[#23232a] border-2 border-[#434345] text-white text-sm"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                New Name
                            </label>
                            <Input
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Enter new name"
                                className="bg-[#23232a] border-2 border-[#434345] text-white text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                            />
                        </div>

                        <div className="flex items-start gap-2">
                            <input
                                type="checkbox"
                                id="renameIsDirectory"
                                checked={renameIsDirectory}
                                onChange={(e) => setRenameIsDirectory(e.target.checked)}
                                className="rounded border-[#434345] bg-[#23232a] mt-0.5 flex-shrink-0"
                            />
                            <label htmlFor="renameIsDirectory" className="text-sm text-white break-words">
                                This is a directory
                            </label>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleRename}
                                disabled={!renamePath || !newName.trim() || isLoading}
                                className="w-full text-sm h-9"
                            >
                                {isLoading ? 'Renaming...' : 'Rename Item'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowRename(false)}
                                disabled={isLoading}
                                className="w-full text-sm h-9"
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}
