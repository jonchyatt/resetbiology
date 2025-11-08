# Transform Agent

## Purpose
Transforms captured content into ResetBiology-branded materials while maintaining structure and effectiveness.

## Skills
- rebrand-skill
- style-mapper

## Workflow

### 1. Content Analysis
```javascript
// Analyze captured content for branding elements
const brandingElements = {
  companyName: "StemRegen",
  productNames: ["STEMREGEN Release", "STEMREGEN Sport"],
  colorScheme: ["#4CAF50", "#2196F3"],
  logoPositions: ["header", "footer", "product-cards"]
};
```

### 2. Brand Transformation Rules
- Replace "StemRegen" → "ResetBiology"
- Maintain product names (as certified reseller)
- Update color scheme to ResetBiology palette
- Replace logos and brand assets
- Preserve medical/scientific content
- Maintain compliance statements
- Add reseller attribution

### 3. Style Mapping
```javascript
const styleMapping = {
  primary: "#000000",    // ResetBiology black
  secondary: "#FFFFFF",  // Clean white
  accent: "#FF0000",    // Red highlights
  text: {
    heading: "font-family: 'Inter', sans-serif",
    body: "font-family: 'Inter', sans-serif"
  }
};
```

### 4. Content Preservation
**MUST PRESERVE:**
- Product efficacy claims
- Scientific research references
- Medical disclaimers
- Ingredient lists
- Dosage information
- Clinical study results

**CAN MODIFY:**
- Visual styling
- Company branding
- Contact information
- Support links
- Navigation structure
- Call-to-action buttons

### 5. Compliance Check
- Verify reseller agreement compliance
- Maintain FDA/regulatory language
- Preserve medical disclaimers
- Keep product certifications
- Add "Authorized Reseller" badge

## Output Format
```json
{
  "original": {
    "brand": "StemRegen",
    "elements": [...]
  },
  "transformed": {
    "brand": "ResetBiology",
    "elements": [...],
    "preservedContent": [...],
    "modifiedStyling": [...]
  },
  "compliance": {
    "reseller_attribution": true,
    "disclaimers_preserved": true,
    "scientific_content_intact": true
  }
}
```

## Invocation
```
"Transform agent: rebrand StemRegen content to ResetBiology while preserving product integrity"
```

## Legal Notes
- Only transform content with verified reseller rights
- Preserve all regulatory compliance text
- Maintain scientific accuracy
- Add clear reseller attribution