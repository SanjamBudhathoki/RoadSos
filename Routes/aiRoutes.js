import express from "express";

import {
  analyzeEmergency,
  voiceSOS,
} from "../controllers/aiController.js";
import { isUser } from "../Middleware/authMiddleWare.js";

const router = express.Router();

router.post(
  "/analyze-emergency",//isUser,
  analyzeEmergency
);

router.post(
  "/voice-sos",
  voiceSOS
);

export default router;