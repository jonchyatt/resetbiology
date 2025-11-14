"use client";

import { useState } from "react";
import { Pill, X, Clock, Plus, Minus } from "lucide-react";

interface QuickAddOralMedProps {
  onClose: () => void;
  onAdd: (medData: {
    peptideName: string;
    dosage: string;
    frequency: string;
    timing: string;
    administrationType: string;
  }) => Promise<void>;
}

export function QuickAddOralMed({ onClose, onAdd }: QuickAddOralMedProps) {
  const [medicationName, setMedicationName] = useState("");
  const [dosageAmount, setDosageAmount] = useState("");
  const [dosageUnit, setDosageUnit] = useState("capsules");
  const [frequency, setFrequency] = useState("daily");
  const [times, setTimes] = useState<string[]>(["08:00"]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addTimeSlot = () => {
    if (times.length < 4) {
      setTimes([...times, "12:00"]);
    }
  };

  const removeTimeSlot = (index: number) => {
    setTimes(times.filter((_, i) => i !== index));
  };

  const updateTime = (index: number, value: string) => {
    const newTimes = [...times];
    newTimes[index] = value;
    setTimes(newTimes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onAdd({
        peptideName: medicationName,
        dosage: `${dosageAmount} ${dosageUnit}`,
        frequency,
        timing: times.join("/"),
        administrationType: "oral",
      });
      onClose();
    } catch (error) {
      console.error("Error adding oral medication:", error);
      alert("Failed to add medication. Please try again.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 rounded-lg">
              <Pill className="w-6 h-6 text-teal-400" />
            </div>
            <h2 className="text-xl font-bold text-white">
              Add Oral Medication
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Medication Name */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Medication Name
            </label>
            <input
              type="text"
              value={medicationName}
              onChange={(e) => setMedicationName(e.target.value)}
              placeholder="e.g., StemRegen, EnergyBits"
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              required
            />
          </div>

          {/* Dosage */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Dosage
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={dosageAmount}
                onChange={(e) => setDosageAmount(e.target.value)}
                placeholder="2"
                className="w-24 bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                required
              />
              <select
                value={dosageUnit}
                onChange={(e) => setDosageUnit(e.target.value)}
                className="flex-1 bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="capsules">capsules</option>
                <option value="tablets">tablets</option>
                <option value="pills">pills</option>
                <option value="scoops">scoops</option>
                <option value="ml">ml</option>
                <option value="drops">drops</option>
              </select>
            </div>
          </div>

          {/* Frequency */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full bg-gray-700 text-white px-4 py-3 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
            >
              <option value="daily">Daily</option>
              <option value="every other day">Every Other Day</option>
              <option value="3x per week">3x Per Week</option>
              <option value="weekly">Weekly</option>
              <option value="as needed">As Needed</option>
            </select>
          </div>

          {/* Times */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2">
              Times Per Day
            </label>
            <div className="space-y-2">
              {times.map((time, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-teal-400 flex-shrink-0" />
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => updateTime(index, e.target.value)}
                    className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none"
                  />
                  {times.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTimeSlot(index)}
                      className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}

              {times.length < 4 && (
                <button
                  type="button"
                  onClick={addTimeSlot}
                  className="flex items-center gap-2 text-teal-400 hover:text-teal-300 text-sm font-medium transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Time
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 bg-teal-500 hover:bg-teal-600 disabled:bg-gray-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors"
            >
              {isSubmitting ? "Adding..." : "Add Medication"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
