const config = require('../config');

const MEDICAL_DISCLAIMER = '⚠️ Disclaimer: Not medical advice. This automated parsing is for organizational assistance only. Always consult a licensed physician or pharmacist before taking, changing, or scheduling medications.';

/**
 * Robust heuristic fallback parser when Gemini API key is missing or offline
 */
function parseMedicationHeuristic(text) {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // 1. Extract Dosage (e.g., 500mg, 10 mg, 25mcg, 5ml, 1 tablet)
  const dosageMatch = clean.match(/(\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|tablets?|capsules?|pills?))/i);
  const dosage = dosageMatch ? dosageMatch[1].replace(/\s+/, '') : '1 tablet';

  // 2. Extract Name (often preceding dosage or first word)
  let name = '';
  if (dosageMatch && dosageMatch.index > 0) {
    name = clean.substring(0, dosageMatch.index).trim();
  } else {
    const words = clean.split(/\s+/);
    name = words[0] || 'New Medication';
  }
  // Clean punctuation from name
  name = name.replace(/^[^\w]+|[^\w]+$/g, '');
  if (!name || name.length < 2) name = 'Prescribed Medication';
  // Capitalize first letter
  name = name.charAt(0).toUpperCase() + name.slice(1);

  // 3. Determine schedule times based on frequency keywords
  let scheduleTimes = ['08:00'];
  if (lower.includes('twice daily') || lower.includes('two times') || lower.includes('2 times') || lower.includes('bid')) {
    scheduleTimes = ['08:00', '20:00'];
  } else if (lower.includes('three times') || lower.includes('3 times') || lower.includes('tid')) {
    scheduleTimes = ['08:00', '13:00', '20:00'];
  } else if (lower.includes('four times') || lower.includes('4 times') || lower.includes('qid')) {
    scheduleTimes = ['08:00', '12:00', '16:00', '20:00'];
  } else if (lower.includes('bedtime') || lower.includes('at night') || lower.includes('before bed')) {
    scheduleTimes = ['21:00'];
  } else if (lower.includes('noon') || lower.includes('lunch')) {
    scheduleTimes = ['12:30'];
  } else if (lower.includes('evening') || lower.includes('dinner')) {
    scheduleTimes = ['18:30'];
  } else if (lower.includes('morning')) {
    // Check if specific hour mentioned like "8am"
    const hourMatch = lower.match(/(\d{1,2})\s*(?:am|pm)/);
    if (hourMatch) {
      let h = parseInt(hourMatch[1], 10);
      if (lower.includes('pm') && h < 12) h += 12;
      scheduleTimes = [`${String(h).padStart(2, '0')}:00`];
    } else {
      scheduleTimes = ['08:00'];
    }
  }

  // 4. Instructions
  let instructions = 'Take as prescribed';
  if (lower.includes('after meals') || lower.includes('after food')) {
    instructions = 'Take after meals with a glass of water';
  } else if (lower.includes('before meals') || lower.includes('before breakfast')) {
    instructions = 'Take 30 minutes before meals';
  } else if (lower.includes('with food') || lower.includes('with meals')) {
    instructions = 'Take with food or milk';
  } else if (lower.includes('empty stomach')) {
    instructions = 'Take on an empty stomach 1 hour before eating';
  } else if (lower.includes('bedtime')) {
    instructions = 'Take right before sleep with water';
  } else {
    instructions = `Take ${dosage} according to prescription`;
  }

  // 5. Days of week - default all days
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return {
    name,
    dosage,
    instructions,
    scheduleTimes,
    daysOfWeek,
    purpose: 'General health management'
  };
}

/**
 * Parse natural language prescription text using Gemini API
 */
async function parseMedicationPrompt(promptText) {
  if (!promptText || typeof promptText !== 'string' || promptText.trim().length === 0) {
    throw new Error('Prompt text is required');
  }

  const trimmed = promptText.trim();

  // If no Gemini API key configured, use the heuristic parser
  if (!config.geminiApiKey) {
    const parsed = parseMedicationHeuristic(trimmed);
    return {
      success: true,
      source: 'heuristic',
      medication: parsed,
      disclaimer: MEDICAL_DISCLAIMER
    };
  }

  try {
    const systemPrompt = `You are an expert clinical data parsing assistant for CareCircle, an elderly care management platform.
Your task is to parse informal or natural language medication instructions into a structured JSON object.
Return ONLY valid JSON matching this schema, with no markdown formatting or extra text:
{
  "name": "Medication Brand/Generic Name (e.g. Metformin)",
  "dosage": "Standard dose (e.g. 500mg, 10mg, 25mcg, 1 puff)",
  "instructions": "Patient-friendly instructions (e.g. Take twice daily after meals with water)",
  "purpose": "Condition treated (e.g. Type 2 Diabetes, Blood Pressure, or empty string if unknown)",
  "scheduleTimes": ["HH:MM", ...] in 24-hour format (e.g. ["08:00", "20:00"] for twice daily, ["08:00"] for morning, ["21:00"] for bedtime),
  "daysOfWeek": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] (include applicable days of the week, default all 7 unless specified)
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: `${systemPrompt}\n\nParse this medication instruction: "${trimmed}"` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[Gemini API] Failed with status ${response.status}: ${errText}. Falling back to heuristic.`);
      const fallback = parseMedicationHeuristic(trimmed);
      return {
        success: true,
        source: 'heuristic_fallback',
        medication: fallback,
        disclaimer: MEDICAL_DISCLAIMER
      };
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      throw new Error('Empty response from Gemini API');
    }

    // Parse JSON
    const parsedJson = JSON.parse(candidateText.trim());

    // Sanitize fields
    const sanitized = {
      name: parsedJson.name || 'Prescribed Medication',
      dosage: parsedJson.dosage || '1 dose',
      instructions: parsedJson.instructions || 'Take as directed',
      purpose: parsedJson.purpose || 'Health Maintenance',
      scheduleTimes: Array.isArray(parsedJson.scheduleTimes) && parsedJson.scheduleTimes.length > 0
        ? parsedJson.scheduleTimes
        : ['08:00'],
      daysOfWeek: Array.isArray(parsedJson.daysOfWeek) && parsedJson.daysOfWeek.length > 0
        ? parsedJson.daysOfWeek
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    };

    return {
      success: true,
      source: 'gemini',
      medication: sanitized,
      disclaimer: MEDICAL_DISCLAIMER
    };
  } catch (err) {
    console.warn(`[Gemini API] Error during request: ${err.message}. Falling back to heuristic.`);
    const fallback = parseMedicationHeuristic(trimmed);
    return {
      success: true,
      source: 'heuristic_fallback',
      medication: fallback,
      disclaimer: MEDICAL_DISCLAIMER
    };
  }
}

module.exports = {
  parseMedicationPrompt,
  parseMedicationHeuristic,
  MEDICAL_DISCLAIMER
};
