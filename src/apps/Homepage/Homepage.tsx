import {HomepageSidebar} from "@/apps/Homepage/HomepageSidebar.tsx";
import React from "react";

interface HomepageProps {
    onSelectView: (view: string) => void;
}

export function Homepage({ onSelectView }: HomepageProps): React.ReactElement {
    return (
        <div className="flex">
            <HomepageSidebar
                onSelectView={onSelectView}
            />
        </div>
    )
}