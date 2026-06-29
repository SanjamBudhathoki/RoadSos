import express from "express";
import {
  getNearbyHospitals,
  getNearbyPolice,
  getNearbyAmbulance,
  getNearbyRescue,
  getNearbyAll,
} from "../controllers/nearByController.js";

// NOTE: intentionally public (no isUser) — in a real road accident,
// someone shouldn't need to be logged in to find the nearest hospital.
// If you'd rather gate it like your other routes, just import { isUser }
// from "../Middleware/authMiddleWare.js" and add it before each handler.

const nearbyRouter = express.Router();

nearbyRouter.get("/hospitals", getNearbyHospitals);
nearbyRouter.get("/police", getNearbyPolice);
nearbyRouter.get("/ambulance", getNearbyAmbulance);
nearbyRouter.get("/rescue", getNearbyRescue);
nearbyRouter.get("/all", getNearbyAll);

export default nearbyRouter;