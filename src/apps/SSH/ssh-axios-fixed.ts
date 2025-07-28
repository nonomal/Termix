// SSH Host Management API functions
import axios from 'axios';

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
    enableConfigEditor?: boolean;
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
    enableConfigEditor: boolean;
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

// Determine the base URL based on environment
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const baseURL = isLocalhost ? 'http://localhost:8081' : window.location.origin;

// Create axios instance with base configuration for database operations (port 8081)
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Create config editor API instance for file operations (port 8084)
const configEditorApi = axios.create({
    baseURL: isLocalhost ? 'http://localhost:8084' : `${window.location.origin}/ssh`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Create tunnel API instance
const tunnelApi = axios.create({
    headers: {
        'Content-Type': 'application/json',
    },
});

function getCookie(name: string): string | undefined {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
}

// Add request interceptor to include JWT token for all API instances
api.interceptors.request.use((config) => {
    const token = getCookie('jwt');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

configEditorApi.interceptors.request.use((config) => {
    const token = getCookie('jwt');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

tunnelApi.interceptors.request.use((config) => {
    const token = getCookie('jwt');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Get all SSH hosts - FIXED: Changed from /ssh/host to /ssh/db/host
export async function getSSHHosts(): Promise<SSHHost[]> {
    try {
        const response = await api.get('/ssh/db/host');
        return response.data;
    } catch (error) {
        console.error('Error fetching SSH hosts:', error);
        throw error;
    }
}

// Create new SSH host
export async function createSSHHost(hostData: SSHHostData): Promise<SSHHost> {
    try {
        // Prepare the data according to your backend schema
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
            enableConfigEditor: hostData.enableConfigEditor !== false,
            defaultPath: hostData.defaultPath || '/',
            tunnelConnections: hostData.tunnelConnections || [],
        };

        if (!submitData.enableTunnel) {
            submitData.tunnelConnections = [];
        }

        if (!submitData.enableConfigEditor) {
            submitData.defaultPath = '';
        }

        if (hostData.authType === 'key' && hostData.key instanceof File) {
            const formData = new FormData();
            formData.append('key', hostData.key);
            
            const dataWithoutFile = { ...submitData };
            delete dataWithoutFile.key;
            formData.append('data', JSON.stringify(dataWithoutFile));
            
            const response = await api.post('/ssh/db/host', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            return response.data;
        } else {
            const response = await api.post('/ssh/db/host', submitData);
            return response.data;
        }
    } catch (error) {
        console.error('Error creating SSH host:', error);
        throw error;
    }
}

// Update existing SSH host
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
            enableConfigEditor: hostData.enableConfigEditor !== false,
            defaultPath: hostData.defaultPath || '/',
            tunnelConnections: hostData.tunnelConnections || [],
        };

        if (!submitData.enableTunnel) {
            submitData.tunnelConnections = [];
        }
        if (!submitData.enableConfigEditor) {
            submitData.defaultPath = '';
        }

        if (hostData.authType === 'key' && hostData.key instanceof File) {
            const formData = new FormData();
            formData.append('key', hostData.key);
            
            const dataWithoutFile = { ...submitData };
            delete dataWithoutFile.key;
            formData.append('data', JSON.stringify(dataWithoutFile));
            
            const response = await api.put(`/ssh/db/host/${hostId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            return response.data;
        } else {
            const response = await api.put(`/ssh/db/host/${hostId}`, submitData);
            return response.data;
        }
    } catch (error) {
        console.error('Error updating SSH host:', error);
        throw error;
    }
}

// Delete SSH host
export async function deleteSSHHost(hostId: number): Promise<any> {
    try {
        const response = await api.delete(`/ssh/db/host/${hostId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting SSH host:', error);
        throw error;
    }
}

// Get SSH host by ID
export async function getSSHHostById(hostId: number): Promise<SSHHost> {
    try {
        const response = await api.get(`/ssh/db/host/${hostId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching SSH host:', error);
        throw error;
    }
}

// Tunnel-related functions
export async function getTunnelStatuses(): Promise<Record<string, TunnelStatus>> {
    try {
        const tunnelUrl = isLocalhost ? 'http://localhost:8083/status' : `${baseURL}/ssh_tunnel/status`;
        const response = await tunnelApi.get(tunnelUrl);
        return response.data || {};
    } catch (error) {
        console.error('Error fetching tunnel statuses:', error);
        throw error;
    }
}

export async function getTunnelStatusByName(tunnelName: string): Promise<TunnelStatus | undefined> {
    const statuses = await getTunnelStatuses();
    return statuses[tunnelName];
}

export async function connectTunnel(tunnelConfig: TunnelConfig): Promise<any> {
    try {
        const tunnelUrl = isLocalhost ? 'http://localhost:8083/connect' : `${baseURL}/ssh_tunnel/connect`;
        const response = await tunnelApi.post(tunnelUrl, tunnelConfig);
        return response.data;
    } catch (error) {
        console.error('Error connecting tunnel:', error);
        throw error;
    }
}

export async function disconnectTunnel(tunnelName: string): Promise<any> {
    try {
        const tunnelUrl = isLocalhost ? 'http://localhost:8083/disconnect' : `${baseURL}/ssh_tunnel/disconnect`;
        const response = await tunnelApi.post(tunnelUrl, { tunnelName });
        return response.data;
    } catch (error) {
        console.error('Error disconnecting tunnel:', error);
        throw error;
    }
}

export async function cancelTunnel(tunnelName: string): Promise<any> {
    try {
        const tunnelUrl = isLocalhost ? 'http://localhost:8083/cancel' : `${baseURL}/ssh_tunnel/cancel`;
        const response = await tunnelApi.post(tunnelUrl, { tunnelName });
        return response.data;
    } catch (error) {
        console.error('Error canceling tunnel:', error);
        throw error;
    }
}

export { api, configEditorApi }; 

// Config Editor API functions
interface ConfigEditorFile {
    name: string;
    path: string;
    type?: 'file' | 'directory';
    isSSH?: boolean;
    sshSessionId?: string;
}

interface ConfigEditorShortcut {
    name: string;
    path: string;
}

// Config Editor database functions (use port 8081 for database operations)
export async function getConfigEditorRecent(hostId: number): Promise<ConfigEditorFile[]> {
    try {
        console.log('Fetching recent files for host:', hostId);
        const response = await api.get(`/ssh/config_editor/recent?hostId=${hostId}`);
        console.log('Recent files response:', response.data);
        return response.data || [];
    } catch (error) {
        console.error('Error fetching recent files:', error);
        return [];
    }
}

export async function addConfigEditorRecent(file: { name: string; path: string; isSSH: boolean; sshSessionId?: string; hostId: number }): Promise<any> {
    try {
        console.log('Making request to add recent file:', file);
        const response = await api.post('/ssh/config_editor/recent', file);
        console.log('Add recent file response:', response.data);
        return response.data;
    } catch (error) {
        console.error('Error adding recent file:', error);
        throw error;
    }
}

export async function removeConfigEditorRecent(file: { name: string; path: string; isSSH: boolean; sshSessionId?: string; hostId: number }): Promise<any> {
    try {
        const response = await api.delete('/ssh/config_editor/recent', { data: file });
        return response.data;
    } catch (error) {
        console.error('Error removing recent file:', error);
        throw error;
    }
}

export async function getConfigEditorPinned(hostId: number): Promise<ConfigEditorFile[]> {
    try {
        const response = await api.get(`/ssh/config_editor/pinned?hostId=${hostId}`);
        return response.data || [];
    } catch (error) {
        console.error('Error fetching pinned files:', error);
        return [];
    }
}

export async function addConfigEditorPinned(file: { name: string; path: string; isSSH: boolean; sshSessionId?: string; hostId: number }): Promise<any> {
    try {
        const response = await api.post('/ssh/config_editor/pinned', file);
        return response.data;
    } catch (error) {
        console.error('Error adding pinned file:', error);
        throw error;
    }
}

export async function removeConfigEditorPinned(file: { name: string; path: string; isSSH: boolean; sshSessionId?: string; hostId: number }): Promise<any> {
    try {
        const response = await api.delete('/ssh/config_editor/pinned', { data: file });
        return response.data;
    } catch (error) {
        console.error('Error removing pinned file:', error);
        throw error;
    }
}

export async function getConfigEditorShortcuts(hostId: number): Promise<ConfigEditorShortcut[]> {
    try {
        const response = await api.get(`/ssh/config_editor/shortcuts?hostId=${hostId}`);
        return response.data || [];
    } catch (error) {
        console.error('Error fetching shortcuts:', error);
        return [];
    }
}

export async function addConfigEditorShortcut(shortcut: { name: string; path: string; isSSH: boolean; sshSessionId?: string; hostId: number }): Promise<any> {
    try {
        const response = await api.post('/ssh/config_editor/shortcuts', shortcut);
        return response.data;
    } catch (error) {
        console.error('Error adding shortcut:', error);
        throw error;
    }
}

export async function removeConfigEditorShortcut(shortcut: { name: string; path: string; isSSH: boolean; sshSessionId?: string; hostId: number }): Promise<any> {
    try {
        const response = await api.delete('/ssh/config_editor/shortcuts', { data: shortcut });
        return response.data;
    } catch (error) {
        console.error('Error removing shortcut:', error);
        throw error;
    }
}

// SSH file operations - FIXED: Using configEditorApi for port 8084
export async function connectSSH(sessionId: string, config: {
    ip: string;
    port: number;
    username: string;
    password?: string;
    sshKey?: string;
    keyPassword?: string;
}): Promise<any> {
    try {
        const response = await configEditorApi.post('/ssh/config_editor/ssh/connect', {
            sessionId,
            ...config
        });
        return response.data;
    } catch (error) {
        console.error('Error connecting SSH:', error);
        throw error;
    }
}

export async function disconnectSSH(sessionId: string): Promise<any> {
    try {
        const response = await configEditorApi.post('/ssh/config_editor/ssh/disconnect', { sessionId });
        return response.data;
    } catch (error) {
        console.error('Error disconnecting SSH:', error);
        throw error;
    }
}

export async function getSSHStatus(sessionId: string): Promise<{ connected: boolean }> {
    try {
        const response = await configEditorApi.get('/ssh/config_editor/ssh/status', {
            params: { sessionId }
        });
        return response.data;
    } catch (error) {
        console.error('Error getting SSH status:', error);
        throw error;
    }
}

export async function listSSHFiles(sessionId: string, path: string): Promise<any[]> {
    try {
        const response = await configEditorApi.get('/ssh/config_editor/ssh/listFiles', {
            params: { sessionId, path }
        });
        return response.data || [];
    } catch (error) {
        console.error('Error listing SSH files:', error);
        throw error;
    }
}

export async function readSSHFile(sessionId: string, path: string): Promise<{ content: string; path: string }> {
    try {
        const response = await configEditorApi.get('/ssh/config_editor/ssh/readFile', {
            params: { sessionId, path }
        });
        return response.data;
    } catch (error) {
        console.error('Error reading SSH file:', error);
        throw error;
    }
}

export async function writeSSHFile(sessionId: string, path: string, content: string): Promise<any> {
    try {
        console.log('Making writeSSHFile request:', { sessionId, path, contentLength: content.length });
        const response = await configEditorApi.post('/ssh/config_editor/ssh/writeFile', {
            sessionId,
            path,
            content
        });
        console.log('writeSSHFile response:', response.data);
        
        // Check if the response indicates success
        if (response.data && (response.data.message === 'File written successfully' || response.status === 200)) {
            console.log('File write operation completed successfully');
            return response.data;
        } else {
            throw new Error('File write operation did not return success status');
        }
    } catch (error) {
        console.error('Error writing SSH file:', error);
        console.error('Error type:', typeof error);
        console.error('Error constructor:', error?.constructor?.name);
        console.error('Error response:', (error as any)?.response);
        console.error('Error response data:', (error as any)?.response?.data);
        console.error('Error response status:', (error as any)?.response?.status);
        throw error;
    }
}