"use client"

import { useState } from "react"
import { Settings, Volume, VolumeX, Eye, EyeOff } from "lucide-react"
import { BreathSettings, DEFAULT_PACES, PaceType } from "@/types/breath"

interface ConfiguratorProps {
  settings: BreathSettings
  onSettingsChange: (settings: BreathSettings) => void
  isSessionActive: boolean
}

export function Configurator({ settings, onSettingsChange, isSessionActive }: ConfiguratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [tempSettings, setTempSettings] = useState(settings)

  const updateTempSetting = <K extends keyof BreathSettings>(
    key: K,
    value: BreathSettings[K]
  ) => {
    setTempSettings(prev => ({ ...prev, [key]: value }))
  }

  const applySettings = () => {
    onSettingsChange(tempSettings)
    setIsOpen(false)
  }

  const resetToDefaults = () => {
    const defaultSettings = {
      cyclesTarget: 3,
      breathsPerCycle: 40,
      pace: DEFAULT_PACES.medium,
      audioEnabled: false,
      theme: 'light' as const,
      motionReduced: false
    }
    setTempSettings(defaultSettings)
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        disabled={isSessionActive}
        className="bg-white hover:bg-gray-50 border border-gray-300 rounded-lg p-2 shadow-lg transition-colors disabled:opacity-50"
        title="Session Settings"
      >
        <Settings className="w-5 h-5 text-gray-600" />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Session Settings</h2>
          
          {/* Cycles Target */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Cycles (1-8)
            </label>
            <input
              type="range"
              min="1"
              max="8"
              value={tempSettings.cyclesTarget}
              onChange={(e) => updateTempSetting('cyclesTarget', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>1</span>
              <span className="font-medium text-primary-600">{tempSettings.cyclesTarget}</span>
              <span>8</span>
            </div>
          </div>

          {/* Breaths Per Cycle */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Breaths Per Cycle (30-60)
            </label>
            <input
              type="range"
              min="30"
              max="60"
              step="5"
              value={tempSettings.breathsPerCycle}
              onChange={(e) => updateTempSetting('breathsPerCycle', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>30</span>
              <span className="font-medium text-primary-600">{tempSettings.breathsPerCycle}</span>
              <span>60</span>
            </div>
          </div>

          {/* Breathing Pace */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Breathing Pace
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {(Object.entries(DEFAULT_PACES) as [PaceType, any][]).map(([key, pace]) => (
                <button
                  key={key}
                  onClick={() => updateTempSetting('pace', pace)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    tempSettings.pace.label === pace.label
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">{pace.label}</div>
                  <div className="text-xs text-gray-500">
                    {pace.inhaleMs/1000}s in • {pace.exhaleMs/1000}s out
                  </div>
                </button>
              ))}
            </div>

            {/* Custom Pace Controls */}
            {tempSettings.pace.label === 'Custom' && (
              <div className="grid grid-cols-2 gap-4 p-3 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Inhale (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    value={tempSettings.pace.inhaleMs / 1000}
                    onChange={(e) => updateTempSetting('pace', {
                      ...tempSettings.pace,
                      inhaleMs: parseFloat(e.target.value) * 1000
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Exhale (seconds)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.5"
                    value={tempSettings.pace.exhaleMs / 1000}
                    onChange={(e) => updateTempSetting('pace', {
                      ...tempSettings.pace,
                      exhaleMs: parseFloat(e.target.value) * 1000
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Audio & Accessibility */}
          <div className="space-y-4 mb-6">
            <button
              onClick={() => updateTempSetting('audioEnabled', !tempSettings.audioEnabled)}
              className="flex items-center justify-between w-full p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <span className="font-medium">Audio Cues</span>
              <div className="flex items-center">
                {tempSettings.audioEnabled ? (
                  <Volume className="w-5 h-5 text-primary-500" />
                ) : (
                  <VolumeX className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>

            <button
              onClick={() => updateTempSetting('motionReduced', !tempSettings.motionReduced)}
              className="flex items-center justify-between w-full p-3 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <span className="font-medium">Reduce Motion</span>
              <div className="flex items-center">
                {tempSettings.motionReduced ? (
                  <EyeOff className="w-5 h-5 text-primary-500" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </div>
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={resetToDefaults}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Reset
            </button>
            <button
              onClick={applySettings}
              className="flex-1 bg-primary-500 hover:bg-primary-600 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}