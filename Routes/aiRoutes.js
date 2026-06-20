import express from "express";

import {
  analyzeEmergency,
  analyzeImage,
  voiceSOS,
} from "../controllers/aiController.js";
import { isUser } from "../Middleware/authMiddleWare.js";

const router = express.Router();

router.post(
  "/analyze-emergency",isUser,
  analyzeEmergency
);

router.post(
  "/voice-sos",isUser,
  voiceSOS
);

router.post(
  "/analyze-image",
  isUser,
  analyzeImage
);

export default router;