import './App.css'
import React, { useState } from 'react';
import HuntRoyaleSimulator from "./pages/Home/HuntRoyaleSimulator.jsx";
import Planner from "./pages/Planner/Planner.jsx";

function App() {
    const [active, setActive] = useState('sim');
    return (
        <div className="App">
            <div className="hunt-royale-simulator">
                <div className="container">
                    <div className="header">
                        <h1>Hunt Royale Tools</h1>
                        <div className="controls" style={{ justifyContent: 'center' }}>
                            <button className={`btn ${active === 'sim' ? 'btn-active' : ''}`} onClick={() => setActive('sim')}>Simulator</button>
                            <button className={`btn ${active === 'planner' ? 'btn-active' : ''}`} onClick={() => setActive('planner')}>Planner</button>
                        </div>
                    </div>
                </div>
                {active === 'sim' ? <HuntRoyaleSimulator/> : <Planner/>}
            </div>
        </div>
    );
}

export default App
