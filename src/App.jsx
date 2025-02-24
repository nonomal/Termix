import { useState } from "react";
import { NewTerminal } from "./Terminal.jsx";
import AddHostModal from './AddHostModal.jsx';
import {Button, ButtonGroup} from '@mui/joy';
import { CssVarsProvider } from '@mui/joy';
import theme from './theme';

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
        port: 22
    });

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

    const closeTab = (id) => {
        const newTerminals = terminals.filter(t => t.id !== id);
        setTerminals(newTerminals);
        if (activeTab === id) {
            setActiveTab(newTerminals[0]?.id || null);
        }
    };

    return (
        <CssVarsProvider theme={theme}>
            <div className="flex h-screen bg-neutral-900 overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-neutral-800 text-white p-6 flex flex-col justify-between fixed left-0 top-0 bottom-0">
                    <div className="flex flex-col items-center">
                        <h2 className="text-2xl font-bold mb-8">Termix</h2>
                        <Button
                            onClick={() => setIsAddHostHidden(false)}
                            sx={{
                                backgroundColor: theme.palette.neutral[500],
                                '&:hover': {
                                    backgroundColor: theme.palette.neutral[900],
                                },
                            }}
                        >
                            Create Host
                        </Button>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col ml-64 overflow-hidden">
                    {/* Topbar */}
                    <div className="bg-neutral-800 text-white p-4 flex justify-between items-center space-x-2 overflow-x-auto whitespace-nowrap min-h-[64px]">
                        <div className="flex items-center gap-2">
                            {terminals.map((terminal, index) => (
                                <div key={terminal.id} className="flex items-center gap-2">
                                    {/* Tab Button Group */}
                                    <ButtonGroup>
                                        <Button
                                            onClick={() => setActiveTab(terminal.id)}
                                            sx={{
                                                backgroundColor: terminal.id === activeTab ? theme.palette.neutral[500] : theme.palette.neutral[900],
                                                color: theme.palette.text.primary,
                                                '&:hover': {
                                                    backgroundColor: theme.palette.neutral[300],
                                                },
                                            }}
                                        >
                                            {terminal.title}
                                        </Button>
                                        <Button
                                            onClick={() => closeTab(terminal.id)}
                                            sx={{
                                                backgroundColor: theme.palette.neutral[700],
                                                color: theme.palette.text.primary,
                                                '&:hover': {
                                                    backgroundColor: theme.palette.neutral[300],
                                                },
                                            }}
                                        >
                                            ×
                                        </Button>
                                    </ButtonGroup>

                                    {/* Separator (except after the last tab) */}
                                    {index !== terminals.length - 1 && (
                                        <div className="w-px h-6 bg-gray-600"></div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Terminal Views */}
                    <div className="flex-1 relative pt-12 overflow-hidden">
                        {terminals.map((terminal) => (
                            <div
                                key={terminal.id}
                                className={`absolute top-0 left-0 right-0 bottom-0 ${terminal.id === activeTab ? "block" : "hidden"}`}
                            >
                                <NewTerminal hostConfig={terminal.hostConfig} />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add Host Modal */}
                <AddHostModal
                    isHidden={isAddHostHidden}
                    form={form}
                    setForm={setForm}
                    handleAddHost={handleAddHost}
                    setIsAddHostHidden={setIsAddHostHidden}
                />
            </div>
        </CssVarsProvider>
    );
}

export default App;