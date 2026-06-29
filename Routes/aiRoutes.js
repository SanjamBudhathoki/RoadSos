import express from "express";

import {
  analyzeEmergency,
  analyzeImage,
  chatAssistant,
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

router.post("/chat", isUser, chatAssistant);

export default router;