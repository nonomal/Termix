import axios, { AxiosError, type AxiosInstance } from 'axios';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

interface SSHHostData {
    name?: string;
    ip: string;
    port: number;
    username: string;
    folder?: string;
    tags?: string[];
    pin?: boolean;
    authType: 'password' | 'key';
    password?: string;
    key?: File | null;
    keyPassword?: string;
    keyType?: string;
    enableTerminal?: boolean;
    enableTunnel?: boolean;
    enableFileManager?: boolean;
    defaultPath?: string;
    tunnelConnections?: any[];
}

interface SSHHost {
    id: number;
    name: string;
    ip: string;
    port: number;
    username: string;
    folder: string;
    tags: string[];
    pin: boolean;
    authType: string;
    password?: string;
    key?: string;
    keyPassword?: string;
    keyType?: string;
    enableTerminal: boolean;
    enableTunnel: boolean;
    enableFileManager: boolean;
    defaultPath: string;
    tunnelConnections: any[];
    createdAt: string;
    updatedAt: string;
}

interface TunnelConfig {
    name: string;
    hostName: string;
    sourceIP: string;
    sourceSSHPort: number;
    sourceUsername: string;
    sourcePassword?: string;
    sourceAuthMethod: string;
    sourceSSHKey?: string;
    sourceKeyPassword?: string;
    sourceKeyType?: string;
    endpointIP: string;
    endpointSSHPort: number;
    endpointUsername: string;
    endpointPassword?: string;
    endpointAuthMethod: string;
    endpointSSHKey?: string;
    endpointKeyPassword?: string;
    endpointKeyType?: string;
    sourcePort: number;
    endpointPort: number;
    maxRetries: number;
    retryInterval: number;
    autoStart: boolean;
    isPinned: boolean;
}

interface TunnelStatus {
    status: string;
    reason?: string;
    errorType?: string;
    retryCount?: number;
    maxRetries?: number;
    nextRetryIn?: number;
    retryExhausted?: boolean;
}

interface FileManagerFile {
    name: string;
    path: string;
    type?: 'file' | 'directory';
    isSSH?: boolean;
    sshSessionId?: string;
}

interface FileManagerShortcut {
    name: string;
    path: string;
}

interface FileManagerOperation {
    name: string;
    path: string;
    isSSH: boolean;
    sshSessionId?: string;
    hostId: number;
}

export type ServerStatus = {
    status: 'online' | 'offline';
    lastChecked: string;
};

interface CpuMetrics {
    percent: number | null;
    cores: number | null;
    load: [number, number, number] | null;
}

interface MemoryMetrics {
    percent: number | null;
    usedGiB: number | null;
    totalGiB: number | null;
}

interface DiskMetrics {
    percent: number | null;
    usedHuman: string | null;
    totalHuman: string | null;
}

export type ServerMetrics = {
    cpu: CpuMetrics;
    memory: MemoryMetrics;
    disk: DiskMetrics;
    lastChecked: string;
};

interface AuthResponse {
    token: string;
}

interface UserInfo {
    id: string;
    username: string;
    is_admin: boolean;
}

interface UserCount {
    count: number;
}

interface OIDCAuthorize {
    auth_url: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function setCookie(name: string, value: string, days = 7): void {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/`;
}

function getCookie(name: string): string | undefined {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
}

function createApiInstance(baseURL: string): AxiosInstance {
    const instance = axios.create({
        baseURL,
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
    });

    instance.interceptors.request.use((config) => {
        const token = getCookie('jwt');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    });

    instance.interceptors.response.use(
        (response) => response,
        (error: AxiosError) => {
            if (error.response?.status === 401) {
                document.cookie = 'jwt=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            }
            return Promise.reject(error);
        }
    );

    return instance;
}

// ============================================================================
// API INSTANCES
// ============================================================================

const isDev = process.env.NODE_ENV === 'development' && 
              (window.location.port === '3000' || window.location.port === '5173' || window.location.port === '');

// SSH Host Management API (port 8081)
export const sshHostApi = createApiInstance(
    isDev ? 'http://localhost:8081/ssh' : '/ssh'
);

// Tunnel Management API (port 8083)
export const tunnelApi = createApiInstance(
    isDev ? 'http://localhost:8083/ssh' : '/ssh'
);

// File Manager Operations API (port 8084) - SSH file operations
export const fileManagerApi = createApiInstance(
    isDev ? 'http://localhost:8084/ssh/file_manager' : '/ssh/file_manager'
);

// Server Statistics API (port 8085)
export const statsApi = createApiInstance(
    isDev ? 'http://localhost:8085' : ''
);

// Authentication API (port 8081) - includes users, alerts, version, releases
export const authApi = createApiInstance(
    isDev ? 'http://localhost:8081' : ''
);

// ============================================================================
// ERROR HANDLING
// ============================================================================

class ApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public code?: string
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

function handleApiError(error: unknown, operation: string): never {
    if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error || error.message;
        
        if (status === 401) {
            throw new ApiError('Authentication required', 401);
        } else if (status === 403) {
            throw new ApiError('Access denied', 403);
        } else if (status === 404) {
            throw new ApiError('Resource not found', 404);
        } else if (status && status >= 500) {
            throw new ApiError('Server error occurred', status);
        } else {
            throw new ApiError(message || `Failed to ${operation}`, status);
        }
    }
    
    if (error instanceof ApiError) {
        throw error;
    }
    
    throw new ApiError(`Unexpected error during ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`);
}

// ============================================================================
// SSH HOST MANAGEMENT
// ============================================================================

export async function getSSHHosts(): Promise<SSHHost[]> {
    try {
        const response = await sshHostApi.get('/db/host');
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch SSH hosts');
    }
}

export async function createSSHHost(hostData: SSHHostData): Promise<SSHHost> {
    try {
        const submitData = {
            name: hostData.name || '',
            ip: hostData.ip,
            port: parseInt(hostData.port.toString()) || 22,
            username: hostData.username,
            folder: hostData.folder || '',
            tags: hostData.tags || [],
            pin: hostData.pin || false,
            authMethod: hostData.authType,
            password: hostData.authType === 'password' ? hostData.password : '',
            key: hostData.authType === 'key' ? hostData.key : null,
            keyPassword: hostData.authType === 'key' ? hostData.keyPassword : '',
            keyType: hostData.authType === 'key' ? hostData.keyType : '',
            enableTerminal: hostData.enableTerminal !== false,
            enableTunnel: hostData.enableTunnel !== false,
            enableFileManager: hostData.enableFileManager !== false,
            defaultPath: hostData.defaultPath || '/',
            tunnelConnections: hostData.tunnelConnections || [],
        };

        if (!submitData.enableTunnel) {
            submitData.tunnelConnections = [];
        }

        if (!submitData.enableFileManager) {
            submitData.defaultPath = '';
        }

        if (hostData.authType === 'key' && hostData.key instanceof File) {
            const formData = new FormData();
            formData.append('key', hostData.key);

            const dataWithoutFile = { ...submitData };
            delete dataWithoutFile.key;
            formData.append('data', JSON.stringify(dataWithoutFile));

            const response = await sshHostApi.post('/db/host', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        } else {
            const response = await sshHostApi.post('/db/host', submitData);
            return response.data;
        }
    } catch (error) {
        handleApiError(error, 'create SSH host');
    }
}

export async function updateSSHHost(hostId: number, hostData: SSHHostData): Promise<SSHHost> {
    try {
        const submitData = {
            name: hostData.name || '',
            ip: hostData.ip,
            port: parseInt(hostData.port.toString()) || 22,
            username: hostData.username,
            folder: hostData.folder || '',
            tags: hostData.tags || [],
            pin: hostData.pin || false,
            authMethod: hostData.authType,
            password: hostData.authType === 'password' ? hostData.password : '',
            key: hostData.authType === 'key' ? hostData.key : null,
            keyPassword: hostData.authType === 'key' ? hostData.keyPassword : '',
            keyType: hostData.authType === 'key' ? hostData.keyType : '',
            enableTerminal: hostData.enableTerminal !== false,
            enableTunnel: hostData.enableTunnel !== false,
            enableFileManager: hostData.enableFileManager !== false,
            defaultPath: hostData.defaultPath || '/',
            tunnelConnections: hostData.tunnelConnections || [],
        };

        if (!submitData.enableTunnel) {
            submitData.tunnelConnections = [];
        }
        if (!submitData.enableFileManager) {
            submitData.defaultPath = '';
        }

        if (hostData.authType === 'key' && hostData.key instanceof File) {
            const formData = new FormData();
            formData.append('key', hostData.key);

            const dataWithoutFile = { ...submitData };
            delete dataWithoutFile.key;
            formData.append('data', JSON.stringify(dataWithoutFile));

            const response = await sshHostApi.put(`/db/host/${hostId}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return response.data;
        } else {
            const response = await sshHostApi.put(`/db/host/${hostId}`, submitData);
            return response.data;
        }
    } catch (error) {
        handleApiError(error, 'update SSH host');
    }
}

export async function bulkImportSSHHosts(hosts: SSHHostData[]): Promise<{
    message: string;
    success: number;
    failed: number;
    errors: string[];
}> {
    try {
        const response = await sshHostApi.post('/bulk-import', { hosts });
        return response.data;
    } catch (error) {
        handleApiError(error, 'bulk import SSH hosts');
    }
}

export async function deleteSSHHost(hostId: number): Promise<any> {
    try {
        const response = await sshHostApi.delete(`/db/host/${hostId}`);
        return response.data;
    } catch (error) {
        handleApiError(error, 'delete SSH host');
    }
}

export async function getSSHHostById(hostId: number): Promise<SSHHost> {
    try {
        const response = await sshHostApi.get(`/db/host/${hostId}`);
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch SSH host');
    }
}

// ============================================================================
// TUNNEL MANAGEMENT
// ============================================================================

export async function getTunnelStatuses(): Promise<Record<string, TunnelStatus>> {
    try {
        const response = await tunnelApi.get('/tunnel/status');
        return response.data || {};
    } catch (error) {
        handleApiError(error, 'fetch tunnel statuses');
    }
}

export async function getTunnelStatusByName(tunnelName: string): Promise<TunnelStatus | undefined> {
    const statuses = await getTunnelStatuses();
    return statuses[tunnelName];
}

export async function connectTunnel(tunnelConfig: TunnelConfig): Promise<any> {
    try {
        const response = await tunnelApi.post('/tunnel/connect', tunnelConfig);
        return response.data;
    } catch (error) {
        handleApiError(error, 'connect tunnel');
    }
}

export async function disconnectTunnel(tunnelName: string): Promise<any> {
    try {
        const response = await tunnelApi.post('/tunnel/disconnect', { tunnelName });
        return response.data;
    } catch (error) {
        handleApiError(error, 'disconnect tunnel');
    }
}

export async function cancelTunnel(tunnelName: string): Promise<any> {
    try {
        const response = await tunnelApi.post('/tunnel/cancel', { tunnelName });
        return response.data;
    } catch (error) {
        handleApiError(error, 'cancel tunnel');
    }
}

// ============================================================================
// FILE MANAGER METADATA (Recent, Pinned, Shortcuts)
// ============================================================================

export async function getFileManagerRecent(hostId: number): Promise<FileManagerFile[]> {
    try {
        const response = await sshHostApi.get(`/file_manager/recent?hostId=${hostId}`);
        return response.data || [];
    } catch (error) {
        return [];
    }
}

export async function addFileManagerRecent(file: FileManagerOperation): Promise<any> {
    try {
        const response = await sshHostApi.post('/file_manager/recent', file);
        return response.data;
    } catch (error) {
        handleApiError(error, 'add recent file');
    }
}

export async function removeFileManagerRecent(file: FileManagerOperation): Promise<any> {
    try {
        const response = await sshHostApi.delete('/file_manager/recent', { data: file });
        return response.data;
    } catch (error) {
        handleApiError(error, 'remove recent file');
    }
}

export async function getFileManagerPinned(hostId: number): Promise<FileManagerFile[]> {
    try {
        const response = await sshHostApi.get(`/file_manager/pinned?hostId=${hostId}`);
        return response.data || [];
    } catch (error) {
        return [];
    }
}

export async function addFileManagerPinned(file: FileManagerOperation): Promise<any> {
    try {
        const response = await sshHostApi.post('/file_manager/pinned', file);
        return response.data;
    } catch (error) {
        handleApiError(error, 'add pinned file');
    }
}

export async function removeFileManagerPinned(file: FileManagerOperation): Promise<any> {
    try {
        const response = await sshHostApi.delete('/file_manager/pinned', { data: file });
        return response.data;
    } catch (error) {
        handleApiError(error, 'remove pinned file');
    }
}

export async function getFileManagerShortcuts(hostId: number): Promise<FileManagerShortcut[]> {
    try {
        const response = await sshHostApi.get(`/file_manager/shortcuts?hostId=${hostId}`);
        return response.data || [];
    } catch (error) {
        return [];
    }
}

export async function addFileManagerShortcut(shortcut: FileManagerOperation): Promise<any> {
    try {
        const response = await sshHostApi.post('/file_manager/shortcuts', shortcut);
        return response.data;
    } catch (error) {
        handleApiError(error, 'add shortcut');
    }
}

export async function removeFileManagerShortcut(shortcut: FileManagerOperation): Promise<any> {
    try {
        const response = await sshHostApi.delete('/file_manager/shortcuts', { data: shortcut });
        return response.data;
    } catch (error) {
        handleApiError(error, 'remove shortcut');
    }
}

// ============================================================================
// SSH FILE OPERATIONS
// ============================================================================

export async function connectSSH(sessionId: string, config: {
    ip: string;
    port: number;
    username: string;
    password?: string;
    sshKey?: string;
    keyPassword?: string;
}): Promise<any> {
    try {
        const response = await fileManagerApi.post('/ssh/connect', {
            sessionId,
            ...config
        });
        return response.data;
    } catch (error) {
        handleApiError(error, 'connect SSH');
    }
}

export async function disconnectSSH(sessionId: string): Promise<any> {
    try {
        const response = await fileManagerApi.post('/ssh/disconnect', { sessionId });
        return response.data;
    } catch (error) {
        handleApiError(error, 'disconnect SSH');
    }
}

export async function getSSHStatus(sessionId: string): Promise<{ connected: boolean }> {
    try {
        const response = await fileManagerApi.get('/ssh/status', {
            params: { sessionId }
        });
        return response.data;
    } catch (error) {
        handleApiError(error, 'get SSH status');
    }
}

export async function listSSHFiles(sessionId: string, path: string): Promise<any[]> {
    try {
        const response = await fileManagerApi.get('/ssh/listFiles', {
            params: { sessionId, path }
        });
        return response.data || [];
    } catch (error) {
        handleApiError(error, 'list SSH files');
    }
}

export async function readSSHFile(sessionId: string, path: string): Promise<{ content: string; path: string }> {
    try {
        const response = await fileManagerApi.get('/ssh/readFile', {
            params: { sessionId, path }
        });
        return response.data;
    } catch (error) {
        handleApiError(error, 'read SSH file');
    }
}

export async function writeSSHFile(sessionId: string, path: string, content: string): Promise<any> {
    try {
        const response = await fileManagerApi.post('/ssh/writeFile', {
            sessionId,
            path,
            content
        });

        if (response.data && (response.data.message === 'File written successfully' || response.status === 200)) {
            return response.data;
        } else {
            throw new Error('File write operation did not return success status');
        }
    } catch (error) {
        handleApiError(error, 'write SSH file');
    }
}

export async function uploadSSHFile(sessionId: string, path: string, fileName: string, content: string): Promise<any> {
    try {
        const response = await fileManagerApi.post('/ssh/uploadFile', {
            sessionId,
            path,
            fileName,
            content
        });
        return response.data;
    } catch (error) {
        handleApiError(error, 'upload SSH file');
    }
}

export async function createSSHFile(sessionId: string, path: string, fileName: string, content: string = ''): Promise<any> {
    try {
        const response = await fileManagerApi.post('/ssh/createFile', {
            sessionId,
            path,
            fileName,
            content
        });
        return response.data;
    } catch (error) {
        handleApiError(error, 'create SSH file');
    }
}

export async function createSSHFolder(sessionId: string, path: string, folderName: string): Promise<any> {
    try {
        const response = await fileManagerApi.post('/ssh/createFolder', {
            sessionId,
            path,
            folderName
        });
        return response.data;
    } catch (error) {
        handleApiError(error, 'create SSH folder');
    }
}

export async function deleteSSHItem(sessionId: string, path: string, isDirectory: boolean): Promise<any> {
    try {
        const response = await fileManagerApi.delete('/ssh/deleteItem', {
            data: {
                sessionId,
                path,
                isDirectory
            }
        });
        return response.data;
    } catch (error) {
        handleApiError(error, 'delete SSH item');
    }
}

export async function renameSSHItem(sessionId: string, oldPath: string, newName: string): Promise<any> {
    try {
        const response = await fileManagerApi.put('/ssh/renameItem', {
            sessionId,
            oldPath,
            newName
        });
        return response.data;
    } catch (error) {
        handleApiError(error, 'rename SSH item');
    }
}

// ============================================================================
// SERVER STATISTICS
// ============================================================================

export async function getAllServerStatuses(): Promise<Record<number, ServerStatus>> {
    try {
        const response = await statsApi.get('/status');
        return response.data || {};
    } catch (error) {
        handleApiError(error, 'fetch server statuses');
    }
}

export async function getServerStatusById(id: number): Promise<ServerStatus> {
    try {
        const response = await statsApi.get(`/status/${id}`);
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch server status');
    }
}

export async function getServerMetricsById(id: number): Promise<ServerMetrics> {
    try {
        const response = await statsApi.get(`/metrics/${id}`);
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch server metrics');
    }
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

export async function registerUser(username: string, password: string): Promise<any> {
    try {
        const response = await authApi.post('/users/create', { username, password });
        return response.data;
    } catch (error) {
        handleApiError(error, 'register user');
    }
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
    try {
        const response = await authApi.post('/users/login', { username, password });
        return response.data;
    } catch (error) {
        handleApiError(error, 'login user');
    }
}

export async function getUserInfo(): Promise<UserInfo> {
    try {
        const response = await authApi.get('/users/me');
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch user info');
    }
}

export async function getRegistrationAllowed(): Promise<{ allowed: boolean }> {
    try {
        const response = await authApi.get('/users/registration-allowed');
        return response.data;
    } catch (error) {
        handleApiError(error, 'check registration status');
    }
}

export async function getOIDCConfig(): Promise<any> {
    try {
        const response = await authApi.get('/users/oidc-config');
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch OIDC config');
    }
}

export async function getUserCount(): Promise<UserCount> {
    try {
        const response = await authApi.get('/users/count');
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch user count');
    }
}

export async function initiatePasswordReset(username: string): Promise<any> {
    try {
        const response = await authApi.post('/users/initiate-reset', { username });
        return response.data;
    } catch (error) {
        handleApiError(error, 'initiate password reset');
    }
}

export async function verifyPasswordResetCode(username: string, resetCode: string): Promise<any> {
    try {
        const response = await authApi.post('/users/verify-reset-code', { username, resetCode });
        return response.data;
    } catch (error) {
        handleApiError(error, 'verify reset code');
    }
}

export async function completePasswordReset(username: string, tempToken: string, newPassword: string): Promise<any> {
    try {
        const response = await authApi.post('/users/complete-reset', { username, tempToken, newPassword });
        return response.data;
    } catch (error) {
        handleApiError(error, 'complete password reset');
    }
}

export async function getOIDCAuthorizeUrl(): Promise<OIDCAuthorize> {
    try {
        const response = await authApi.get('/users/oidc/authorize');
        return response.data;
    } catch (error) {
        handleApiError(error, 'get OIDC authorize URL');
    }
}

// ============================================================================
// USER MANAGEMENT
// ============================================================================

export async function getUserList(): Promise<{ users: UserInfo[] }> {
    try {
        const response = await authApi.get('/users/list');
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch user list');
    }
}

export async function makeUserAdmin(username: string): Promise<any> {
    try {
        const response = await authApi.post('/users/make-admin', { username });
        return response.data;
    } catch (error) {
        handleApiError(error, 'make user admin');
    }
}

export async function removeAdminStatus(username: string): Promise<any> {
    try {
        const response = await authApi.post('/users/remove-admin', { username });
        return response.data;
    } catch (error) {
        handleApiError(error, 'remove admin status');
    }
}

export async function deleteUser(username: string): Promise<any> {
    try {
        const response = await authApi.delete('/users/delete-user', { data: { username } });
        return response.data;
    } catch (error) {
        handleApiError(error, 'delete user');
    }
}

export async function deleteAccount(password: string): Promise<any> {
    try {
        const response = await authApi.delete('/users/delete-account', { data: { password } });
        return response.data;
    } catch (error) {
        handleApiError(error, 'delete account');
    }
}

export async function updateRegistrationAllowed(allowed: boolean): Promise<any> {
    try {
        const response = await authApi.patch('/users/registration-allowed', { allowed });
        return response.data;
    } catch (error) {
        handleApiError(error, 'update registration allowed');
    }
}

export async function updateOIDCConfig(config: any): Promise<any> {
    try {
        const response = await authApi.post('/users/oidc-config', config);
        return response.data;
    } catch (error) {
        handleApiError(error, 'update OIDC config');
    }
}

// ============================================================================
// ALERTS
// ============================================================================

export async function getUserAlerts(userId: string): Promise<{ alerts: any[] }> {
    try {
        const apiInstance = createApiInstance(isDev ? 'http://localhost:8081' : '');
        const response = await apiInstance.get(`/alerts/user/${userId}`);
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch user alerts');
    }
}

export async function dismissAlert(userId: string, alertId: string): Promise<any> {
    try {
        // Use the general API instance since alerts endpoint is at root level
        const apiInstance = createApiInstance(isDev ? 'http://localhost:8081' : '');
        const response = await apiInstance.post('/alerts/dismiss', { userId, alertId });
        return response.data;
    } catch (error) {
        handleApiError(error, 'dismiss alert');
    }
}

// ============================================================================
// UPDATES & RELEASES
// ============================================================================

export async function getReleasesRSS(perPage: number = 100): Promise<any> {
    try {
        // Use the general API instance since releases endpoint is at root level
        const apiInstance = createApiInstance(isDev ? 'http://localhost:8081' : '');
        const response = await apiInstance.get(`/releases/rss?per_page=${perPage}`);
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch releases RSS');
    }
}

export async function getVersionInfo(): Promise<any> {
    try {
        // Use the general API instance since version endpoint is at root level
        const apiInstance = createApiInstance(isDev ? 'http://localhost:8081' : '');
        const response = await apiInstance.get('/version/');
        return response.data;
    } catch (error) {
        handleApiError(error, 'fetch version info');
    }
}

// ============================================================================
// DATABASE HEALTH
// ============================================================================

export async function getDatabaseHealth(): Promise<any> {
    try {
        const response = await authApi.get('/users/db-health');
        return response.data;
    } catch (error) {
        handleApiError(error, 'check database health');
    }
}