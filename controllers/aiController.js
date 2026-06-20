import asyncHandler from "../utils/asyncHandler.js";
import {
  analyzeEmergencySeverity,
  analyzeImageEmergency,
  processVoiceSOS,
} from "../aiService/aiServices.js";


// POST /ai/analyze-emergency
export const analyzeEmergency = asyncHandler(async (req, res) => {
  const { emergencyType, description } = req.body;

  if (!emergencyType || !description) {
    return res.status(400).json({
      success: false,
      message: "Emergency type and description are required",
    });
  }

  const result = await analyzeEmergencySeverity({
    emergencyType,
    description,
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});


// POST /ai/voice-sos
export const voiceSOS = asyncHandler(async (req, res) => {
  const { transcript } = req.body;

  if (!transcript || typeof transcript !== "string"|| !transcript.trim()) {
    return res.status(400).json({
      success: false,
      message: "A non-empty transcript string is required.",

    });
  }

  const result = await processVoiceSOS(transcript);

  res.status(200).json({
    success: true,
    data: result,
  });
});

export const analyzeImage = async (
  req,
  res
) => {
  try {
    const result =
      await analyzeImageEmergency(
        req.file
      );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};