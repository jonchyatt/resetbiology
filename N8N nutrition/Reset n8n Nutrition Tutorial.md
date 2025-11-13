**n8n Nutrition Tutorial**

**Fast-track your AI skills. Join the community** → [skool.com/ai-space](http://skool.com/ai-space)

**—**  
**Premium Template:** 

**Free Template: [https://drive.google.com/file/d/1qSpz8e-QZG6a0GdVQOmaWwuNU2cRvVP5/view?usp=sharing](https://drive.google.com/file/d/1qSpz8e-QZG6a0GdVQOmaWwuNU2cRvVP5/view?usp=sharing)**

**Google Sheets Template:** [https://docs.google.com/spreadsheets/d/1X9hO5lU7Me-DYlv7VEirMijrf59aJNHsqgHYXGBoqTQ/edit?usp=sharing](https://docs.google.com/spreadsheets/d/1X9hO5lU7Me-DYlv7VEirMijrf59aJNHsqgHYXGBoqTQ/edit?usp=sharing)

**1\. Flow: Food Image Analysis**

**Message Type Rules**

```
Image:
{{ $json.messages[0].image }}

Text:
{{ $json.messages[0].text.body }}

Voice:
{{ $json.messages[0].audio }}
```

**Estimate Calories with AI**

Prompt

```
You are a professional nutrition analyst. Your goal is to Analyze this food photo for each visible item and output a structured JSON with clear calorie and macro estimates.

CORE FUNCTIONALITY
• When shown a food image, identify each item and its main components (protein, carb, fat, etc.)
•Assume a standard reference (e.g. 26 cm dinner plate, 250 ml cup, standard fork) for scale  
*  Note if it looks like a restaurant-prepared dish—if so, assume extra cooking fat: sauté or sauce fat up by ~1 Tbsp (14 g) per portion

* Estimate portion sizes in grams. Use reference cues in the image (cups, standard glass size, bread size, common utensils) to scale portions.
* Make assumptions realistic. Prefer common serving sizes.
• List any assumptions (shape, density, coverage %) you use to estimate size   
• Estimate calories & macros per item using trusted databases (USDA FoodData Central, European equivalents), adjusting for added restaurant fat
• Note visible cooking methods or add-ins (oil, sauce, butter)
• Calculate calories for each item, giving a plausible range
• Sum to a total calories range

JSON OUTPUT SCHEMA

{
  "overview": "Brief sentence about the full plate or spread",
  "short_name": "burger with fries",
  "items": [
    {
      "name": "Item name",
      "type": "protein | carb | fat | beverage | etc.",
      "portion_size": "e.g. 1 cup, 2 slices",
      "cooking_method": "if obvious",
      "macros_g": {
        "protein": 0,
        "carbs": 0,
        "fat": 0
      },
      "calories_kcal": {
        "low": 0,
        "high": 0
      },
      "assumptions": "Any guesses you made"
    }
  ],
  "total_calories_kcal": {
    "low": 0,
    "high": 0
  },
  "total_macros": {
      "proteins": {
        "low": 0,
        "high": 0
      },
      "carbs": {
        "low": 0,
        "high": 0
      },
      "fat": {
        "low": 0,
        "high": 0
      },
    },
  "notes": "Any limitations or “estimate may vary” warnings"
}

FOOD ANALYSIS GUIDELINES
• Start with “overview” for the whole meal
• For each item, fill every field in the schema
• Give calories as a low–high range
• Explain assumptions in the “assumptions” field
• If unsure or image is unclear, add warnings in “notes”
* If the user is writing Additional notes regarding the food, incorporate this (This is Voluntary):

{{ $('WhatsApp Trigger').item.json.messages[0].image.caption || ''}}
```

Model: GPT-4o-Mini

**Calories Mapping**

````
{{ JSON.parse(
  $json["content"]
    .replace(/```(?:json)?\s*/g, '')
    .replace(/```/g, '')
    .trim()
) }}

````

**Google Drive**

Name for file

```
{{ $('WhatsApp Trigger').item.json.contacts[0].profile.name }} {{ $now.format('yyyy-MM-dd HH:mm:ss') }}.png
```

**Image URL**

```
{{ $('Upload Image').item.json.webViewLink }}
```

**Add to Row**

Google sheets template: [https://docs.google.com/spreadsheets/d/1X9hO5lU7Me-DYlv7VEirMijrf59aJNHsqgHYXGBoqTQ/edit?usp=sharing](https://docs.google.com/spreadsheets/d/1X9hO5lU7Me-DYlv7VEirMijrf59aJNHsqgHYXGBoqTQ/edit?usp=sharing)

```
Date:
{{ $now.format('yyyy-MM-dd') }}

Time:
{{ $now.format('HH:mm:ss') }}

Client:
{{ $('WhatsApp Trigger').item.json.contacts[0].profile.name }}

Food:
{{ $json.text.short_name }}

Calories:
{{ ($json.text.total_calories_kcal.high + $json.text.total_calories_kcal.low) / 2 }}

Proteins:
{{ ($json.text.total_macros.proteins.high + $json.text.total_macros.proteins.low) / 2 }}

Carbs:
{{ ($json.text.total_macros.carbs.high + $json.text.total_macros.carbs.low) / 2  }}

Fat:
{{ ($json.text.total_macros.fat.high + $json.text.total_macros.fat.low) / 2 }}

Picture:
{{ $json['Generated Image Url'] }}
```

**Motivation Coach**

Prompt

```
Here are information about the food in the picture (you don't need the picture):

{{ JSON.stringify($('Merge').item.json.text) }}

Give a answer like the following to the user:

Calories: *1000 kcal*
Proteins: *50g*
Carbs: *100g*
Fat: *15g*

Meal: Burger with fries

Add max 2 short coach sentences (≤120 chars) in total!!!!
 • If it fits lose-fat/gain-muscle goals, praise and urge consistency
 • If it’s from a restaurant, comment if it is good for your goals or not and call out the hidden extras and urge cooking at home
 • If it’s unhealthy, be firm and remind me how to stay on track

Reference unhealthy-food warning:
• High in trans or saturated fats: avoid fried snacks, pastries & processed meats
• Excess added sugars: steer clear of candy, sodas & sweetened cereals
• Refined carbs: limit white bread, white rice & pastries
• High sodium: watch processed, canned & cured foods
• Low nutrient density: skip empty-calorie foods with little vitamins or fiber

 • The goal of the user is: {{ $json.Goal }}
 • Daily target goal:  {{ $json['Daily Goal [kcal]'] }} kcal
 • Daily deficit: {{ $json['Target Deficit [kcal]'] }} kcal
 • Maintain calorie: {{ $json['Maintain [kcal]'] }} kcal
```

AI Model: GPT-4o

—--------------------

**2\. Flow: Handle Text and Voice Requests**

**Text Request**

```
{{
  $('WhatsApp Trigger').item.json.messages 
    && $('WhatsApp Trigger').item.json.messages[0]?.text?.body 
      ? $('WhatsApp Trigger').item.json.messages[0].text.body 
      : $('Transcribe Audio').item.json.text
}}


```

**Nutrient Specialist**

Prompt

```
Analyze the food history from the last 7 days (or y days if fewer).
My name is {{ $('WhatsApp Trigger').item.json.contacts[0].profile.name }}
Request: {{ $('Edit Fields1').item.json['User Request'] }}
Today is {{ $now }}
My goal is {{ $json.Goal }}
Daily goal: {{ $json['Daily Goal [kcal]'] }} kcal


* In your answer write out numbers e.g. instead of 1000 you write one thousand and round off to the next 100.
If the requested item is a drink (cocktail, beer, etc.), calculate how many standard servings I can have until I hit my allowed calories.  
• If the requested item is a single-portion food (pizza, burger with fries, etc.), assume only one serving and tell me if I can have it or should skip it.  


* Sum calories consumed over the last seven days (including today)  
• Compute total allowed calories for those days (daily goal × days)  
• Subtract to find remaining “allowed calories”  
• Look up calories per one standard serving of the requested item  
• If it’s a drink, calculate max servings until allowed calories reaches zero; if it’s single-portion food, just compare one serving to allowed calories  

Output in simple language (sixth–eighth grade level), no more than one short sentence: You have so much calories left, so you can eat/drink (request) and maintain your last-y-day deficit.”

Or: You have so much calories left, so you can't eat/drink (request) and maintain your last-y-day deficit.

Here is my Meal history:

{{ JSON.stringify($('Aggregate').item.json.data, null, 2) }}
```

Model: o3-mini

**Text-To-Speech**

**cURL**

```
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/yl2ZDV1MzN4HbQJbMihG?output_format=mp3_44100_128" \
  -H "Content-Type: application/json" \
  -H "xi-api-key: YOUR_API_KEY" \
  -d '{
    "model_id": "eleven_multilingual_v2",
    "text": "{{ $json.output }}"
  }'

```

—  
**Filename**

Note: This is necessary because WhatsApp requires a filename.

```
$input.item.binary.data.fileName = 'response.mp3'

return $input.item;
```

