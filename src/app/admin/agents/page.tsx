'use client';

import { useState } from 'react';
import { saveAgentTraining } from '@/app/actions/agentTraining';

const AGENTS = [
    { id: 'BIO_COACH', name: 'Bio-Coach (Nutrition)' },
    { id: 'VISION_TUTOR', name: 'Vision Tutor (Eyes)' },
    { id: 'PROFESSOR', name: 'The Professor (Education)' },
    { id: 'SALES_CLOSER', name: 'Sales Closer (Objections)' },
];

export default function AgentAdminPage() {
    const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].id);
    const [trainingText, setTrainingText] = useState('');
    const [status, setStatus] = useState('');

    const handleSave = async () => {
        setStatus('Saving to Vault...');
        // Hardcoded User ID for now - in production this comes from session
        const userId = '68c274682eab19fcb08e5a2c';

        const result = await saveAgentTraining(userId, selectedAgent, trainingText);
        if (result.success) {
            setStatus('Saved successfully! Agent updated.');
        } else {
            setStatus('Error saving to Vault.');
        }
    };

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8 text-slate-800">Agent Training Center</h1>

            <div className="grid grid-cols-4 gap-4 mb-8">
                {AGENTS.map((agent) => (
                    <button
                        key={agent.id}
                        onClick={() => setSelectedAgent(agent.id)}
                        className={`p-4 rounded-xl text-left transition-all ${selectedAgent === agent.id
                                ? 'bg-teal-600 text-white shadow-lg'
                                : 'bg-white text-slate-600 hover:bg-slate-50 border'
                            }`}
                    >
                        <div className="font-bold">{agent.name}</div>
                        <div className="text-xs opacity-75 mt-1">Click to edit</div>
                    </button>
                ))}
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 border border-slate-100">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold">
                        Training: {AGENTS.find(a => a.id === selectedAgent)?.name}
                    </h2>
                    <span className="text-sm text-slate-400">
                        Stored in: /Reset_Biology_Vault/Training/{selectedAgent}_Instructions.txt
                    </span>
                </div>

                <div className="mb-4 bg-blue-50 text-blue-800 p-4 rounded-lg text-sm">
                    <strong>Tip:</strong> Paste your specific speech patterns, phrases, or clinical protocols here.
                    The Agent will read this file before every conversation to "get into character."
                </div>

                <textarea
                    value={trainingText}
                    onChange={(e) => setTrainingText(e.target.value)}
                    className="w-full h-96 p-4 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                    placeholder={`Enter system instructions for ${selectedAgent}...\n\nExample:\n"When the user mentions headaches, always ask if they have been looking at screens for >2 hours."`}
                />

                <div className="mt-6 flex justify-between items-center">
                    <div className="text-sm font-medium text-teal-600">{status}</div>
                    <button
                        onClick={handleSave}
                        className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-bold transition-colors"
                    >
                        Save Training Data
                    </button>
                </div>
            </div>
        </div>
    );
}
