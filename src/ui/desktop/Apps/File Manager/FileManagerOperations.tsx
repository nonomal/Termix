import React, {useState, useRef} from 'react';
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
    const fileInputRef = useRef<HTMLInputElement>(null);

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
        <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUpload(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30]"
                >
                    <Upload className="w-4 h-4 mr-2"/>
                    Upload File
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateFile(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30]"
                >
                    <FilePlus className="w-4 h-4 mr-2"/>
                    New File
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCreateFolder(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30]"
                >
                    <FolderPlus className="w-4 h-4 mr-2"/>
                    New Folder
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRename(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30]"
                >
                    <Edit3 className="w-4 h-4 mr-2"/>
                    Rename
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowDelete(true)}
                    className="h-10 bg-[#18181b] border-2 border-[#303032] hover:border-[#434345] hover:bg-[#2d2d30] col-span-2"
                >
                    <Trash2 className="w-4 h-4 mr-2"/>
                    Delete Item
                </Button>
            </div>

            <div className="bg-[#18181b] border-2 border-[#303032] rounded-lg p-3">
                <div className="flex items-center gap-2 text-sm">
                    <Folder className="w-4 h-4 text-blue-400"/>
                    <span className="text-muted-foreground">Current Path:</span>
                    <span className="text-white font-mono truncate">{currentPath}</span>
                </div>
            </div>

            <Separator className="p-0.25 bg-[#303032]"/>

            {showUpload && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Upload className="w-5 h-5"/>
                                Upload File
                            </h3>
                            <p className="text-xs text-muted-foreground mt-1">
                                Maximum file size: 100MB (JSON) / 200MB (Binary)
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowUpload(false)}
                            className="h-8 w-8 p-0"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div className="border-2 border-dashed border-[#434345] rounded-lg p-6 text-center">
                            {uploadFile ? (
                                <div className="space-y-2">
                                    <FileText className="w-8 h-8 text-blue-400 mx-auto"/>
                                    <p className="text-white font-medium">{uploadFile.name}</p>
                                    <p className="text-sm text-muted-foreground">
                                        {(uploadFile.size / 1024).toFixed(2)} KB
                                    </p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setUploadFile(null)}
                                        className="mt-2"
                                    >
                                        Remove File
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="w-8 h-8 text-muted-foreground mx-auto"/>
                                    <p className="text-white">Click to select a file</p>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={openFileDialog}
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

                        <div className="flex gap-2">
                            <Button
                                onClick={handleFileUpload}
                                disabled={!uploadFile || isLoading}
                                className="flex-1"
                            >
                                {isLoading ? 'Uploading...' : 'Upload File'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowUpload(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {showCreateFile && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FilePlus className="w-5 h-5"/>
                            Create New File
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCreateFile(false)}
                            className="h-8 w-8 p-0"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                File Name
                            </label>
                            <Input
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                placeholder="Enter file name (e.g., example.txt)"
                                className="bg-[#23232a] border-2 border-[#434345] text-white"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleCreateFile}
                                disabled={!newFileName.trim() || isLoading}
                                className="flex-1"
                            >
                                {isLoading ? 'Creating...' : 'Create File'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowCreateFile(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {showCreateFolder && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <FolderPlus className="w-5 h-5"/>
                            Create New Folder
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowCreateFolder(false)}
                            className="h-8 w-8 p-0"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                Folder Name
                            </label>
                            <Input
                                value={newFolderName}
                                onChange={(e) => setNewFolderName(e.target.value)}
                                placeholder="Enter folder name"
                                className="bg-[#23232a] border-2 border-[#434345] text-white"
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleCreateFolder}
                                disabled={!newFolderName.trim() || isLoading}
                                className="flex-1"
                            >
                                {isLoading ? 'Creating...' : 'Create Folder'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowCreateFolder(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {showDelete && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Trash2 className="w-5 h-5 text-red-400"/>
                            Delete Item
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowDelete(false)}
                            className="h-8 w-8 p-0"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-red-300">
                                <AlertCircle className="w-4 h-4"/>
                                <span className="text-sm font-medium">Warning: This action cannot be undone</span>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                Item Path
                            </label>
                            <Input
                                value={deletePath}
                                onChange={(e) => setDeletePath(e.target.value)}
                                placeholder="Enter full path to item (e.g., /path/to/file.txt)"
                                className="bg-[#23232a] border-2 border-[#434345] text-white"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="deleteIsDirectory"
                                checked={deleteIsDirectory}
                                onChange={(e) => setDeleteIsDirectory(e.target.checked)}
                                className="rounded border-[#434345] bg-[#23232a]"
                            />
                            <label htmlFor="deleteIsDirectory" className="text-sm text-white">
                                This is a directory (will delete recursively)
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleDelete}
                                disabled={!deletePath || isLoading}
                                variant="destructive"
                                className="flex-1"
                            >
                                {isLoading ? 'Deleting...' : 'Delete Item'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowDelete(false)}
                                disabled={isLoading}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Card>
            )}

            {showRename && (
                <Card className="bg-[#18181b] border-2 border-[#303032] p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Edit3 className="w-5 h-5"/>
                            Rename Item
                        </h3>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowRename(false)}
                            className="h-8 w-8 p-0"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-white mb-2 block">
                                Current Path
                            </label>
                            <Input
                                value={renamePath}
                                onChange={(e) => setRenamePath(e.target.value)}
                                placeholder="Enter current path to item"
                                className="bg-[#23232a] border-2 border-[#434345] text-white"
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
                                className="bg-[#23232a] border-2 border-[#434345] text-white"
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="renameIsDirectory"
                                checked={renameIsDirectory}
                                onChange={(e) => setRenameIsDirectory(e.target.checked)}
                                className="rounded border-[#434345] bg-[#23232a]"
                            />
                            <label htmlFor="renameIsDirectory" className="text-sm text-white">
                                This is a directory
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={handleRename}
                                disabled={!renamePath || !newName.trim() || isLoading}
                                className="flex-1"
                            >
                                {isLoading ? 'Renaming...' : 'Rename Item'}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => setShowRename(false)}
                                disabled={isLoading}
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
