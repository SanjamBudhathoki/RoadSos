import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// --- REUSABLE SCHEMAS ---
const emergencySeveritySchema = {
  type: Type.OBJECT,
  properties: {
    severity: { type: Type.STRING },
    priorityScore: { type: Type.NUMBER },
    ambulanceRequired: { type: Type.BOOLEAN },
    policeRequired: { type: Type.BOOLEAN },
    fireRequired: { type: Type.BOOLEAN },
    towingRequired: { type: Type.BOOLEAN },
    recommendedServices: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    reason: { type: Type.STRING },
    safetyInstructions: { type: Type.STRING },
    estimatedResponseUrgency: { type: Type.STRING },
    potentialRiskFactors: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    }
  },
  required: [
    "severity", 
    "priorityScore", 
    "ambulanceRequired", 
    "policeRequired", 
    "fireRequired", 
    "towingRequired", 
    "recommendedServices", 
    "reason", 
    "safetyInstructions", 
    "estimatedResponseUrgency", 
    "potentialRiskFactors"
  ],
};

const voiceSosSchema = {
  type: Type.OBJECT,
  properties: {
    severity: { type: Type.STRING },
    priorityScore: { type: Type.NUMBER },
    incidentType: { type: Type.STRING },
    injuredCount: { type: Type.NUMBER },
    medicalRequired: { type: Type.BOOLEAN },
    ambulanceRequired: { type: Type.BOOLEAN },
    policeRequired: { type: Type.BOOLEAN },
    fireRequired: { type: Type.BOOLEAN },
    locationHint: { type: Type.STRING, nullable: true },
    summary: { type: Type.STRING },
    reason: { type: Type.STRING },
    recommendedServices: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    safetyInstructions: { type: Type.STRING }
  },
  required: [
    "severity", 
    "priorityScore", 
    "incidentType", 
    "injuredCount", 
    "medicalRequired", 
    "ambulanceRequired", 
    "policeRequired", 
    "fireRequired", 
    "summary", 
    "reason", 
    "recommendedServices", 
    "safetyInstructions"
  ],
};

const imageEmergencySchema = {
  type: Type.OBJECT,
  properties: {
    severity: { type: Type.STRING },
    priorityScore: { type: Type.NUMBER },
    recommendedServices: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING } 
    },
    reason: { type: Type.STRING }
  },
  required: ["severity", "priorityScore", "recommendedServices", "reason"]
};

// --- HELPER: Safe JSON parsing ---
const safeParseAIResponse = (text, fallbackData, context = "AI response") => {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn(`⚠️ Empty ${context}, using fallback`);
    return fallbackData;
  }

  try {
    // Try direct parse first
    return JSON.parse(text);
  } catch (directParseError) {
    console.warn(`⚠️ Direct parse failed for ${context}, attempting cleanup...`);
    
    try {
      // Clean the response and try again
      let cleaned = text
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
        .trim();
      
      // Extract JSON object if wrapped in text
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleaned = jsonMatch[0];
      }
      
      return JSON.parse(cleaned);
    } catch (cleanParseError) {
      console.error(`❌ All parsing attempts failed for ${context}:`, cleanParseError.message);
      console.error(`📄 Raw response:`, text.substring(0, 200));
      return fallbackData;
    }
  }
};

// --- VALIDATION HELPERS ---
const validateSeverity = (severity) => {
  const allowedSeverities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return allowedSeverities.includes(severity) ? severity : "MEDIUM";
};

const validatePriorityScore = (score) => {
  const numScore = Number(score);
  return Number.isFinite(numScore) ? Math.min(100, Math.max(1, numScore)) : 50;
};

// --- FALLBACK DATA ---
const getEmergencyFallback = (emergencyType = "GENERAL") => ({
  severity: "HIGH",
  priorityScore: 75,
  ambulanceRequired: true,
  policeRequired: true,
  fireRequired: false,
  towingRequired: true,
  recommendedServices: [emergencyType],
  reason: "Emergency triage fallback activated due to AI service unavailability.",
  safetyInstructions: "Stay clear of active roadways. Turn on hazard lights. Wait for emergency responders.",
  estimatedResponseUrgency: "urgent",
  potentialRiskFactors: ["AI service temporarily unavailable - using fallback assessment"]
});

const getVoiceFallback = () => ({
  severity: "HIGH",
  priorityScore: 80,
  incidentType: "GENERAL",
  injuredCount: 1,
  medicalRequired: true,
  ambulanceRequired: true,
  policeRequired: true,
  fireRequired: false,
  locationHint: null,
  summary: "Voice SOS fallback activated due to service interruption.",
  reason: "System automatically flagged voice dispatch as elevated priority.",
  recommendedServices: ["MEDICAL", "POLICE"],
  safetyInstructions: "Please remain calm. Help is being routed to your coordinates."
});

const getImageFallback = () => ({
  severity: "MEDIUM",
  priorityScore: 50,
  recommendedServices: ["TOWING"],
  reason: "Visual processing fallback implemented due to temporary service unavailability."
});

// --- CORE FUNCTIONS ---

export const analyzeEmergencySeverity = async ({
  emergencyType,
  description,
  imageAnalysisResult = null,
}) => {
  const prompt = `You are an emergency response AI system. Analyze this emergency with HIGH ACCURACY.

CRITICAL INDICATORS TO CHECK:
1. 🔴 LIFE THREAT: Cardiac arrest, severe bleeding, unconscious, not breathing
2. 🔴 FIRE/EXPLOSION: Visible flames, smoke, fuel leak, electrical fire
3. 🔴 ENTRAPMENT: Person trapped in vehicle, under debris, in water
4. 🔴 MASS CASUALTY: Multiple victims, bus accident, building collapse
5. 🟠 SERIOUS INJURY: Broken bones, head injury, heavy bleeding, burns
6. 🟠 ROAD HAZARD: Overturned vehicle, highway blockage, hazardous materials
7. 🟡 VEHICLE DAMAGE: Significant damage but no injuries, airbag deployed
8. 🟡 MEDICAL: Chest pain, difficulty breathing, allergic reaction
9. 🟢 MINOR: Flat tire, dead battery, locked out, minor fender bender
10. 🟢 INFORMATION: Non-emergency inquiry, test, false alarm

SEVERITY RULES:
- CRITICAL: Any life threat, fire, entrapment, or mass casualty → priorityScore 90-100
- HIGH: Serious injury, road hazard, multiple vehicles → priorityScore 70-89
- MEDIUM: Vehicle damage, medical non-life-threatening → priorityScore 40-69
- LOW: Minor issues, no injuries → priorityScore 10-39

Emergency Type: ${emergencyType}
Description: ${description}
${imageAnalysisResult ? `Image Analysis: ${JSON.stringify(imageAnalysisResult)}` : ''}

You MUST return a valid JSON object with all required fields.`;

  try {
    console.log("🤖 Analyzing emergency:", { emergencyType, description: description?.substring(0, 50) });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.1,
        maxOutputTokens: 1000,
        responseMimeType: "application/json",
        responseSchema: emergencySeveritySchema
      },
    });

    // ✅ Safe extraction of response text
    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text || response?.text || "";
    
    console.log("📥 AI Response received, length:", responseText.length);

    // Parse with fallback
    const fallback = getEmergencyFallback(emergencyType);
    const data = safeParseAIResponse(responseText, fallback, "emergency analysis");

    // Validate and sanitize
    data.severity = validateSeverity(data.severity);
    data.priorityScore = validatePriorityScore(data.priorityScore);
    
    if (!data.recommendedServices || data.recommendedServices.length === 0) {
      data.recommendedServices = [emergencyType];
    }
    
    if (!data.reason) {
      data.reason = `Emergency type: ${emergencyType}. Description: ${description?.substring(0, 100)}`;
    }

    console.log("✅ Analysis complete:", { severity: data.severity, priorityScore: data.priorityScore });
    return data;
    
  } catch (error) {
    console.error("❌ AI Generation error:", error.message);
    console.log("🔄 Returning safety fallback for emergency analysis");
    return getEmergencyFallback(emergencyType);
  }
};


export const processVoiceSOS = async (transcript) => {
  if (!transcript || transcript.trim().length === 0) {
    console.warn("⚠️ Empty transcript received");
    return getVoiceFallback();
  }

  const prompt = `You are an emergency response AI. Analyze the following voice transcript from a person in distress.

Transcript: "${transcript}"

Determine the severity based on these criteria:
- LOW: Minor issues, no immediate danger (flat tire, locked out)
- MEDIUM: Requires assistance but not life-threatening (car won't start, minor collision)
- HIGH: Potential injuries or dangerous situation (accident with injuries, fire risk)
- CRITICAL: Life-threatening emergency (severe injuries, fire, trapped victims)

You MUST return a valid JSON object with all required fields.`;

  try {
    console.log("🎤 Processing voice SOS:", transcript.substring(0, 50));
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
        responseSchema: voiceSosSchema
      }
    });

    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text || response?.text || "";
    
    console.log("📥 Voice AI Response received, length:", responseText.length);

    const fallback = getVoiceFallback();
    const data = safeParseAIResponse(responseText, fallback, "voice SOS");

    // Validate and sanitize
    data.severity = validateSeverity(data.severity);
    data.priorityScore = validatePriorityScore(data.priorityScore);
    
    if (!data.recommendedServices || data.recommendedServices.length === 0) {
      data.recommendedServices = data.medicalRequired ? ["MEDICAL"] : ["GENERAL"];
    }
    
    if (!data.summary) {
      data.summary = transcript.substring(0, 100);
    }

    console.log("✅ Voice analysis complete:", { 
      severity: data.severity, 
      priorityScore: data.priorityScore,
      incidentType: data.incidentType 
    });
    
    return data;
    
  } catch (error) {
    console.error("❌ Voice SOS error:", error.message);
    console.log("🔄 Returning safety fallback for voice SOS");
    return getVoiceFallback();
  }
};


export const analyzeImageEmergency = async (file) => {
  if (!file) {
    console.warn("⚠️ No file provided for image analysis");
    return getImageFallback();
  }

  try {
    console.log("📸 Analyzing emergency image:", file.originalname || 'uploaded image');
    
    const imageBase64 = await file.arrayBuffer();
    const prompt = `Analyze this emergency image carefully. Look for:
- Vehicle damage severity
- Visible injuries or blood
- Fire, smoke, or hazardous conditions
- Number of vehicles involved
- Trapped or injured persons
- Road hazards or dangerous conditions

Return a valid JSON object with severity, priority score, recommended services, and detailed reason.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { text: prompt },
        {
          inlineData: {
            mimeType: file.mimetype || 'image/jpeg',
            data: Buffer.from(imageBase64).toString("base64")
          }
        }
      ],
      config: {
        temperature: 0.1,
        maxOutputTokens: 800,
        responseMimeType: "application/json",
        responseSchema: imageEmergencySchema
      }
    });

    const responseText = response?.candidates?.[0]?.content?.parts?.[0]?.text || response?.text || "";
    
    console.log("📥 Image AI Response received, length:", responseText.length);

    const fallback = getImageFallback();
    const data = safeParseAIResponse(responseText, fallback, "image analysis");

    // Validate and sanitize
    data.severity = validateSeverity(data.severity);
    data.priorityScore = validatePriorityScore(data.priorityScore);
    
    if (!data.recommendedServices || data.recommendedServices.length === 0) {
      data.recommendedServices = ["TOWING"];
    }
    
    if (!data.reason) {
      data.reason = "Image analysis completed. See severity assessment for details.";
    }

    console.log("✅ Image analysis complete:", { 
      severity: data.severity, 
      priorityScore: data.priorityScore 
    });
    
    return data;
    
  } catch (error) {
    console.error("❌ Image analysis error:", error.message);
    console.log("🔄 Returning safety fallback for image analysis");
    return getImageFallback();
  }
};