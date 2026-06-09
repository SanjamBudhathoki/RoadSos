import { ai } from "./geminiClient.js";
import { severityPrompt } from "./promptTemplates.js";

export const analyzeEmergency = async(data)=>{

 const response =
 await ai.models.generateContent({
   model:"gemini-2.5-flash",
   contents: severityPrompt(data)
 });

 return JSON.parse(response.text);
}