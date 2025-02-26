import { useState, useEffect } from "react";
import { NewTerminal } from "./Terminal.jsx";
import AddHostModal from "./AddHostModal.jsx";
import { Button } from "@mui/joy";
import { CssVarsProvider } from "@mui/joy";
import theme from "./theme";
import TabList from "./TabList.jsx";
import Launchpad from "./Launchpad.jsx";
import TermixIcon from "./images/termix_icon.png";
import RocketIcon from './images/launchpad_rocket.png';

function App() {
    const [isAddHostHidden, setIsAddHostHidden] = useState(true);
    const [terminals, setTerminals] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const [nextId, setNextId] = useState(1);
    const [form, setForm] = useState({
        name: "",
        ip: "",
        user: "",
        password: "",
        port: 22,
    });
    const [isLaunchpadOpen, setIsLaunchpadOpen] = useState(false);

    // Handle keypress for opening launchpad
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && e.key === "l") {
                e.preventDefault();
                setIsLaunchpadOpen((prev) => !prev);
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    // Handle adding a host
    const handleAddHost = () => {
        if (form.ip && form.user && form.password && form.port) {
            const newTerminal = {
                id: nextId,
                title: form.name || form.ip,
                hostConfig: {
                    ip: form.ip,
                    user: form.user,
                    password: form.password,
                    port: Number(form.port),
                },
                isSplit: false,
                terminalRef: null, // Reference to the terminal instance
            };
            setTerminals([...terminals, newTerminal]);
            setActiveTab(nextId);
            setNextId(nextId + 1);
            setIsAddHostHidden(true);
            setForm({ name: "", ip: "", user: "", password: "", port: 22 });
        } else {
            alert("Please fill out all fields.");
        }
    };

    // Close a terminal tab
    const closeTab = (id) => {
        const newTerminals = terminals.filter((t) => t.id !== id);
        setTerminals(newTerminals);
        if (activeTab === id) {
            setActiveTab(newTerminals[0]?.id || null);
        }
    };

    // Toggle split for a specific tab
    const toggleSplit = (id) => {
        setTerminals(terminals.map(t =>
            t.id === id ? { ...t, isSplit: !t.isSplit } : t
        ));
    };

    // Get the split terminals
    const splitTerminals = terminals.filter(t => t.isSplit);
    const mainTerminal = terminals.find(t => t.id === activeTab);

    return (
        <CssVarsProvider theme={theme}>
            <div className="flex h-screen bg-neutral-900 overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Topbar */}
                    <div className="bg-neutral-800 text-white p-4 flex items-center justify-between gap-4 min-h-[75px] max-h-[75px]">
                        <div className="bg-neutral-700 flex justify-center items-center gap-2 p-3 rounded-lg h-[52px]">
                            <img src={TermixIcon} alt="Termix Icon" className="w-[30px] h-[30px]" />
                            <h2 className="text-lg font-bold ml-[-2px]">Termix</h2>
                        </div>

                        <div className="flex-1 bg-neutral-700 rounded-lg overflow-hidden h-[52px] flex items-center">
                            <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-neutral-500 scrollbar-track-neutral-700 h-[52px] scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-h-1">
                                <TabList
                                    terminals={terminals}
                                    activeTab={activeTab}
                                    setActiveTab={setActiveTab}
                                    closeTab={closeTab}
                                    toggleSplit={toggleSplit}
                                    theme={theme}
                                />
                            </div>
                        </div>

                        {/* Launchpad Button */}
                        <Button
                            onClick={() => setIsLaunchpadOpen(true)}
                            sx={{
                                backgroundColor: theme.palette.neutral[700],
                                "&:hover": { backgroundColor: theme.palette.neutral[300] },
                                flexShrink: 0,
                                height: "52px",
                                width: "52px",
                                padding: 0,
                            }}
                        >
                            <img src={RocketIcon} alt="Launchpad" style={{ width: "70%", height: "70", objectFit: "contain" }} />
                        </Button>

                        {/* Add Host Button */}
                        <Button
                            onClick={() => setIsAddHostHidden(false)}
                            sx={{
                                backgroundColor: theme.palette.neutral[700],
                                "&:hover": { backgroundColor: theme.palette.neutral[300] },
                                flexShrink: 0,
                                height: "52px",
                                width: "52px",
                                fontSize: "3.5rem",
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                paddingTop: "2px",
                            }}
                        >
                            +
                        </Button>
                    </div>

                    {/* Terminal Views */}
                    <div className="flex-1 relative p-4">
                        {splitTerminals.length > 0 ? (
                            <div className={`grid ${splitTerminals.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-4 h-full`}>
                                {splitTerminals.map((terminal) => (
                                    <div key={terminal.id} className="bg-neutral-800 rounded-lg overflow-hidden shadow-xl border-5 border-neutral-700 h-full">
                                        <NewTerminal
                                            hostConfig={terminal.hostConfig}
                                            ref={(ref) => {
                                                if (ref && !terminal.terminalRef) {
                                                    // Store the terminal instance reference
                                                    setTerminals(prev => prev.map(t =>
                                                        t.id === terminal.id ? { ...t, terminalRef: ref } : t
                                                    ));
                                                }
                                            }}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="absolute top-4 left-4 right-4 bottom-4">
                                {mainTerminal && (
                                    <div className="bg-neutral-800 rounded-lg overflow-hidden shadow-xl border-5 border-neutral-700 h-full">
                                        <NewTerminal
                                            hostConfig={mainTerminal.hostConfig}
                                            ref={(ref) => {
                                                if (ref && !mainTerminal.terminalRef) {
                                                    // Store the terminal instance reference
                                                    setTerminals(prev => prev.map(t =>
                                                        t.id === mainTerminal.id ? { ...t, terminalRef: ref } : t
                                                    ));
                                                }
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal for adding a host */}
                <AddHostModal
                    isHidden={isAddHostHidden}
                    form={form}
                    setForm={setForm}
                    handleAddHost={handleAddHost}
                    setIsAddHostHidden={setIsAddHostHidden}
                />

                {/* Launchpad Component */}
                {isLaunchpadOpen && <Launchpad onClose={() => setIsLaunchpadOpen(false)} />}
            </div>
        </CssVarsProvider>
    );
}

export default App;