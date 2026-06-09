export const voicePrompt=(transcript)=>`
Extract emergency information.

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

export const processVoiceSOS=async(transcript)=>{

 const response=
 await ai.models.generateContent({
   model:"gemini-2.5-flash",
   contents: voicePrompt(transcript)
 });

 return JSON.parse(response.text);
}