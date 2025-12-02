'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Mic,
    Syringe,
    Dumbbell,
    Apple,
    Wind,
    BookOpen,
    Eye,
    Brain,
    GraduationCap,
    DollarSign,
    Beaker,
    Users
} from 'lucide-react';

const SPECIALISTS = [
    {
        id: 'CONCIERGE',
        name: 'Concierge',
        description: 'General help & routing',
        icon: Users,
        color: 'from-slate-500 to-slate-600',
        path: '/portal'
    },
    {
        id: 'PEPTIDE',
        name: 'Peptide Specialist',
        description: 'Dosing, timing, side effects, reconstitution',
        icon: Syringe,
        color: 'from-purple-500 to-purple-600',
        path: '/peptides'
    },
    {
        id: 'EXERCISE',
        name: 'Exercise Physiologist',
        description: 'Workouts, form, programming, recovery',
        icon: Dumbbell,
        color: 'from-orange-500 to-orange-600',
        path: '/workout'
    },
    {
        id: 'NUTRITION',
        name: 'Nutrition Coach',
        description: 'Diet, macros, fasting, supplements',
        icon: Apple,
        color: 'from-green-500 to-green-600',
        path: '/nutrition'
    },
    {
        id: 'BREATH',
        name: 'Breath Coach',
        description: 'Breathwork, stress, vagal tone',
        icon: Wind,
        color: 'from-cyan-500 to-cyan-600',
        path: '/breathe'
    },
    {
        id: 'JOURNAL',
        name: 'Reflection Guide',
        description: 'Journaling, emotional processing',
        icon: BookOpen,
        color: 'from-amber-500 to-amber-600',
        path: '/journal'
    },
    {
        id: 'VISION',
        name: 'Vision Tutor',
        description: '12-week program, eye exercises',
        icon: Eye,
        color: 'from-blue-500 to-blue-600',
        path: '/vision'
    },
    {
        id: 'NBACK',
        name: 'Cognitive Trainer',
        description: 'N-Back, mental training',
        icon: Brain,
        color: 'from-pink-500 to-pink-600',
        path: '/nback'
    },
    {
        id: 'COURSE',
        name: 'Course Guide',
        description: 'Lessons, modules, progress',
        icon: GraduationCap,
        color: 'from-indigo-500 to-indigo-600',
        path: '/modules'
    },
    {
        id: 'PROFESSOR',
        name: 'The Professor',
        description: 'Science, mechanisms, research',
        icon: Beaker,
        color: 'from-emerald-500 to-emerald-600',
        path: null
    },
    {
        id: 'SALES',
        name: 'Subscription Help',
        description: 'Pricing, plans, questions',
        icon: DollarSign,
        color: 'from-teal-500 to-teal-600',
        path: '/order'
    },
];

export default function SpecialistsPage() {
    const router = useRouter();
    const [selectedSpecialist, setSelectedSpecialist] = useState<string | null>(null);

    const handleSelect = (specialist: typeof SPECIALISTS[0]) => {
        setSelectedSpecialist(specialist.id);
        // Navigate to the specialist's page (which will auto-route voice to that agent)
        if (specialist.path) {
            router.push(specialist.path);
        }
    };

    return (
        <div
            className="min-h-screen p-8"
            style={{
                backgroundImage: 'linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundAttachment: 'fixed'
            }}
        >
            <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-white mb-4">Chat with a Specialist</h1>
                    <p className="text-xl text-slate-300">
                        Choose an expert to help you with your specific needs
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {SPECIALISTS.map((specialist) => {
                        const Icon = specialist.icon;
                        return (
                            <button
                                key={specialist.id}
                                onClick={() => handleSelect(specialist)}
                                className={`
                                    relative group p-6 rounded-2xl text-left transition-all duration-300
                                    bg-gradient-to-br from-gray-800/80 to-gray-900/80 backdrop-blur-sm
                                    border border-gray-700/50 hover:border-primary-400/50
                                    hover:scale-105 hover:shadow-xl hover:shadow-primary-500/20
                                    ${selectedSpecialist === specialist.id ? 'ring-2 ring-primary-400' : ''}
                                `}
                            >
                                <div className={`
                                    w-14 h-14 rounded-xl mb-4 flex items-center justify-center
                                    bg-gradient-to-br ${specialist.color}
                                    group-hover:scale-110 transition-transform
                                `}>
                                    <Icon className="w-7 h-7 text-white" />
                                </div>

                                <h3 className="text-lg font-semibold text-white mb-1">
                                    {specialist.name}
                                </h3>
                                <p className="text-sm text-slate-400">
                                    {specialist.description}
                                </p>

                                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Mic className="w-5 h-5 text-primary-400" />
                                </div>
                            </button>
                        );
                    })}
                </div>

                <div className="mt-12 text-center">
                    <p className="text-slate-400 text-sm">
                        Click a specialist to go to their page, then tap the microphone to start a voice conversation
                    </p>
                </div>
            </div>
        </div>
    );
}
