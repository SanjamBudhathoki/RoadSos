import express from "express";
import { isProvider, isUser } from "../Middleware/authMiddleWare.js";
import { acceptSos, createSos, deleteSos, findNearbySos, getActiveMissions, getMySos, getSingleSos, updateSosStatus } from "../controllers/sosController.js";


const sosRouter = express.Router();
console.log("Sos Router Initialized")


// Find Nearby SOS Requests
sosRouter.get("/provider/nearby", isUser, findNearbySos);

// Create sos request
sosRouter.post("/create", isUser, createSos);


// get my request 
sosRouter.get("/my", isUser, getMySos);


// Get Single SOS
sosRouter.get("/:id", isUser, getSingleSos);


// Accept SOS (Provider)
sosRouter.put("/:id/accept", isUser,acceptSos);


// Update SOS Status
sosRouter.put("/:id/status", isUser, updateSosStatus);



// Delete SOS
sosRouter.delete("/delete/:id", isUser,deleteSos);

//! get active missions

sosRouter.get("/provider/active",isProvider,getActiveMissions)

export default sosRouter;