import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});


export const analyzeEmergencySeverity = async ({
  emergencyType,
  description,
}) => {

  const prompt = `
You are an emergency severity analyzer.

Emergency Type:
${emergencyType}

Description:
${description}

Return ONLY JSON:

{
  "severity":"LOW|MEDIUM|HIGH|CRITICAL",
  "priorityScore":0,
  "recommendedServices":[],
  "reason":""
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text;

  return JSON.parse(text);
};



export const processVoiceSOS = async (transcript) => {

  const prompt = `
Extract emergency details.

Transcript:
${transcript}

Return ONLY JSON:

{
  "incidentType":"",
  "injuredCount":0,
  "medicalRequired":false,
  "locationHint":"",
  "summary":""
}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text;

  return JSON.parse(text);
};