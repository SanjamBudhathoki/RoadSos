import asyncHandler from "../utils/asyncHandler.js";
import {
  analyzeEmergencySeverity,
  analyzeImageEmergency,
  processVoiceSOS,
} from "../aiService/aiServices.js";
import {v2 as cloudinary} from "cloudinary"
import fs from "fs/promises"

// Configure Cloudinary (add to your .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});


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



export const analyzeImage = asyncHandler(async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    //  Upload image to cloud storage (Cloudinary)
    let imageUrl = null;
    let imagePublicId = null;
    
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'roadsos/emergencies',
        resource_type: 'auto',
      });
      imageUrl = result.secure_url;
      imagePublicId = result.public_id;
      
      // Clean up local file after upload
      await fs.unlink(req.file.path).catch(() => {});
    } catch (uploadError) {
      console.error('Cloudinary upload failed:', uploadError);
      // Fallback: use local path if cloud upload fails
      imageUrl = `/uploads/${req.file.filename}`;
    }

    // Analyze the image with AI
    const analysisResult = await analyzeImageEmergency(req.file);

    //  Return both image URL and analysis
    res.status(200).json({
      success: true,
      data: {
        ...analysisResult,
        imageUrl,           // Include image URL
        imagePublicId,      // Include public ID for deletion
      },
    });
  } catch (error) {
    console.error('Image analysis error:', error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to analyze image",
    });
  }
});