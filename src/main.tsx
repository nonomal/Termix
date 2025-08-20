import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import DesktopApp from './DesktopApp.tsx'
import {ThemeProvider} from "@/components/theme-provider"
import {isMobile} from 'react-device-detect';
import {MobileApp} from "@/MobileApp.tsx";

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            {isMobile && (
                <MobileApp/>
            )}

            {!isMobile && (
                <DesktopApp/>
            )}
        </ThemeProvider>
    </StrictMode>,
)
