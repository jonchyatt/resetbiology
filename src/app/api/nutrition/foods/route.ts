import { NextResponse } from 'next/server'

// Food database with common foods and their macros
// Source: USDA FoodData Central standard portions
const FOOD_DATABASE = [
  // Proteins
  { id: '1', name: 'Chicken Breast (4oz)', calories: 187, protein: 35, carbs: 0, fats: 4, category: 'Protein' },
  { id: '2', name: 'Ground Beef 90/10 (4oz)', calories: 200, protein: 23, carbs: 0, fats: 11, category: 'Protein' },
  { id: '3', name: 'Salmon (4oz)', calories: 206, protein: 23, carbs: 0, fats: 12, category: 'Protein' },
  { id: '4', name: 'Eggs (2 large)', calories: 140, protein: 12, carbs: 1, fats: 10, category: 'Protein' },
  { id: '5', name: 'Greek Yogurt Plain (1 cup)', calories: 100, protein: 17, carbs: 6, fats: 0, category: 'Protein' },
  { id: '6', name: 'Cottage Cheese (1 cup)', calories: 220, protein: 28, carbs: 8, fats: 10, category: 'Protein' },
  { id: '7', name: 'Tuna (5oz can)', calories: 120, protein: 26, carbs: 0, fats: 1, category: 'Protein' },
  { id: '8', name: 'Whey Protein Scoop', calories: 120, protein: 25, carbs: 3, fats: 1, category: 'Protein' },
  { id: '9', name: 'Steak (6oz)', calories: 350, protein: 42, carbs: 0, fats: 20, category: 'Protein' },
  { id: '10', name: 'Turkey Breast (4oz)', calories: 153, protein: 34, carbs: 0, fats: 1, category: 'Protein' },

  // Carbs
  { id: '11', name: 'White Rice (1 cup cooked)', calories: 205, protein: 4, carbs: 45, fats: 0, category: 'Carbs' },
  { id: '12', name: 'Brown Rice (1 cup cooked)', calories: 218, protein: 5, carbs: 46, fats: 2, category: 'Carbs' },
  { id: '13', name: 'Sweet Potato (6oz)', calories: 150, protein: 2, carbs: 35, fats: 0, category: 'Carbs' },
  { id: '14', name: 'Oatmeal (1 cup cooked)', calories: 150, protein: 6, carbs: 27, fats: 3, category: 'Carbs' },
  { id: '15', name: 'Whole Wheat Bread (2 slices)', calories: 160, protein: 8, carbs: 28, fats: 2, category: 'Carbs' },
  { id: '16', name: 'Pasta (1 cup cooked)', calories: 200, protein: 7, carbs: 40, fats: 1, category: 'Carbs' },
  { id: '17', name: 'Quinoa (1 cup cooked)', calories: 222, protein: 8, carbs: 39, fats: 4, category: 'Carbs' },
  { id: '18', name: 'Banana', calories: 105, protein: 1, carbs: 27, fats: 0, category: 'Carbs' },
  { id: '19', name: 'Apple', calories: 95, protein: 0, carbs: 25, fats: 0, category: 'Carbs' },
  { id: '20', name: 'Blueberries (1 cup)', calories: 84, protein: 1, carbs: 21, fats: 0, category: 'Carbs' },

  // Fats
  { id: '21', name: 'Avocado (1 medium)', calories: 240, protein: 3, carbs: 12, fats: 22, category: 'Fats' },
  { id: '22', name: 'Almonds (1oz)', calories: 160, protein: 6, carbs: 6, fats: 14, category: 'Fats' },
  { id: '23', name: 'Peanut Butter (2 tbsp)', calories: 190, protein: 8, carbs: 7, fats: 16, category: 'Fats' },
  { id: '24', name: 'Olive Oil (1 tbsp)', calories: 120, protein: 0, carbs: 0, fats: 14, category: 'Fats' },
  { id: '25', name: 'Walnuts (1oz)', calories: 185, protein: 4, carbs: 4, fats: 18, category: 'Fats' },
  { id: '26', name: 'Cashews (1oz)', calories: 155, protein: 5, carbs: 9, fats: 12, category: 'Fats' },

  // Vegetables
  { id: '27', name: 'Broccoli (1 cup)', calories: 55, protein: 4, carbs: 11, fats: 0, category: 'Vegetables' },
  { id: '28', name: 'Spinach (2 cups raw)', calories: 14, protein: 2, carbs: 2, fats: 0, category: 'Vegetables' },
  { id: '29', name: 'Asparagus (1 cup)', calories: 27, protein: 3, carbs: 5, fats: 0, category: 'Vegetables' },
  { id: '30', name: 'Green Beans (1 cup)', calories: 44, protein: 2, carbs: 10, fats: 0, category: 'Vegetables' },

  // Common meals
  { id: '31', name: 'Protein Shake', calories: 250, protein: 40, carbs: 15, fats: 3, category: 'Supplements' },
  { id: '32', name: 'Chipotle Chicken Bowl', calories: 500, protein: 35, carbs: 50, fats: 15, category: 'Restaurant' },
  { id: '33', name: 'Chick-fil-A Grilled Chicken', calories: 320, protein: 38, carbs: 35, fats: 6, category: 'Restaurant' },
  { id: '34', name: 'Panera Chicken Caesar Salad', calories: 490, protein: 38, carbs: 16, fats: 31, category: 'Restaurant' },
]

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')?.toLowerCase()
  const category = searchParams.get('category')

  let results = FOOD_DATABASE

  // Filter by search query
  if (query) {
    results = results.filter(food =>
      food.name.toLowerCase().includes(query) ||
      food.category.toLowerCase().includes(query)
    )
  }

  // Filter by category
  if (category) {
    results = results.filter(food => food.category === category)
  }

  return NextResponse.json({
    success: true,
    foods: results,
    total: results.length
  })
}
