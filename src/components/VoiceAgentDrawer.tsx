'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Keyboard, X, Battery, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceAgentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    minutesRemaining: number;
}

export function VoiceAgentDrawer({ isOpen, onClose, minutesRemaining }: VoiceAgentDrawerProps) {
    const [mode, setMode] = useState<'voice' | 'text'>('voice');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [agentMessage, setAgentMessage] = useState("I'm ready to help with your biology reset.");

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Simulated "Gas Tank" color logic
    const batteryColor = minutesRemaining > 30 ? 'text-green-500' : minutesRemaining > 10 ? 'text-yellow-500' : 'text-red-500';

    useEffect(() => {
        if (!isOpen) {
            stopRecording();
            setIsListening(false);
        }
    }, [isOpen]);

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);
            chunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (e) => {
                if (e.data.size > 0) {
                    chunksRef.current.push(e.data);
                }
            };

            mediaRecorderRef.current.onstop = async () => {
                const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
                await sendAudioToBackend(audioBlob);
            };

            mediaRecorderRef.current.start();
            setIsListening(true);
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Could not access microphone. Please allow permissions.");
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isListening) {
            mediaRecorderRef.current.stop();
            setIsListening(false);
            setIsProcessing(true);
            // Stop all tracks to release mic
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        }
    };

    const toggleListening = () => {
        if (isListening) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    const sendAudioToBackend = async (audioBlob: Blob) => {
        const formData = new FormData();
        formData.append('audio', audioBlob);

        try {
            const response = await fetch('/api/voice/chat', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Failed to process voice');

            // 1. Get Text Response from Header
            const textResponse = decodeURIComponent(response.headers.get('X-Agent-Response-Text') || '');
            setAgentMessage(textResponse);

            // 2. Play Audio Response
            const audioBlobResponse = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlobResponse);

            if (audioRef.current) {
                audioRef.current.src = audioUrl;
                audioRef.current.play();
            }

        } catch (error) {
            console.error("Error sending audio:", error);
            setAgentMessage("Sorry, I had trouble hearing you. Please try again.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl z-50 border-t border-slate-200 dark:border-slate-800"
                    style={{ height: mode === 'voice' ? '50vh' : '80vh' }}
                >
                    {/* Hidden Audio Player */}
                    <audio ref={audioRef} className="hidden" />

                    {/* Header / Handle */}
                    <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto absolute left-0 right-0" />

                        {/* Gas Tank Indicator */}
                        <div className={`flex items-center gap-2 ${batteryColor} font-medium`}>
                            <Battery className="w-5 h-5" />
                            <span>{minutesRemaining} min</span>
                        </div>

                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="h-full flex flex-col items-center justify-center p-6">

                        {mode === 'voice' ? (
                            <>
                                {/* Voice Visualizer (Simulated) */}
                                <div className="w-full h-32 flex items-center justify-center gap-1 mb-8">
                                    {[...Array(10)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{
                                                height: isListening ? [20, 60, 20] : isProcessing ? [20, 40, 20] : 10,
                                                opacity: isProcessing ? 0.5 : 1
                                            }}
                                            transition={{ repeat: Infinity, duration: 0.5 + Math.random() * 0.5 }}
                                            className={`w-3 rounded-full ${isProcessing ? 'bg-yellow-500' : 'bg-teal-500'}`}
                                        />
                                    ))}
                                </div>

                                <div className="text-center space-y-4 max-w-md">
                                    <h3 className="text-2xl font-semibold text-slate-800 dark:text-white">
                                        {isListening ? "Listening..." : isProcessing ? "Thinking..." : "Tap to Speak"}
                                    </h3>
                                    <p className="text-slate-500 transition-all duration-300">
                                        {agentMessage}
                                    </p>
                                </div>

                                {/* Controls */}
                                <div className="mt-12 flex gap-6">
                                    <button
                                        onClick={toggleListening}
                                        disabled={isProcessing}
                                        className={`p-6 rounded-full transition-all shadow-lg text-white ${isListening ? 'bg-red-500 shadow-red-500/50' :
                                                isProcessing ? 'bg-slate-400 cursor-not-allowed' :
                                                    'bg-teal-600 shadow-teal-600/50 hover:scale-105'
                                            }`}
                                    >
                                        {isProcessing ? <Loader2 className="w-8 h-8 animate-spin" /> : <Mic className="w-8 h-8" />}
                                    </button>

                                    <button
                                        onClick={() => setMode('text')}
                                        className="p-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                                    >
                                        <Keyboard className="w-8 h-8" />
                                    </button>
                                </div>
                            </>
                        ) : (
                            /* Text Mode Fallback */
                            <div className="w-full h-full flex flex-col">
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    <div className="bg-slate-100 p-4 rounded-lg rounded-tl-none max-w-[80%]">
                                        <p className="text-sm font-bold text-slate-500 mb-1">Concierge</p>
                                        <p>{agentMessage}</p>
                                    </div>
                                </div>
                                <div className="mt-auto pt-4 border-t flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Type your question..."
                                        className="flex-1 p-3 rounded-xl border border-slate-300 dark:bg-slate-800 dark:border-slate-700"
                                    />
                                    <button className="bg-teal-600 text-white px-6 rounded-xl font-medium">Send</button>
                                </div>
                                <button onClick={() => setMode('voice')} className="mt-4 text-teal-600 text-sm font-medium">
                                    Switch back to Voice
                                </button>
                            </div>
                        )}

                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
