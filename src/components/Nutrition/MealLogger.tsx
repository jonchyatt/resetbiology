"use client"
import { Trash2, Utensils, Sun, Moon, Coffee } from "lucide-react"

export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack'

interface FoodEntryUI {
  id: string
  name: string
  serving: string
  time: string
  calories: number
  protein: number
  carbs: number
  fats: number
}

export function MealLogger({
  groups,
  onRemove,
}: {
  groups: Record<MealCategory, FoodEntryUI[]>
  onRemove: (id: string) => void
}) {
  const Section = ({ title, icon, items }: { title: string; icon: React.ReactNode; items: FoodEntryUI[] }) => (
    <div className="mb-6">
      <h4 className="text-white font-semibold mb-2 flex items-center gap-2">{icon}{title}</h4>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-gray-400 text-sm">Nothing logged.</p>}
        {items.map((food) => (
          <div key={food.id} className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/30">
            <div className="flex justify-between items-start">
              <div>
                <h5 className="font-medium text-white">{food.name}</h5>
                <p className="text-sm text-gray-300">{food.serving} • {food.time}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-medium">{food.calories} cal</p>
                <p className="text-xs text-gray-300">P: {food.protein}g • C: {food.carbs}g • F: {food.fats}g</p>
                <button 
                  onClick={() => onRemove(food.id)} 
                  className="mt-2 text-red-300 hover:text-red-200 text-xs flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3"/>Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <Section title="Breakfast" icon={<Coffee className="h-4 w-4 text-secondary-400"/>} items={groups.breakfast} />
      <Section title="Lunch" icon={<Sun className="h-4 w-4 text-secondary-400"/>} items={groups.lunch} />
      <Section title="Dinner" icon={<Moon className="h-4 w-4 text-secondary-400"/>} items={groups.dinner} />
      <Section title="Snacks" icon={<Utensils className="h-4 w-4 text-secondary-400"/>} items={groups.snack} />
    </div>
  )
}