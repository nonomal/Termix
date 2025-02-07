import { useState } from "react";
import "./App.css";
import { NewTerminal } from "./Terminal.jsx";

function App() {
    const [isAddHostHidden, setIsAddHostHidden] = useState(true);
    const [terminals, setTerminals] = useState([]);
    const [activeTab, setActiveTab] = useState(null);
    const [nextId, setNextId] = useState(1);
    const [form, setForm] = useState({ name: "", ip: "", user: "", password: "", port: "22" });

    const handleAddHost = () => {
        if (form.ip && form.user && form.password && form.port) {
            const newTerminal = {
                id: nextId,
                title: form.name || form.ip,
                hostConfig: {
                    ip: form.ip,
                    user: form.user,
                    password: form.password,
                    port: form.port,
                },
            };
            setTerminals([...terminals, newTerminal]);
            setActiveTab(nextId);
            setNextId(nextId + 1);
            setIsAddHostHidden(true);
            setForm({ name: "", ip: "", user: "", password: "", port: "22" });
        } else {
            alert("Please fill out all fields.");
        }
    };

    return (
        <>
            <div className="sidebar">
                <h2>Termix</h2>
                <button onClick={() => setIsAddHostHidden(!isAddHostHidden)}>Create Host</button>
            </div>
            <div className="topbar">
                {terminals.map((terminal) => (
                    <button
                        key={terminal.id}
                        onClick={() => setActiveTab(terminal.id)}
                        className={activeTab === terminal.id ? "active-tab" : ""}
                    >
                        {terminal.title}
                    </button>
                ))}
            </div>
            <div className="terminal-wrapper">
                {terminals.map((terminal) => (
                    <div
                        key={terminal.id}
                        className={`terminal-tab ${terminal.id === activeTab ? "active" : ""}`}
                    >
                        {terminal.hostConfig && <NewTerminal hostConfig={terminal.hostConfig} />}
                    </div>
                ))}
            </div>
            <div className={`add-host ${isAddHostHidden ? "hidden" : ""}`}>
                <h2>Add Host</h2>
                <button onClick={() => setIsAddHostHidden(true)} className="add-host-close">
                    ×
                </button>
                <input
                    type="text"
                    placeholder="Host Name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Host IP"
                    value={form.ip}
                    onChange={(e) => setForm({ ...form, ip: e.target.value })}
                />
                <input
                    type="text"
                    placeholder="Host User"
                    value={form.user}
                    onChange={(e) => setForm({ ...form, user: e.target.value })}
                />
                <input
                    type="password"
                    placeholder="Host Password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
                <input
                    type="number"
                    placeholder="Host Port"
                    value={form.port}
                    onChange={(e) => setForm({ ...form, port: e.target.value })}
                />
                <button onClick={handleAddHost}>Add</button>
            </div>
        </>
    );
}

export default App;