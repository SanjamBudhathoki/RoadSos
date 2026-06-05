import mongoose from "mongoose";

const sosSchema= new mongoose.schema({
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },  // GeoJSON type
    coordinates: { type: [Number], required: true }  // [longitude, latitude]
  },
  status: { type: String, enum: ['pending', 'accepted', 'en_route', 'completed'], default: 'pending' },
  aiAnalysis: {
    voice_text: String,
    image_url: String,
    detected_issue: String,
    severity: String,
    safety_instructions: String,
    recommended_service: String,
    confidence_score: Number
  }
}, { timestamps: true });

sosSchema.index({location:"2dspher"})

export const SosRequest= mongoose.model("SOSRequest",sosSchema)