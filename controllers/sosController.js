import Joi from "joi";
import mongoose from "mongoose";
import { SosRequest } from "../Model/sosModule.js";
import { logger } from "../utils/logger.js";
import { User } from "../Model/userModule.js";

//* Create sos request
export const createSos= async (req, res) => {
  
  const input =req.body;
  
  const createSOSSchema=Joi.object({
  emergencyType: Joi.string()
    .valid("MEDICAL", "POLICE", "TOWING", "GENERAL")
    .required(),

  coordinates: Joi.array()
    .items(Joi.number())
    .length(2)
    .required(),

  notes: Joi.string().max(500).allow("")
});

  try {
    const { error } =await createSOSSchema.validateAsync(input);

    if (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    
    const sos = await SosRequest.create({
      driverId: req.loggedInUser._id,
      emergencyType:input.emergencyType,
      notes:input.notes || " ",
      location: {
        type: "Point",
        coordinates:input.coordinates
      },
      statusHistory: [
        {
          status: "PENDING",
          changedBy: req.loggedInUser._id,
          note: "SOS created"
        }
      ]
    });

    // Notify all connected clients of the new SOS
    const io = req.app.get("io");
    io.emit("sos:new", sos);

    return res.status(201).json({
      success: true,
      message: "SOS request created successfully",
      data: sos
    });

  } catch (error) {
    console.error(error);
    logger.error("createSos error", { error: error.message });
    return res.status(500).json({
      success: false,
      message: "Failed to create SOS request"
    });
  }
};

//* get my request 
export const getMySos=async (req, res) => {
  try {
    const requests = await SosRequest.find({
      driverId: req.loggedInUser._id,
    })
      .populate("providerId", "fullName phone")
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
      .populate("driverId", "fullName phone")
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
export const acceptSos=async (req, res) => {
  try {

    const sos = await SosRequest.findById(req.params.id);

    if (!sos) {
      return res.status(404).json({
        success: false,
        message: "SOS not found"
      });
    }

    if (sos.status !== "PENDING") {
      return res.status(400).json({
        success: false,
        message: "SOS already assigned"
      });
    }

    sos.providerId = req.loggedInUser._id;
    sos.status = "ACCEPTED";

    sos.statusHistory.push({
      status: "ACCEPTED",
      changedBy: req.loggedInUser._id,
      note: "Provider accepted request"
    });

    await sos.save();

    return res.status(200).json({
      success: true,
      message: "SOS accepted successfully",
      data: sos
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to accept SOS"
    });
  }
};


//* Update SOS Status
export const updateSosStatus=async (req, res) => {
  try {
    const input = req.body;

    const schema = Joi.object({
      status: Joi.string()
        .valid(
          "PENDING",
          "ACCEPTED",
          "ARRIVED",
          "COMPLETED",
          "CANCELLED"
        )
        .required(),

      notes: Joi.string().allow("")
    });

    // validation
    try {
      await schema.validateAsync(input);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.details[0].message
      });
    }

    // find SOS
    const sos = await SosRequest.findById(req.params.id);

    if (!sos) {
      return res.status(404).json({
        success: false,
        message: "SOS not found"
      });
    }

    // update status
    sos.status = input.status;

    sos.statusHistory.push({
      status: input.status,
      changedBy: req.loggedInUser._id,
      notes: input.notes
    });

    await sos.save();

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      data: sos
    });

  } catch (error) {
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

    if (!longitude || !latitude) {
      return res.status(400).json({
        success: false,
        message: "Latitude and longitude required"
      });
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
          $maxDistance: 10000
        }
      }
    });

    return res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });

  } catch (error) {

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

    if (!sos.driverId.equals(req.loggedInUser._id)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized"
      });
    }

    sos.status = "CANCELLED";

    sos.statusHistory.push({
      status: "CANCELLED",
      changedBy: req.loggedInUser._id,
      note: "Cancelled by driver"
    });

    await sos.save();

    return res.status(200).json({
      success: true,
      message: "SOS cancelled successfully"
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to cancel SOS"
    });
  }
};

//*

export const findNearestProviders = async (
  coordinates,
  maxDistance = 10000
) => {

  const providers = await User.find({
    role: "provider",
    availability: true,
    location: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates
        },
        $maxDistance: maxDistance
      }
    }
  });

  return providers;
};