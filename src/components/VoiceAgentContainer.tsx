'use client';

import React, { useState } from 'react';
import { VoiceAgentDrawer } from './VoiceAgentDrawer';
import { Mic } from 'lucide-react';

export function VoiceAgentContainer() {
    const [isOpen, setIsOpen] = useState(false);
    // In a real app, we would fetch this from the DB or context
    const [minutesRemaining, setMinutesRemaining] = useState(60);

    return (
        <>
            {/* Floating Trigger Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 bg-teal-600 hover:bg-teal-700 text-white p-4 rounded-full shadow-xl z-40 transition-transform hover:scale-105"
                    aria-label="Open Voice Agent"
                >
                    <Mic className="w-6 h-6" />
                </button>
            )}

            {/* The Drawer */}
            <VoiceAgentDrawer
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                minutesRemaining={minutesRemaining}
            />
        </>
    );
}
