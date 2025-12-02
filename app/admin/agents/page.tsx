'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@auth0/nextjs-auth0';

const AGENTS = [
    { id: 'CONCIERGE', name: 'Concierge', description: 'Greets users, routes to specialists' },
    { id: 'PEPTIDE', name: 'Peptide Specialist', description: 'Dosing, timing, side effects' },
    { id: 'EXERCISE', name: 'Exercise Physiologist', description: 'Workouts, form, recovery' },
    { id: 'NUTRITION', name: 'Nutrition Coach', description: 'Diet, macros, fasting' },
    { id: 'BREATH', name: 'Breath Coach', description: 'Breathwork, vagal tone' },
    { id: 'JOURNAL', name: 'Reflection Guide', description: 'Journaling, emotions' },
    { id: 'VISION', name: 'Vision Tutor', description: '12-week program, exercises' },
    { id: 'NBACK', name: 'Cognitive Trainer', description: 'N-Back, mental training' },
    { id: 'COURSE', name: 'Course Guide', description: 'Lessons, modules, progress' },
    { id: 'PROFESSOR', name: 'The Professor', description: 'Science, mechanisms' },
    { id: 'SALES', name: 'Sales', description: 'Pricing, objections, signup' },
];

export default function AgentAdminPage() {
    const { user, isLoading: userLoading } = useUser();
    const [selectedAgent, setSelectedAgent] = useState(AGENTS[0].id);
    const [trainingText, setTrainingText] = useState('');
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(false);

    // Load existing training when agent changes
    useEffect(() => {
        if (user) {
            loadTraining(selectedAgent);
        }
    }, [selectedAgent, user]);

    const loadTraining = async (agentId: string) => {
        setLoading(true);
        setStatus('Loading...');
        try {
            const res = await fetch(`/api/agents/training?agent=${agentId}`);
            if (res.ok) {
                const data = await res.json();
                setTrainingText(data.training || '');
                setStatus(data.training ? 'Loaded existing training' : 'No training data yet');
            } else {
                setTrainingText('');
                setStatus('No training data found');
            }
        } catch (e) {
            setStatus('Error loading training');
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setStatus('Saving...');
        setLoading(true);
        try {
            const res = await fetch('/api/agents/training', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agentId: selectedAgent,
                    training: trainingText
                })
            });

            if (res.ok) {
                setStatus('Saved successfully!');
            } else {
                setStatus('Error saving training');
            }
        } catch (e) {
            setStatus('Error saving training');
        }
        setLoading(false);
    };

    if (userLoading) {
        return <div className="p-8">Loading...</div>;
    }

    if (!user) {
        return <div className="p-8">Please log in to access agent training.</div>;
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl font-bold mb-2 text-white">Agent Training Center</h1>
                <p className="text-slate-400 mb-8">Train your AI agents with custom instructions and knowledge</p>

                {/* Agent Selection */}
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
                    {AGENTS.map((agent) => (
                        <button
                            key={agent.id}
                            onClick={() => setSelectedAgent(agent.id)}
                            className={`p-4 rounded-xl text-left transition-all ${
                                selectedAgent === agent.id
                                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/30'
                                    : 'bg-slate-800/50 text-slate-300 hover:bg-slate-700/50 border border-slate-700'
                            }`}
                        >
                            <div className="font-bold">{agent.name}</div>
                            <div className="text-xs opacity-75 mt-1">{agent.description}</div>
                        </button>
                    ))}
                </div>

                {/* Training Editor */}
                <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-semibold text-white">
                            Training: {AGENTS.find(a => a.id === selectedAgent)?.name}
                        </h2>
                        <span className={`text-sm px-3 py-1 rounded-full ${
                            status.includes('Saved') ? 'bg-green-500/20 text-green-400' :
                            status.includes('Error') ? 'bg-red-500/20 text-red-400' :
                            'bg-slate-700 text-slate-400'
                        }`}>
                            {status}
                        </span>
                    </div>

                    <div className="mb-4 bg-blue-500/10 border border-blue-500/20 text-blue-300 p-4 rounded-lg text-sm">
                        <strong>Training Tips:</strong>
                        <ul className="mt-2 space-y-1 text-blue-200/80">
                            <li>- Define specific phrases and speech patterns</li>
                            <li>- Add product knowledge and pricing details</li>
                            <li>- Include objection handling scripts</li>
                            <li>- Keep it concise - responses are voice-based</li>
                        </ul>
                    </div>

                    <textarea
                        value={trainingText}
                        onChange={(e) => setTrainingText(e.target.value)}
                        disabled={loading}
                        className="w-full h-96 p-4 bg-slate-900/50 border border-slate-600 rounded-xl font-mono text-sm text-slate-200 focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none placeholder-slate-500 disabled:opacity-50"
                        placeholder={`Enter training instructions for ${AGENTS.find(a => a.id === selectedAgent)?.name}...

Example for Sales Closer:
---
When someone says "it's too expensive":
- Respond: "I totally get it. Let me ask you this - what's the cost of NOT doing this? Another year of feeling stuck?"
- Then pivot to the value: "For less than a coffee a day, you get unlimited access to our protocols..."

Key phrases to use:
- "Let me be real with you..."
- "Here's what I've seen work..."
- "What's holding you back from starting today?"
---`}
                    />

                    <div className="mt-6 flex justify-between items-center">
                        <div className="text-sm text-slate-400">
                            {trainingText.length} characters
                        </div>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setTrainingText('')}
                                className="px-6 py-3 rounded-xl font-medium text-slate-400 hover:text-white transition-colors"
                            >
                                Clear
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={loading}
                                className="bg-teal-600 hover:bg-teal-500 disabled:bg-slate-600 text-white px-8 py-3 rounded-xl font-bold transition-colors"
                            >
                                {loading ? 'Saving...' : 'Save Training'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Quick Reference */}
                <div className="mt-8 grid grid-cols-2 gap-6">
                    <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                        <h3 className="font-semibold text-white mb-3">Base Prompts (Hardcoded)</h3>
                        <p className="text-sm text-slate-400">
                            Each agent has built-in personality and knowledge. Your training ADDS to this base.
                            The base prompts are in <code className="bg-slate-900 px-1 rounded">src/lib/agents/</code>
                        </p>
                    </div>
                    <div className="bg-slate-800/30 rounded-xl p-6 border border-slate-700/50">
                        <h3 className="font-semibold text-white mb-3">Voice Optimization</h3>
                        <p className="text-sm text-slate-400">
                            Responses are limited to ~150 tokens (2-3 sentences) for fast voice delivery.
                            Keep training instructions focused on WHAT to say, not HOW to format.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
