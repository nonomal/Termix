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

// Determine the base URL based on environment
const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const baseURL = isLocalhost ? 'http://localhost:8081' : window.location.origin;

// Create axios instance with base configuration
const api = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
});

function getCookie(name: string): string | undefined {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
}

// Add request interceptor to include JWT token
api.interceptors.request.use((config) => {
    const token = getCookie('jwt'); // Adjust based on your token storage
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Get all SSH hosts
export async function getSSHHosts(): Promise<SSHHost[]> {
    try {
        const response = await api.get('/ssh/host');
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
            tags: hostData.tags || [], // Array of strings
            pin: hostData.pin || false,
            authMethod: hostData.authType, // Backend expects 'authMethod'
            password: hostData.authType === 'password' ? hostData.password : '',
            key: hostData.authType === 'key' ? hostData.key : null,
            keyPassword: hostData.authType === 'key' ? hostData.keyPassword : '',
            keyType: hostData.authType === 'key' ? hostData.keyType : '',
            enableTerminal: hostData.enableTerminal !== false, // Default to true
            enableTunnel: hostData.enableTunnel !== false, // Default to true
            enableConfigEditor: hostData.enableConfigEditor !== false, // Default to true
            defaultPath: hostData.defaultPath || '/',
            tunnelConnections: hostData.tunnelConnections || [], // Array of tunnel objects
        };

        // If tunnel is disabled, clear tunnel data
        if (!submitData.enableTunnel) {
            submitData.tunnelConnections = [];
        }

        // If config editor is disabled, clear config data
        if (!submitData.enableConfigEditor) {
            submitData.defaultPath = '';
        }

        // Handle file upload for SSH key
        if (hostData.authType === 'key' && hostData.key instanceof File) {
            const formData = new FormData();
            
            // Add the file
            formData.append('key', hostData.key);
            
            // Add all other data as JSON string
            const dataWithoutFile = { ...submitData };
            delete dataWithoutFile.key;
            formData.append('data', JSON.stringify(dataWithoutFile));
            
            // Submit with FormData
            const response = await api.post('/ssh/host', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            return response.data;
        } else {
            // Submit with JSON
            const response = await api.post('/ssh/host', submitData);
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

        // Handle disabled features
        if (!submitData.enableTunnel) {
            submitData.tunnelConnections = [];
        }
        if (!submitData.enableConfigEditor) {
            submitData.defaultPath = '';
        }

        // Handle file upload for SSH key
        if (hostData.authType === 'key' && hostData.key instanceof File) {
            const formData = new FormData();
            formData.append('key', hostData.key);
            
            const dataWithoutFile = { ...submitData };
            delete dataWithoutFile.key;
            formData.append('data', JSON.stringify(dataWithoutFile));
            
            const response = await api.put(`/ssh/host/${hostId}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            
            return response.data;
        } else {
            const response = await api.put(`/ssh/host/${hostId}`, submitData);
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
        const response = await api.delete(`/ssh/host/${hostId}`);
        return response.data;
    } catch (error) {
        console.error('Error deleting SSH host:', error);
        throw error;
    }
}

// Get SSH host by ID
export async function getSSHHostById(hostId: number): Promise<SSHHost> {
    try {
        const response = await api.get(`/ssh/host/${hostId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching SSH host:', error);
        throw error;
    }
}

export { api }; 