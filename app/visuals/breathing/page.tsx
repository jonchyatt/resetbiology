"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  BREATH_PATTERNS,
  BACKGROUNDS,
  COLOR_PRESETS,
  BreathingOrbCanvas,
  BreathIndicator,
  AudioAmplitudeDisplay,
  audioAnalyzer,
  BackgroundOption,
} from "@/components/visuals/BreathingOrb";

// ============================================================================
// TYPES
// ============================================================================

type TabKey = "mode" | "orb" | "environment" | "export";

type ExportSettings = {
  resolution: "1080p" | "4k" | "8k";
  format: "perspective" | "equirect";
  stereo: boolean;
  fps: number;
};

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function IconBreath() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
      <circle cx="12" cy="12" r="4" strokeWidth={1.5} />
    </svg>
  );
}

function IconAudio() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  );
}

function IconPalette() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    </svg>
  );
}

function IconStar() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function IconWater() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M12 3v1m0 16v1m-9-9h1m16 0h1M5.636 5.636l.707.707m11.314 11.314l.707.707M5.636 18.364l.707-.707m11.314-11.314l.707-.707" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}

function IconVideo() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  );
}

// ============================================================================
// CONTROL PANEL COMPONENTS
// ============================================================================

function ControlSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-900/50 p-4">
      <div className="flex items-center gap-2 mb-4 text-slate-200">
        {icon}
        <h3 className="text-sm font-medium uppercase tracking-wide">{title}</h3>
      </div>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
  showValue = true,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  showValue?: boolean;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-300">{label}</span>
        {showValue && (
          <span className="text-slate-400">
            {step < 1 ? value.toFixed(2) : value.toLocaleString()}{unit}
          </span>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-teal-400"
      />
    </label>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-300 mb-1">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white text-sm focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>{opt.label}</option>
        ))}
      </select>
    </label>
  );
}

function ToggleControl({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-10 h-6 rounded-full transition-colors ${checked ? "bg-teal-500" : "bg-slate-600"}`}>
          <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`} />
        </div>
      </div>
      <div>
        <span className="text-sm text-slate-200">{label}</span>
        {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
      </div>
    </label>
  );
}

function ColorPickerControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm text-slate-300 mb-1">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-lg border border-slate-600 bg-slate-800 p-1"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white font-mono focus:border-teal-400 focus:outline-none"
        />
      </div>
    </label>
  );
}

function FileUploadControl({
  label,
  accept,
  onFileSelect,
  currentFile,
  description,
}: {
  label: string;
  accept: string;
  onFileSelect: (file: File | null) => void;
  currentFile?: string;
  description?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    onFileSelect(file);
  };

  return (
    <div>
      <span className="block text-sm text-slate-300 mb-2">{label}</span>
      <div
        onClick={() => inputRef.current?.click()}
        className="relative border-2 border-dashed border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:border-teal-400 hover:bg-slate-800/50 transition-all"
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        <IconUpload />
        <p className="mt-2 text-sm text-slate-300">
          {currentFile ? (
            <span className="text-teal-400">{currentFile}</span>
          ) : (
            "Click or drag file to upload"
          )}
        </p>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
    </div>
  );
}

// ============================================================================
// COLOR PRESET PICKER
// ============================================================================

function ColorPresetPicker({
  selected,
  onSelect,
}: {
  selected: { colorA: string; colorB: string };
  onSelect: (colorA: string, colorB: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {COLOR_PRESETS.map((preset) => {
        const isSelected = preset.colorA === selected.colorA && preset.colorB === selected.colorB;
        return (
          <button
            key={preset.key}
            onClick={() => onSelect(preset.colorA, preset.colorB)}
            className={`group relative rounded-lg p-2 transition-all ${
              isSelected
                ? "ring-2 ring-teal-400 bg-slate-700"
                : "hover:bg-slate-700/50"
            }`}
            title={preset.description}
          >
            <div
              className="h-8 rounded-md"
              style={{
                background: `linear-gradient(135deg, ${preset.colorA} 0%, ${preset.colorB} 100%)`,
              }}
            />
            <span className="block text-xs text-slate-400 mt-1 truncate">{preset.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// BACKGROUND PRESET PICKER
// ============================================================================

function BackgroundPresetPicker({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {BACKGROUNDS.map((bg) => (
        <button
          key={bg.key}
          onClick={() => onSelect(bg.key)}
          className={`rounded-lg p-2 transition-all ${
            selected === bg.key
              ? "ring-2 ring-teal-400"
              : "hover:ring-1 hover:ring-slate-500"
          }`}
        >
          <div
            className="h-12 rounded-md border border-slate-600"
            style={{ background: bg.css }}
          />
          <span className="block text-xs text-slate-400 mt-1 truncate">{bg.label}</span>
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function VisualStudioPage() {
  // State for mode and patterns
  const [mode, setMode] = useState<"breath" | "audio">("breath");
  const [patternKey, setPatternKey] = useState("4-7-8");

  // Orb visual settings - updated defaults for better appearance
  const [colorA, setColorA] = useState("#ffdd77");
  const [colorB, setColorB] = useState("#ff4400");
  const [particleCount, setParticleCount] = useState(25000);
  const [intensity, setIntensity] = useState(1.5);
  const [turbulence, setTurbulence] = useState(0.4);

  // Background settings
  const [backgroundKey, setBackgroundKey] = useState("stars");
  const [customBgUrl, setCustomBgUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Star settings
  const [starEnabled, setStarEnabled] = useState(true);
  const [starCount, setStarCount] = useState(4000);
  const [starSpeed, setStarSpeed] = useState(0.3);
  const [starColorful, setStarColorful] = useState(true);

  // Water settings
  const [waterEnabled, setWaterEnabled] = useState(true);
  const [waterReflectivity, setWaterReflectivity] = useState(0.4);

  // Audio state
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioAmplitude, setAudioAmplitude] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationFrameRef = useRef<number>(0);
  const isPlayingRef = useRef(false); // Ref to avoid stale closure

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>("mode");

  // Export settings
  const [exportSettings, setExportSettings] = useState<ExportSettings>({
    resolution: "4k",
    format: "perspective",
    stereo: false,
    fps: 30,
  });

  // Compute background
  const background = useMemo<BackgroundOption>(() => {
    if (customBgUrl.trim()) {
      return {
        key: "custom",
        label: "Custom",
        css: `url(${customBgUrl}) center/cover no-repeat, ${BACKGROUNDS.find(b => b.key === "stars")?.css ?? "#000"}`,
      };
    }
    return BACKGROUNDS.find((b) => b.key === backgroundKey) ?? BACKGROUNDS[0];
  }, [backgroundKey, customBgUrl]);

  // Handle audio file selection
  const handleAudioFileSelect = useCallback((file: File | null) => {
    // Cleanup previous
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioAnalyzer.disconnect();

    if (file) {
      const url = URL.createObjectURL(file);
      setAudioFile(file);
      setAudioUrl(url);
      setMode("audio");
      console.log("[Page] Audio file selected:", file.name);
    } else {
      setAudioFile(null);
      setAudioUrl(null);
    }
    setIsPlaying(false);
    isPlayingRef.current = false;
    setAudioAmplitude(0);
  }, [audioUrl]);

  // Handle video file selection
  const handleVideoFileSelect = useCallback((file: File | null) => {
    if (videoUrl && videoUrl.startsWith("blob:")) {
      URL.revokeObjectURL(videoUrl);
    }

    if (file) {
      const url = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(url);
    } else {
      setVideoFile(null);
      setVideoUrl("");
    }
  }, [videoUrl]);

  // Audio animation loop - uses ref to avoid stale closure
  const updateAudioVisualization = useCallback(() => {
    if (isPlayingRef.current) {
      audioAnalyzer.update();
      setAudioAmplitude(audioAnalyzer.amplitude);
    }
    animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);
  }, []);

  // Play/pause audio
  const togglePlayback = useCallback(async () => {
    if (!audioRef.current) {
      console.error("[Page] No audio element");
      return;
    }

    if (isPlaying) {
      console.log("[Page] Pausing audio");
      audioRef.current.pause();
      setIsPlaying(false);
      isPlayingRef.current = false;
    } else {
      try {
        console.log("[Page] Connecting audio analyzer...");
        await audioAnalyzer.connect(audioRef.current);
        console.log("[Page] Playing audio...");
        await audioRef.current.play();
        setIsPlaying(true);
        isPlayingRef.current = true;
        console.log("[Page] Audio playing successfully");
      } catch (err) {
        console.error("[Page] Failed to play audio:", err);
      }
    }
  }, [isPlaying]);

  // Start animation loop on mount
  useEffect(() => {
    console.log("[Page] Starting animation loop");
    animationFrameRef.current = requestAnimationFrame(updateAudioVisualization);

    return () => {
      console.log("[Page] Stopping animation loop");
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [updateAudioVisualization]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (videoUrl && videoUrl.startsWith("blob:")) URL.revokeObjectURL(videoUrl);
      audioAnalyzer.disconnect();
    };
  }, []);

  // Generate batch command for offline rendering
  const generateBatchCommand = useCallback(() => {
    const resMap = { "1080p": 1920, "4k": 3840, "8k": 7680 };
    const res = resMap[exportSettings.resolution];

    let cmd = `blender -b -P scripts/visuals/blender_generate.py -- `;
    cmd += `--analysis scripts/visuals/output/analysis.json `;
    cmd += `--audio "YOUR_AUDIO.wav" `;
    cmd += `--out "renders/output.mp4" `;
    cmd += `--mode ${exportSettings.format} `;
    cmd += `--resolution ${res} `;
    cmd += `--fps ${exportSettings.fps} `;

    if (exportSettings.stereo) {
      cmd += `--stereo --stereo-format SIDEBYSIDE `;
    }

    return cmd;
  }, [exportSettings]);

  // Tab content renderer
  const renderTabContent = () => {
    switch (activeTab) {
      case "mode":
        return (
          <div className="space-y-6">
            {/* Mode Selection */}
            <ControlSection title="Visualization Mode" icon={<IconBreath />}>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("breath")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    mode === "breath"
                      ? "border-teal-400 bg-teal-500/10 text-teal-400"
                      : "border-slate-600 hover:border-slate-500 text-slate-300"
                  }`}
                >
                  <IconBreath />
                  <span className="text-sm font-medium">Breath Timer</span>
                  <span className="text-xs text-slate-400">Synced to breath patterns</span>
                </button>
                <button
                  onClick={() => setMode("audio")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                    mode === "audio"
                      ? "border-teal-400 bg-teal-500/10 text-teal-400"
                      : "border-slate-600 hover:border-slate-500 text-slate-300"
                  }`}
                >
                  <IconAudio />
                  <span className="text-sm font-medium">Audio Reactive</span>
                  <span className="text-xs text-slate-400">Responds to music/voice</span>
                </button>
              </div>
            </ControlSection>

            {/* Mode-specific controls */}
            {mode === "breath" ? (
              <ControlSection title="Breath Pattern">
                <SelectControl
                  label="Pattern"
                  value={patternKey}
                  onChange={setPatternKey}
                  options={Object.entries(BREATH_PATTERNS).map(([key, p]) => ({
                    key,
                    label: p.label,
                  }))}
                />
                <div className="text-xs text-slate-400 mt-2 p-3 bg-slate-800/50 rounded-lg">
                  {(() => {
                    const p = BREATH_PATTERNS[patternKey];
                    return (
                      <span>
                        Inhale: {p.inhale}s | Hold: {p.hold}s | Exhale: {p.exhale}s
                        {p.hold2 > 0 && ` | Hold: ${p.hold2}s`}
                      </span>
                    );
                  })()}
                </div>
              </ControlSection>
            ) : (
              <ControlSection title="Audio Source" icon={<IconAudio />}>
                <FileUploadControl
                  label="Upload Audio File"
                  accept="audio/*"
                  onFileSelect={handleAudioFileSelect}
                  currentFile={audioFile?.name}
                  description="MP3, WAV, OGG supported"
                />

                {audioUrl && (
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={togglePlayback}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                        isPlaying
                          ? "bg-orange-500 hover:bg-orange-600 text-white"
                          : "bg-teal-500 hover:bg-teal-600 text-white"
                      }`}
                    >
                      {isPlaying ? <IconPause /> : <IconPlay />}
                      {isPlaying ? "Pause" : "Play"}
                    </button>
                    <audio
                      ref={audioRef}
                      src={audioUrl}
                      onEnded={() => setIsPlaying(false)}
                      className="hidden"
                    />
                  </div>
                )}
              </ControlSection>
            )}
          </div>
        );

      case "orb":
        return (
          <div className="space-y-6">
            {/* Color Presets */}
            <ControlSection title="Color Presets" icon={<IconPalette />}>
              <ColorPresetPicker
                selected={{ colorA, colorB }}
                onSelect={(a, b) => {
                  setColorA(a);
                  setColorB(b);
                }}
              />
            </ControlSection>

            {/* Custom Colors */}
            <ControlSection title="Custom Colors">
              <ColorPickerControl
                label="Inner Core Color"
                value={colorA}
                onChange={setColorA}
              />
              <ColorPickerControl
                label="Outer Glow Color"
                value={colorB}
                onChange={setColorB}
              />
            </ControlSection>

            {/* Particle Settings */}
            <ControlSection title="Particle Settings">
              <SliderControl
                label="Particle Count"
                value={particleCount}
                onChange={setParticleCount}
                min={2000}
                max={50000}
                step={1000}
                unit=" particles"
              />
              <SliderControl
                label="Glow Intensity"
                value={intensity}
                onChange={setIntensity}
                min={0.5}
                max={3.0}
                step={0.1}
              />
              <SliderControl
                label="Turbulence"
                value={turbulence}
                onChange={setTurbulence}
                min={0.1}
                max={1.0}
                step={0.05}
              />
            </ControlSection>
          </div>
        );

      case "environment":
        return (
          <div className="space-y-6">
            {/* Background Presets */}
            <ControlSection title="Background Preset">
              <BackgroundPresetPicker
                selected={backgroundKey}
                onSelect={(key) => {
                  setBackgroundKey(key);
                  setCustomBgUrl("");
                }}
              />
            </ControlSection>

            {/* Custom Background */}
            <ControlSection title="Custom Background">
              <label className="block">
                <span className="block text-sm text-slate-300 mb-1">Image URL (360 equirectangular works)</span>
                <input
                  type="text"
                  placeholder="https://example.com/sky-360.jpg"
                  value={customBgUrl}
                  onChange={(e) => setCustomBgUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-teal-400 focus:outline-none"
                />
              </label>
            </ControlSection>

            {/* Background Video */}
            <ControlSection title="Background Video" icon={<IconVideo />}>
              <FileUploadControl
                label="Upload Background Video"
                accept="video/*"
                onFileSelect={handleVideoFileSelect}
                currentFile={videoFile?.name}
                description="MP4, WebM. Plays behind the orb."
              />
              <div className="mt-2">
                <label className="block">
                  <span className="block text-sm text-slate-300 mb-1">Or enter video URL</span>
                  <input
                    type="text"
                    placeholder="https://example.com/canyon-360.mp4"
                    value={videoFile ? "" : videoUrl}
                    onChange={(e) => {
                      setVideoFile(null);
                      setVideoUrl(e.target.value);
                    }}
                    disabled={!!videoFile}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white focus:border-teal-400 focus:outline-none disabled:opacity-50"
                  />
                </label>
              </div>
            </ControlSection>

            {/* Stars */}
            <ControlSection title="Star Field" icon={<IconStar />}>
              <ToggleControl
                label="Enable Stars"
                checked={starEnabled}
                onChange={setStarEnabled}
                description="Animated star background"
              />
              {starEnabled && (
                <>
                  <SliderControl
                    label="Star Count"
                    value={starCount}
                    onChange={setStarCount}
                    min={1000}
                    max={20000}
                    step={500}
                    unit=" stars"
                  />
                  <SliderControl
                    label="Star Speed"
                    value={starSpeed}
                    onChange={setStarSpeed}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                  <ToggleControl
                    label="Colorful Stars"
                    checked={starColorful}
                    onChange={setStarColorful}
                    description="Add varied colors to some stars"
                  />
                </>
              )}
            </ControlSection>

            {/* Water */}
            <ControlSection title="Water Reflection" icon={<IconWater />}>
              <ToggleControl
                label="Enable Water"
                checked={waterEnabled}
                onChange={setWaterEnabled}
                description="Reflective water plane below orb"
              />
              {waterEnabled && (
                <SliderControl
                  label="Reflectivity"
                  value={waterReflectivity}
                  onChange={setWaterReflectivity}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                />
              )}
            </ControlSection>
          </div>
        );

      case "export":
        return (
          <div className="space-y-6">
            <ControlSection title="Offline Video Rendering" icon={<IconDownload />}>
              <p className="text-sm text-slate-400 mb-4">
                Generate high-resolution videos (up to 8K 360) using Blender.
                Configure settings below and copy the command to run locally.
              </p>

              <SelectControl
                label="Resolution"
                value={exportSettings.resolution}
                onChange={(v) => setExportSettings({ ...exportSettings, resolution: v as ExportSettings["resolution"] })}
                options={[
                  { key: "1080p", label: "1080p (1920x1080)" },
                  { key: "4k", label: "4K (3840x2160)" },
                  { key: "8k", label: "8K (7680x4320)" },
                ]}
              />

              <SelectControl
                label="Format"
                value={exportSettings.format}
                onChange={(v) => setExportSettings({ ...exportSettings, format: v as ExportSettings["format"] })}
                options={[
                  { key: "perspective", label: "Standard HD (16:9)" },
                  { key: "equirect", label: "360 Equirectangular (VR)" },
                ]}
              />

              <SliderControl
                label="Frame Rate"
                value={exportSettings.fps}
                onChange={(v) => setExportSettings({ ...exportSettings, fps: v })}
                min={24}
                max={60}
                step={1}
                unit=" fps"
              />

              <ToggleControl
                label="Stereo 3D"
                checked={exportSettings.stereo}
                onChange={(v) => setExportSettings({ ...exportSettings, stereo: v })}
                description="Side-by-side stereo for VR headsets"
              />
            </ControlSection>

            <ControlSection title="Pipeline Commands">
              <div className="space-y-3">
                <div>
                  <span className="block text-sm text-slate-300 mb-2">1. Analyze Audio</span>
                  <code className="block p-3 bg-slate-800 rounded-lg text-xs text-teal-400 font-mono overflow-x-auto">
                    python scripts/visuals/analyze_audio.py input.wav scripts/visuals/output/analysis.json
                  </code>
                </div>

                <div>
                  <span className="block text-sm text-slate-300 mb-2">2. Render Video</span>
                  <code className="block p-3 bg-slate-800 rounded-lg text-xs text-teal-400 font-mono overflow-x-auto whitespace-pre-wrap">
                    {generateBatchCommand()}
                  </code>
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateBatchCommand());
                  }}
                  className="w-full py-2 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium transition-colors"
                >
                  Copy Render Command
                </button>
              </div>
            </ControlSection>

            <ControlSection title="Quick Start">
              <p className="text-sm text-slate-400">
                For one-click rendering, edit the paths in:
              </p>
              <code className="block mt-2 p-3 bg-slate-800 rounded-lg text-xs text-slate-300 font-mono">
                scripts/visuals/run_offline_pipeline.bat
              </code>
              <p className="text-xs text-slate-500 mt-2">
                Set AUDIO, BACKGROUND, and OUTPUT paths, then double-click to run.
              </p>
            </ControlSection>
          </div>
        );
    }
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{
        background: "radial-gradient(ellipse at 30% 20%, rgba(63,191,181,0.08), transparent 40%), radial-gradient(ellipse at 70% 80%, rgba(114,194,71,0.05), transparent 40%), #05060d",
      }}
    >
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white">Visual Studio</h1>
            <p className="text-sm text-slate-400">Audio-Reactive Orb Generator</p>
          </div>
          <a
            href="/portal"
            className="text-sm text-slate-400 hover:text-teal-400 transition-colors"
          >
            Back to Portal
          </a>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Tabs */}
            <div className="flex rounded-xl bg-slate-900/50 p-1 border border-slate-700/50">
              {[
                { key: "mode", label: "Mode" },
                { key: "orb", label: "Orb" },
                { key: "environment", label: "Environment" },
                { key: "export", label: "Export" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as TabKey)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg transition-all ${
                    activeTab === tab.key
                      ? "bg-teal-500 text-white"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="max-h-[calc(100vh-200px)] overflow-y-auto pr-2 space-y-4">
              {renderTabContent()}
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-24">
              <div className="relative">
                <BreathingOrbCanvas
                  mode={mode}
                  patternKey={patternKey}
                  audioAmplitude={audioAmplitude}
                  background={background}
                  particleCount={particleCount}
                  colorA={colorA}
                  colorB={colorB}
                  intensity={intensity}
                  turbulence={turbulence}
                  starEnabled={starEnabled}
                  starCount={starCount}
                  starSpeed={starSpeed}
                  starColorful={starColorful}
                  waterEnabled={waterEnabled}
                  waterReflectivity={waterReflectivity}
                  videoUrl={videoUrl || undefined}
                />

                {/* Overlay indicators */}
                {mode === "breath" && (
                  <BreathIndicator patternKey={patternKey} />
                )}
                {mode === "audio" && isPlaying && (
                  <AudioAmplitudeDisplay amplitude={audioAmplitude} />
                )}
              </div>

              {/* Quick info */}
              <div className="mt-4 p-4 rounded-xl bg-slate-900/50 border border-slate-700/50">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="block text-2xl font-semibold text-teal-400">
                      {particleCount.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-400">Particles</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-semibold text-teal-400">
                      {mode === "breath" ? BREATH_PATTERNS[patternKey]?.label.split(" ")[0] : "Audio"}
                    </span>
                    <span className="text-xs text-slate-400">Mode</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-semibold text-teal-400">
                      {starEnabled ? starCount.toLocaleString() : "Off"}
                    </span>
                    <span className="text-xs text-slate-400">Stars</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
