'use client';

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Mic, Keyboard, X, Battery, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VoiceAgentDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    minutesRemaining: number;
}

export function VoiceAgentDrawer({ isOpen, onClose, minutesRemaining }: VoiceAgentDrawerProps) {
    const pathname = usePathname();
    const [mode, setMode] = useState<'voice' | 'text'>('voice');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [agentMessage, setAgentMessage] = useState("I'm ready to help with your biology reset.");

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Simulated "Gas Tank" color logic
    const batteryColor = minutesRemaining > 30 ? 'text-green-500' : minutesRemaining > 10 ? 'text-yellow-500' : 'text-red-500';

    // Permission Logic
    useEffect(() => {
        if (isOpen) {
            checkMicrophonePermission();
        } else {
            stopRecording();
            setIsListening(false);
        }
    }, [isOpen]);

    const checkMicrophonePermission = async () => {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            if (permissionStatus.state === 'granted') {
                // Already granted, we can start if user wants, or just be ready
            } else if (permissionStatus.state === 'prompt') {
                // Will ask when we call getUserMedia
            } else {
                // Denied
                setAgentMessage("Microphone access is denied. Please enable it in your browser settings.");
            }
        } catch (e) {
            // Firefox doesn't support querying microphone permission
            console.log("Permission query not supported", e);
        }
    };

    const startRecording = async () => {
        try {
            // Check permission state first if possible, but getUserMedia will prompt if needed
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
            setAgentMessage("Could not access microphone. Please allow permissions.");
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
        // OpenAI Whisper needs a proper filename with extension
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        formData.append('audio', audioFile);

        // Send current page for context-aware routing (skips intent classification)
        if (pathname) {
            formData.append('pageContext', pathname);
        }

        console.log('[VoiceDrawer] Sending audio to backend:', audioFile.size, 'bytes, page:', pathname);

        try {
            const response = await fetch('/api/voice/chat', {
                method: 'POST',
                body: formData,
            });

            console.log('[VoiceDrawer] Response status:', response.status);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[VoiceDrawer] API error:', response.status, errorData);
                throw new Error(errorData.error || `Failed to process voice (${response.status})`);
            }

            // 1. Get Text Response from Header
            const textResponse = decodeURIComponent(response.headers.get('X-Agent-Response-Text') || '');
            console.log('[VoiceDrawer] Agent response text:', textResponse);
            setAgentMessage(textResponse || "I processed your request but have no response.");

            // 2. Play Audio Response
            const audioBlobResponse = await response.blob();
            console.log('[VoiceDrawer] Audio response size:', audioBlobResponse.size, 'bytes');
            const audioUrl = URL.createObjectURL(audioBlobResponse);

            if (audioRef.current) {
                audioRef.current.src = audioUrl;
                audioRef.current.play().catch(err => {
                    console.error('[VoiceDrawer] Audio playback error:', err);
                });
            }

        } catch (error) {
            console.error("[VoiceDrawer] Error sending audio:", error);
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            setAgentMessage(`Sorry, I had trouble: ${errorMsg}. Please try again.`);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.5 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black z-40"
                    />

                    {/* Drawer */}
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl z-50 border-t border-slate-200 dark:border-slate-800"
                        style={{ height: '35vh', maxHeight: '400px' }}
                    >
                        {/* Hidden Audio Player */}
                        <audio ref={audioRef} className="hidden" />

                        {/* Header / Handle */}
                        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
                            <div className="w-12 h-1 bg-slate-300 rounded-full mx-auto absolute left-0 right-0 top-4" />

                            {/* Gas Tank Indicator */}
                            <div className={`flex items-center gap-2 ${batteryColor} font-medium z-10`}>
                                <Battery className="w-5 h-5" />
                                <span>{minutesRemaining} min</span>
                            </div>

                            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full z-10">
                                <X className="w-6 h-6 text-slate-500" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="h-full flex flex-row items-center justify-between px-8 pb-8">

                            {/* Left: Status Text */}
                            <div className="flex-1 pr-4">
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                                    {isListening ? "Listening..." : isProcessing ? "Thinking..." : "Tap to Speak"}
                                </h3>
                                <p className="text-slate-600 dark:text-slate-300 text-sm line-clamp-3">
                                    {agentMessage}
                                </p>
                            </div>

                            {/* Center: Visualizer (Only when active) */}
                            {(isListening || isProcessing) && (
                                <div className="flex items-center gap-1 h-16 mx-4">
                                    {[...Array(5)].map((_, i) => (
                                        <motion.div
                                            key={i}
                                            animate={{
                                                height: isListening ? [10, 40, 10] : isProcessing ? [10, 25, 10] : 5,
                                                opacity: isProcessing ? 0.6 : 1
                                            }}
                                            transition={{ repeat: Infinity, duration: 0.4 + Math.random() * 0.3 }}
                                            className={`w-2 rounded-full ${isProcessing ? 'bg-yellow-500' : 'bg-teal-500'}`}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Right: Controls */}
                            <div className="flex gap-4 items-center">
                                <button
                                    onClick={toggleListening}
                                    disabled={isProcessing}
                                    className={`p-4 rounded-full transition-all shadow-lg text-white ${isListening ? 'bg-red-500 shadow-red-500/50' :
                                        isProcessing ? 'bg-slate-400 cursor-not-allowed' :
                                            'bg-teal-600 shadow-teal-600/50 hover:scale-105'
                                        }`}
                                >
                                    {isProcessing ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
                                </button>
                            </div>

                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
