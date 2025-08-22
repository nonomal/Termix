import React from 'react';

interface ServerComponentProps {
    hostConfig?: any;
}

export function ServerComponent({ hostConfig }: ServerComponentProps): React.ReactElement {
    return (
        <div className="h-full w-full bg-[#18181b] text-white p-4 flex items-center justify-center">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Server Management</h2>
                <p className="text-gray-400">
                    {hostConfig ? `Connected to ${hostConfig.ip}:${hostConfig.port}` : 'No server selected'}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                    Server management features coming soon...
                </p>
            </div>
        </div>
    );
}
