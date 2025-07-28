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

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const sshHostApi = axios.create({
    baseURL: isLocalhost ? 'http://localhost:8081' : window.location.origin,
    headers: {
        'Content-Type': 'application/json',
    },
});

const tunnelApi = axios.create({
    baseURL: isLocalhost ? 'http://localhost:8083' : window.location.origin,
    headers: {
        'Content-Type': 'application/json',
    },
});

const configEditorApi = axios.create({
    baseURL: isLocalhost ? 'http://localhost:8084' : window.location.origin,
    headers: {
        'Content-Type': 'application/json',
    }
})

function getCookie(name: string): string | undefined {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
}

sshHostApi.interceptors.request.use((config) => {
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

configEditorApi.interceptors.request.use((config) => {
    const token = getCookie('jwt');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export async function getSSHHosts(): Promise<SSHHost[]> {
    try {
        const response = await sshHostApi.get('/ssh/db/host');
        return response.data;
    } catch (error) {
        throw error;
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

            const dataWithoutFile = {...submitData};
            delete dataWithoutFile.key;
            formData.append('data', JSON.stringify(dataWithoutFile));

            const response = await sshHostApi.post('/ssh/db/host', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            return response.data;
        } else {
            const response = await sshHostApi.post('/ssh/db/host', submitData);
            return response.data;
        }
    } catch (error) {
        throw error;
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

            const dataWithoutFile = {...submitData};
            delete dataWithoutFile.key;
            formData.append('data', JSON.stringify(dataWithoutFile));

            const response = await sshHostApi.put(`/ssh/db/host/${hostId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            return response.data;
        } else {
            const response = await sshHostApi.put(`/ssh/db/host/${hostId}`, submitData);
            return response.data;
        }
    } catch (error) {
        throw error;
    }
}

export async function deleteSSHHost(hostId: number): Promise<any> {
    try {
        const response = await sshHostApi.delete(`/ssh/db/host/${hostId}`);
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function getSSHHostById(hostId: number): Promise<SSHHost> {
    try {
        const response = await sshHostApi.get(`/ssh/db/host/${hostId}`);
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function getTunnelStatuses(): Promise<Record<string, TunnelStatus>> {
    try {
        const response = await tunnelApi.get('/ssh/tunnel/status');
        return response.data || {};
    } catch (error) {
        throw error;
    }
}

export async function getTunnelStatusByName(tunnelName: string): Promise<TunnelStatus | undefined> {
    const statuses = await getTunnelStatuses();
    return statuses[tunnelName];
}

export async function connectTunnel(tunnelConfig: TunnelConfig): Promise<any> {
    try {
        const response = await tunnelApi.post('/ssh/tunnel/connect', tunnelConfig);
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function disconnectTunnel(tunnelName: string): Promise<any> {
    try {
        const response = await tunnelApi.post('/ssh/tunnel/disconnect', {tunnelName});
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function cancelTunnel(tunnelName: string): Promise<any> {
    try {
        const response = await tunnelApi.post('/ssh/tunnel/cancel', {tunnelName});
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function getConfigEditorRecent(hostId: number): Promise<ConfigEditorFile[]> {
    try {
        const response = await sshHostApi.get(`/ssh/config_editor/recent?hostId=${hostId}`);
        return response.data || [];
    } catch (error) {
        return [];
    }
}

export async function addConfigEditorRecent(file: {
    name: string;
    path: string;
    isSSH: boolean;
    sshSessionId?: string;
    hostId: number
}): Promise<any> {
    try {
        const response = await sshHostApi.post('/ssh/config_editor/recent', file);
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function removeConfigEditorRecent(file: {
    name: string;
    path: string;
    isSSH: boolean;
    sshSessionId?: string;
    hostId: number
}): Promise<any> {
    try {
        const response = await sshHostApi.delete('/ssh/config_editor/recent', {data: file});
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function getConfigEditorPinned(hostId: number): Promise<ConfigEditorFile[]> {
    try {
        const response = await sshHostApi.get(`/ssh/config_editor/pinned?hostId=${hostId}`);
        return response.data || [];
    } catch (error) {
        return [];
    }
}

export async function addConfigEditorPinned(file: {
    name: string;
    path: string;
    isSSH: boolean;
    sshSessionId?: string;
    hostId: number
}): Promise<any> {
    try {
        const response = await sshHostApi.post('/ssh/config_editor/pinned', file);
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function removeConfigEditorPinned(file: {
    name: string;
    path: string;
    isSSH: boolean;
    sshSessionId?: string;
    hostId: number
}): Promise<any> {
    try {
        const response = await sshHostApi.delete('/ssh/config_editor/pinned', {data: file});
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function getConfigEditorShortcuts(hostId: number): Promise<ConfigEditorShortcut[]> {
    try {
        const response = await sshHostApi.get(`/ssh/config_editor/shortcuts?hostId=${hostId}`);
        return response.data || [];
    } catch (error) {
        return [];
    }
}

export async function addConfigEditorShortcut(shortcut: {
    name: string;
    path: string;
    isSSH: boolean;
    sshSessionId?: string;
    hostId: number
}): Promise<any> {
    try {
        const response = await sshHostApi.post('/ssh/config_editor/shortcuts', shortcut);
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function removeConfigEditorShortcut(shortcut: {
    name: string;
    path: string;
    isSSH: boolean;
    sshSessionId?: string;
    hostId: number
}): Promise<any> {
    try {
        const response = await sshHostApi.delete('/ssh/config_editor/shortcuts', {data: shortcut});
        return response.data;
    } catch (error) {
        throw error;
    }
}

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
        throw error;
    }
}

export async function disconnectSSH(sessionId: string): Promise<any> {
    try {
        const response = await configEditorApi.post('/ssh/config_editor/ssh/disconnect', {sessionId});
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function getSSHStatus(sessionId: string): Promise<{ connected: boolean }> {
    try {
        const response = await configEditorApi.get('/ssh/config_editor/ssh/status', {
            params: {sessionId}
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function listSSHFiles(sessionId: string, path: string): Promise<any[]> {
    try {
        const response = await configEditorApi.get('/ssh/config_editor/ssh/listFiles', {
            params: {sessionId, path}
        });
        return response.data || [];
    } catch (error) {
        throw error;
    }
}

export async function readSSHFile(sessionId: string, path: string): Promise<{ content: string; path: string }> {
    try {
        const response = await configEditorApi.get('/ssh/config_editor/ssh/readFile', {
            params: {sessionId, path}
        });
        return response.data;
    } catch (error) {
        throw error;
    }
}

export async function writeSSHFile(sessionId: string, path: string, content: string): Promise<any> {
    try {
        const response = await configEditorApi.post('/ssh/config_editor/ssh/writeFile', {
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
        throw error;
    }
}

export {sshHostApi, tunnelApi, configEditorApi};