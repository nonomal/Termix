import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import DesktopApp from './DesktopApp.tsx'
import {ThemeProvider} from "@/components/theme-provider"
import {MobileApp} from "@/MobileApp.tsx";
import {useState, useEffect} from 'react'

function BrowserType() {
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 767);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 767);
        };

        handleResize();

        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile ? <MobileApp /> : <DesktopApp />;
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
            <BrowserType />
        </ThemeProvider>
    </StrictMode>,
)
