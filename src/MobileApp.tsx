import {TerminalComponent} from "@/ui/mobile/Apps/Terminal/TerminalComponent.tsx";
import {useState, useEffect} from "react";

export function MobileApp() {
    const [isMobileKeyboardOpen, setIsMobileKeyboardOpen] = useState(false);

    useEffect(() => {
        // Detect mobile keyboard opening/closing
        const handleResize = () => {
            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            const windowHeight = window.innerHeight;
            const keyboardHeight = windowHeight - viewportHeight;
            
            // If keyboard takes up more than 150px, consider it open
            setIsMobileKeyboardOpen(keyboardHeight > 150);
        };

        // Use visualViewport API for better mobile keyboard detection
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleResize);
        } else {
            window.addEventListener('resize', handleResize);
        }

        return () => {
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', handleResize);
            } else {
                window.removeEventListener('resize', handleResize);
            }
        };
    }, []);

    return (
        <div>
            <TerminalComponent
                hostConfig={{
                    ip: "192.210.197.55",
                    port: 22,
                    username: "root",
                    password: "bugatti$123",
                    authType: "password",
                }}
                isMobileKeyboardOpen={isMobileKeyboardOpen}
            />
        </div>
    )
}