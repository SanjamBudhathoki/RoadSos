import Joi from "joi";
import mongoose from "mongoose";
import { SosRequest } from "../Model/sosModule.js";
import { logger } from "../utils/logger.js";
import { User } from "../Model/userModule.js";
import { analyzeEmergencySeverity } from "../aiService/aiServices.js";



//* Create sos request
export const createSos = async (req, res) => {
  const input = req.body;

  // Extract image data from request
  const { imageUrl, imagePublicId, aiAnalysisResult } = input;

  // If the frontend already ran AI analysis (e.g. image-analysis flow), use it.
  // Otherwise use a safe, instant default — NEVER block the response on a live AI call.
  const aiResult = aiAnalysisResult || null;
  const needsBackgroundAnalysis = !aiResult;

  const createSOSSchema = Joi.object({
    emergencyType: Joi.string()
      .valid("MEDICAL", "POLICE", "TOWING", "GENERAL")
      .required(),

    coordinates: Joi.array().items(Joi.number()).length(2).required(),

    notes: Joi.string().max(500).allow(""),
    imageUrl: Joi.string().uri().allow("", null),
    imagePublicId: Joi.string().allow("", null),
    aiAnalysisResult: Joi.object().allow(null),
  });

  try {
    await createSOSSchema.validateAsync(input);

    const sos = await SosRequest.create({
      userId: req.loggedInUser._id,
      emergencyType: input.emergencyType,
      notes: input.notes || "",
      location: {
        type: "Point",
        coordinates: input.coordinates,
      },
      severity: aiResult?.severity || "MEDIUM",
      priorityScore: aiResult?.priorityScore || 50,
      recommendedServices: aiResult?.recommendedServices || [],
      aiAnalysis: {
        voice_text: input.notes || null,
        image_url: imageUrl || null,
        image_public_id: imagePublicId || null,
        detected_issue: aiResult?.reason || "AI analysis pending...",
        severity: aiResult?.severity || "MEDIUM",
        recommended_service: aiResult?.recommendedServices?.join(", ") || "",
        confidence_score: aiResult?.confidence || 0.5,
        safety_instructions: aiResult?.safetyInstructions || null,
        analysisPending: needsBackgroundAnalysis,
      },
      statusHistory: [
        {
          status: "PENDING",
          changedBy: req.loggedInUser._id,
          note: "SOS created",
        },
      ],
    });

    const io = req.app.get("io");

    // 🤖 AUTO-DISPATCH: find nearest available provider (fast indexed geo query, fine to await)
    const providers = await findNearestProviders(input.coordinates, 10000);
    let autoDispatched = false;

    if (providers.length > 0) {
      const nearestProvider = providers[0]; // closest one

      sos.providerId = nearestProvider._id;
      sos.status = "ACCEPTED";
      sos.acceptedAt = new Date();
      sos.statusHistory.push({
        status: "ACCEPTED",
        changedBy: nearestProvider._id,
        note: "Auto-dispatched by AI",
      });
      await sos.save();

      await User.findByIdAndUpdate(nearestProvider._id, { isAvailable: false });

      io.to(`provider:${nearestProvider._id}`).emit("sos:auto-dispatched", {
        sosId: sos._id,
        sos,
        message: "You have been auto-dispatched to an emergency",
      });

      io.to(`user:${sos.userId}`).emit("sos:accepted", {
        sosId: sos._id,
        providerId: nearestProvider._id,
        autoDispatched: true,
      });

      autoDispatched = true;
      logger.info("Auto-dispatched SOS", {
        sosId: sos._id,
        providerId: nearestProvider._id,
      });
    } else {
      io.emit("sos:new", sos);
      logger.info("No nearby provider — broadcasting for manual accept", {
        sosId: sos._id,
      });
    }

    // ✅ RESPOND IMMEDIATELY. Everything below this line happens in the
    // background AFTER the client already has its answer — it can no
    // longer cause a timeout or a duplicate-trigger risk.
    res.status(201).json({
      success: true,
      message: autoDispatched
        ? "SOS created and auto-dispatched to nearest provider"
        : "SOS created — waiting for provider",
      data: sos,
      autoDispatched,
    });

    // 🤖 Run the slow Gemini call in the background only if the frontend
    // hadn't already supplied a result. Update the doc + notify the user
    // over the socket once it resolves — never blocks the HTTP response.
    if (needsBackgroundAnalysis) {
      analyzeEmergencySeverity({
        emergencyType: input.emergencyType,
        description: input.notes || "",
      })
        .then(async (result) => {
          sos.severity = result.severity;
          sos.priorityScore = result.priorityScore;
          sos.recommendedServices = result.recommendedServices || sos.recommendedServices;
          sos.aiAnalysis.detected_issue = result.reason;
          sos.aiAnalysis.severity = result.severity;
          sos.aiAnalysis.recommended_service = (result.recommendedServices || []).join(", ");
          sos.aiAnalysis.confidence_score = result.confidence || 0.9;
          sos.aiAnalysis.safety_instructions = result.safetyInstructions;
          sos.aiAnalysis.analysisPending = false;
          await sos.save();

          io.to(`user:${sos.userId}`).emit("sos:analysis-ready", {
            sosId: sos._id,
            severity: result.severity,
            priorityScore: result.priorityScore,
            reason: result.reason,
            safetyInstructions: result.safetyInstructions,
            recommendedServices: result.recommendedServices,
          });

          logger.info("Background AI analysis complete", { sosId: sos._id });
        })
        .catch((error) => {
          console.error("Background AI analysis error:", error.message);
          logger.error("Background AI analysis failed", { sosId: sos._id, error: error.message });
        });
    }
  } catch (error) {
    console.error(error);
    logger.error("createSos error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to create SOS request",
    });
  }
};



//* get my request 
export const getMySos=async (req, res) => {
  try {
    const requests = await SosRequest.find({
      userId: req.loggedInUser._id,
    })
      .populate("providerId", "firstName lastName phone")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests,
    });

  } catch (error) {
    logger.error("getMySos error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to fetch SOS requests",
    });
  }
};


//* Get Single SOS
export const getSingleSos=async (req, res) => {
  try {

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid SOS ID"
      });
    }

    const sos = await SosRequest.findById(req.params.id)
      .populate("userId", "fullName phone")
      .populate("providerId", "fullName phone");

    if (!sos) {
      return res.status(404).json({
        success: false,
        message: "SOS request not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: sos
    });

  } catch (error) {
    logger.error("getSingleSos error", { error: error.message });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch SOS request"
    });
  }
};


//* Accept SOS (Provider)
export const acceptSos = async (req, res) => {
  try {
    // Atomic: only matches if still PENDING, so this single query both
    // claims the SOS and prevents two providers racing to accept it.
    const sos = await SosRequest.findOneAndUpdate(
      {
        _id: req.params.id,
        status: "PENDING",
      },
      {
        providerId: req.loggedInUser._id,
        status: "ACCEPTED",
        acceptedAt: new Date(),
        $push: {
          statusHistory: {
            status: "ACCEPTED",
            changedBy: req.loggedInUser._id,
            note: "Provider accepted request",
          },
        },
      },
      { new: true }
    );

    // If no document matched, it either doesn't exist or someone else
    // already accepted it first (status was no longer PENDING).
    if (!sos) {
      return res.status(404).json({
        success: false,
        message: "SOS request no longer available.",
      });
    }

    await User.findByIdAndUpdate(req.loggedInUser._id, {
      isAvailable: false,
    });

    // Notify the user's room
    const io = req.app.get("io");
    io.to(`user:${sos.userId}`).emit("sos:accepted", {
      sosId: sos._id,
      providerId: sos.providerId,
    });

    return res.status(200).json({
      success: true,
      message: "SOS accepted successfully",
      data: sos,
    });
  } catch (error) {
    logger.error("acceptSos error", { error: error.message });

    return res.status(500).json({
      success: false,
      message: "Failed to accept SOS",
    });
  }
};


//* Update SOS Status
export const updateSosStatus = async (req, res) => {
  try {
    const input = req.body;

    const schema = Joi.object({
      status: Joi.string()
        .valid(
          "PENDING",
          "ACCEPTED",
          "ARRIVED",
          "ON_THE_WAY",
          "RESOLVED",
          "CANCELLED"
        )
        .required(),
      note: Joi.string().allow("")
    });

    await schema.validateAsync(input);

    // 1. FIND SOS FIRST (IMPORTANT FIX)
    const sos = await SosRequest.findById(req.params.id);

    if (!sos) {
      return res.status(404).json({
        success: false,
        message: "SOS not found"
      });
    }

    // 2. NOW safe to use sos.status
    const allowedTransitions = {
      PENDING: ["ACCEPTED", "CANCELLED"],
      ACCEPTED: ["ON_THE_WAY"],
      ON_THE_WAY: ["ARRIVED"],
      ARRIVED: ["RESOLVED"],
      RESOLVED: ["CLOSED"]
    };

    const allowed = allowedTransitions[sos.status] || [];

    if (!allowed.includes(input.status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status transition"
      });
    }

    // update status
    sos.status = input.status;

    sos.statusHistory.push({
      status: input.status,
      changedBy: req.loggedInUser._id,
      note: input.note || ""
    });

    if (input.status === "ON_THE_WAY") sos.onTheWayAt = new Date();
    if (input.status === "ARRIVED") sos.arrivedAt = new Date();
    if (input.status === "RESOLVED") sos.resolvedAt = new Date();
    if (input.status === "CLOSED") sos.closedAt = new Date();

    if (input.status === "RESOLVED" || input.status === "CLOSED") {
      await User.findByIdAndUpdate(sos.providerId, {
        isAvailable: true
      });
    }

    await sos.save();

    const io = req.app.get("io");
    io.emit("sos:statusUpdated", {
      sosId: sos._id,
      status: sos.status
    });

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: sos
    });

  } catch (error) {
    logger.error("updateSosStatus error", { error: error.message });

    return res.status(500).json({
      success: false,
      message: "Failed to update status"
    });
  }
};


//* Find Nearby SOS Requests
export const findNearbySos=async  (req, res) => {
  try {

    const { longitude, latitude } = req.query;

    const nearbyQuerySchema = Joi.object({
  longitude: Joi.number().required(),
  latitude: Joi.number().required(),
  maxDistance: Joi.number().positive().default(10000),
});
  try {
    await nearbyQuerySchema.validateAsync(req.query);
  } catch (error) {
      return res.status(400).json({ success: false, message: error.details[0].message }); 
  }

    const requests = await SosRequest.find({
      status: "PENDING",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [
              Number(longitude),
              Number(latitude)
            ]
          },
          $maxDistance: 10000 // 1KM
        }
      }
    }).populate("userId", "firstName lastName phone");


    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });

  } catch (error) {
    logger.error("findNearbySos error", { error: error.message });

    return res.status(500).json({
      success: false,
      message: "Failed to find nearby SOS requests"
    });
  }
};


//* Delete SOS
export const deleteSos=async (req, res) => {
  try {

    const sos = await SosRequest.findById(req.params.id);

    if (!sos) {
      return res.status(404).json({
        success: false,
        message: "SOS not found"
      });
    }

    if (!sos.userId.equals(req.loggedInUser._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized To Cancle This SOS Request"
      });
    }
    
    if (["COMPLETED", "CANCELLED"].includes(sos.status)) {
      return res.status(409).json({ success: false, message: "SOS is already in a terminal state." });
    }

    sos.status = "CANCELLED";

    sos.statusHistory.push({
      status: "CANCELLED",
      changedBy: req.loggedInUser._id,
      note: "Cancelled by user"
    });

    await sos.save();

    return res.status(200).json({
      success: true,
      message: "SOS cancelled successfully"
    });

  } catch (error) {
    logger.error("deleteSos error", { error: error.message });

    return res.status(500).json({
      success: false,
      message: "Failed to cancel SOS"
    });
  }
};

//* Find nearest provider
export const findNearestProviders = async (coordinates, maxDistance = 10000) => {
  return User.find({
    role: "provider",
    isAvailable: true,
    currentLocation: {
      $near: {
        $geometry: { type: "Point", coordinates },
        $maxDistance: maxDistance,
      },
    },
  });
};

//! get active mission

export const getActiveMissions=async (req,res) => {
  try {
    const providerId=req.loggedInUser.id;
    
      const activeMission =
      await SosRequest.findOne({
        providerId,
        status: {
          $in: [
            'ACCEPTED',
            'IN_PROGRESS',
          ],
        },
      })
        .populate(
          'userId',
          'name phone'
        )
        .sort({
          updatedAt: -1,
        });
            return res.status(200).json({
      success: true,
      data: activeMission,
    });


  } catch (error) {
        console.error(error);

    return res.status(500).json({
      success: false,
      message:
        'Failed to fetch active mission',
    });
    
  }  
}
