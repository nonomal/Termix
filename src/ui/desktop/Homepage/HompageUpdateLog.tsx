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
            .substring(0, 100) + (firstLine.length > 100 ? '...' : '');
    };

    return (
        <div className="w-[400px] h-[600px] flex flex-col border-2 border-border rounded-lg bg-card p-4">
            <div>
                <h3 className="text-lg font-semibold mb-3">Updates & Releases</h3>

                <Separator className="p-0.25 mt-3 mb-3"/>

                {versionInfo && versionInfo.status === 'requires_update' && (
                    <Alert>
                        <AlertTitle>Update Available</AlertTitle>
                        <AlertDescription>
                            A new version ({versionInfo.version}) is available.
                            <Button
                                variant="link"
                                className="p-0 h-auto underline ml-1"
                                onClick={() => window.open("https://docs.termix.site/docs", '_blank')}
                            >
                                Update now
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
            </div>

            {versionInfo && versionInfo.status === 'requires_update' && (
                <Separator className="p-0.25 mt-3 mb-3"/>
            )}

            <div className="flex-1 overflow-y-auto space-y-3">
                {loading && (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                )}

                {error && (
                    <Alert variant="destructive">
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {releases?.items.map((release) => (
                    <div
                        key={release.id}
                        className="border border-border rounded-lg p-3 hover:bg-accent transition-colors cursor-pointer"
                        onClick={() => window.open(release.link, '_blank')}
                    >
                        <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-sm leading-tight flex-1">
                                {release.title}
                            </h4>
                            {release.isPrerelease && (
                                <span
                                    className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2 flex-shrink-0">
                                    Pre-release
                                </span>
                            )}
                        </div>

                        <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                            {formatDescription(release.description)}
                        </p>

                        <div className="flex items-center text-xs text-muted-foreground">
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
                    <Alert>
                        <AlertTitle>No Releases</AlertTitle>
                        <AlertDescription>
                            No releases found.
                        </AlertDescription>
                    </Alert>
                )}
            </div>
        </div>
    );
}