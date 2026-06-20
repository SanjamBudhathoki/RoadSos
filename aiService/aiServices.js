import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});


export const analyzeEmergencySeverity = async ({
  emergencyType,
  description,
}) => {
  const prompt = `
You are a strict JSON generator.

RULES:
- Output MUST be valid JSON only
- No markdown
- No explanation

Schema:
{
  "severity":"LOW|MEDIUM|HIGH|CRITICAL",
  "priorityScore":number,
  "recommendedServices":string[],
  "reason":string
}

Emergency Type:
${emergencyType}

Description:
${description}
`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const text = response.text;

  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  const data = JSON.parse(cleaned);

  const allowed = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

  if (!allowed.includes(data.severity)) {
    throw new Error("AI returned invalid severity");
  }

  return data;
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

  const cleaned = text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(cleaned);
};

export const analyzeImageEmergency = async (
  file
) => {
  const imageBase64 =
    await file.arrayBuffer();

  const prompt = `
Analyze this emergency image.

Return ONLY JSON:

{
  "severity":"LOW|MEDIUM|HIGH|CRITICAL",
  "priorityScore":number,
  "recommendedServices":string[],
  "reason":string
}
`;

  const response =
    await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          text: prompt
        },
        {
          inlineData: {
            mimeType: file.mimetype,
            data: Buffer.from(
              imageBase64
            ).toString("base64")
          }
        }
      ]
    });

  const cleaned =
    response.text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

  return JSON.parse(cleaned);
};

