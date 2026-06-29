import Joi from "joi";
import { findNearby } from "../aiService/nearByServices.js";
import { logger } from "../utils/logger.js";

const querySchema = Joi.object({
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().positive().max(50000).default(5000),
});

const buildHandler = (type) => async (req, res) => {
  const { error, value } = querySchema.validate(req.query);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  try {
    const data = await findNearby({ type, ...value });
    return res.status(200).json({ success: true, type, count: data.length, data });
  } catch (err) {
    logger.error(`getNearby:${type} error`, { error: err.message });
    // Degrade gracefully — empty list, not a hard failure, so the UI stays usable.
    return res.status(200).json({
      success: false,
      type,
      count: 0,
      data: [],
      message: "Couldn't reach map data right now. Please try again in a moment.",
    });
  }
};

export const getNearbyHospitals = buildHandler("hospital");
export const getNearbyPolice = buildHandler("police");
export const getNearbyAmbulance = buildHandler("ambulance");
export const getNearbyRescue = buildHandler("rescue");

export const getNearbyAll = async (req, res) => {
  const { error, value } = querySchema.validate(req.query);
  if (error) {
    return res.status(400).json({ success: false, message: error.details[0].message });
  }

  const types = ["hospital", "police", "ambulance", "rescue"];
  const settled = await Promise.allSettled(
    types.map((type) => findNearby({ type, ...value }))
  );

  const data = {};
  types.forEach((type, i) => {
    data[type] = settled[i].status === "fulfilled" ? settled[i].value : [];
  });

  return res.status(200).json({ success: true, data });
};