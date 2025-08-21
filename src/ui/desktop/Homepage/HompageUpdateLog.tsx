import React, {useEffect, useState} from "react";
import {Alert, AlertDescription, AlertTitle} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button.tsx";
import {Separator} from "@/components/ui/separator.tsx";
import axios from "axios";

interface HomepageUpdateLogProps extends React.ComponentProps<"div"> {
    loggedIn: boolean;
}

interface ReleaseItem {
    id: number;
    title: string;
    description: string;
    link: string;
    pubDate: string;
    version: string;
    isPrerelease: boolean;
    isDraft: boolean;
    assets: Array<{
        name: string;
        size: number;
        download_count: number;
        download_url: string;
    }>;
}

interface RSSResponse {
    feed: {
        title: string;
        description: string;
        link: string;
        updated: string;
    };
    items: ReleaseItem[];
    total_count: number;
    cached: boolean;
    cache_age?: number;
}

interface VersionResponse {
    status: 'up_to_date' | 'requires_update';
    version: string;
    latest_release: {
        name: string;
        published_at: string;
        html_url: string;
    };
    cached: boolean;
    cache_age?: number;
}

const apiBase = import.meta.env.DEV ? "http://localhost:8081" : "";

const API = axios.create({
    baseURL: apiBase,
});

export function HomepageUpdateLog({loggedIn}: HomepageUpdateLogProps) {
    const [releases, setReleases] = useState<RSSResponse | null>(null);
    const [versionInfo, setVersionInfo] = useState<VersionResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (loggedIn) {
            setLoading(true);
            Promise.all([
                API.get('/releases/rss?per_page=100'),
                API.get('/version/')
            ])
                .then(([releasesRes, versionRes]) => {
                    setReleases(releasesRes.data);
                    setVersionInfo(versionRes.data);
                    setError(null);
                })
                .catch(err => {
                    setError('Failed to fetch update information');
                })
                .finally(() => setLoading(false));
        }
    }, [loggedIn]);

    if (!loggedIn) {
        return null;
    }

    const formatDescription = (description: string) => {
        const firstLine = description.split('\n')[0];
        return firstLine
            .replace(/[#*`]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 200) + (firstLine.length > 200 ? '...' : '');
    };

    return (
        <div className="w-[400px] h-[600px] flex flex-col border-2 border-[#303032] rounded-lg bg-[#18181b] p-4 shadow-lg">
            <div>
                <h3 className="text-lg font-bold mb-3 text-white">Updates & Releases</h3>

                <Separator className="p-0.25 mt-3 mb-3 bg-[#303032]"/>

                {versionInfo && versionInfo.status === 'requires_update' && (
                    <Alert className="bg-[#0e0e10] border-[#303032] text-white">
                        <AlertTitle className="text-white">Update Available</AlertTitle>
                        <AlertDescription className="text-gray-300">
                            A new version ({versionInfo.version}) is available.
                            <Button
                                variant="outline"
                                size="sm"
                                className="p-1 h-auto text-blue-400 border-blue-500 hover:bg-blue-500 hover:text-white ml-2 transition-colors"
                                onClick={() => window.open("https://docs.termix.site/docs", '_blank')}
                            >
                                Update now
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {versionInfo && versionInfo.status === 'requires_update' && (
                <Separator className="p-0.25 mt-3 mb-3 bg-[#303032]"/>
            )}

            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {loading && (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive" className="bg-red-900/20 border-red-500 text-red-300">
                        <AlertTitle className="text-red-300">Error</AlertTitle>
                        <AlertDescription className="text-red-300">{error}</AlertDescription>
                    </Alert>
                )}

                {releases?.items.map((release) => (
                    <div
                        key={release.id}
                        className="border border-[#303032] rounded-lg p-3 hover:bg-[#0e0e10] transition-colors cursor-pointer bg-[#0e0e10]/50"
                        onClick={() => window.open(release.link, '_blank')}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-sm leading-tight flex-1 text-white">
                                {release.title}
                            </h4>
                            {release.isPrerelease && (
                                <span
                                    className="text-xs bg-yellow-600 text-yellow-100 px-2 py-1 rounded ml-2 flex-shrink-0 font-medium">
                                    Pre-release
                                </span>
                            )}
                        </div>

                        <p className="text-xs text-gray-300 mb-2 leading-relaxed">
                            {formatDescription(release.description)}
                        </p>

                        <div className="flex items-center text-xs text-gray-400">
                            <span>{new Date(release.pubDate).toLocaleDateString()}</span>
                            {release.assets.length > 0 && (
                                <>
                                    <span className="mx-2">•</span>
                                    <span>{release.assets.length} asset{release.assets.length !== 1 ? 's' : ''}</span>
                                </>
                            )}
                        </div>
                    </div>
                ))}

                {releases && releases.items.length === 0 && !loading && (
                    <Alert className="bg-[#0e0e10] border-[#303032] text-gray-300">
                        <AlertTitle className="text-gray-300">No Releases</AlertTitle>
                        <AlertDescription className="text-gray-400">
                            No releases found.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    );
}