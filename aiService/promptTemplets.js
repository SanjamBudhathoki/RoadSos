export const severityPrompt = (data) => `
You are an emergency triage specialist.

Emergency Type:
${data.emergencyType}

Description:
${data.description}

Return ONLY valid JSON:

{
 "severity":"LOW|MEDIUM|HIGH|CRITICAL",
 "priorityScore":1-100,
 "recommendedServices":[],
 "reason":""
}
`;