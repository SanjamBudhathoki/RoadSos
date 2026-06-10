import mongoose from "mongoose";

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String }
  },
  { timestamps: true, _id: false }
);

const sosSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Driver ID is required']
    },
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    emergencyType: {
      type: String,
      enum: ['MEDICAL', 'POLICE', 'TOWING', 'GENERAL'],
      required: [true, 'Emergency type is required']
    },
    status: {
      type: String,
      enum: [
  "PENDING",
  "ACCEPTED",
  "ON_THE_WAY",
  "ARRIVED",
  "RESOLVED",
  "CLOSED",
  "CANCELLED"
],
      default: 'PENDING'
    },
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], required: [true, 'Coordinates are required'] }
    },
    notes: {
      type: String,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
      default: ''
    },    
    // ── AI-enriched fields ──────────────────────────────────────────────────
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: null,
    },
    priorityScore: {
      type: Number,
      min: 1,
      max: 100,
      default: null,
    },
    recommendedServices: {
      type: [String],
      default: [],
    },
    aiAnalysis: {
      voice_text: { type: String, default: null },
      image_url: { type: String, default: null },
      detected_issue: { type: String, default: null },
      severity: { type: String, default: null },
      safety_instructions: { type: String, default: null },
      recommended_service: { type: String, default: null },
      confidence_score: { type: Number, default: null },
    },
    // ────────────────────────────────────────────────────────────────────────

    statusHistory: [statusHistorySchema],
    resolvedAt: { type: Date, default: null },
    // ────────────────────────────For RealTime tracking─────────────────────────────────────────
    assignedProvider: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User"
},

providerDistance: {
  type: Number,
  default: null
},

acceptedAt: Date,

onTheWayAt: Date,

arrivedAt: Date,

resolvedAt: Date,

closedAt: Date,

assignedDistance: Number,

estimatedArrivalTime: Number,

responseTimeSeconds: Number,

driverRating: {
  type: Number,
  min: 1,
  max: 5
},

providerRating: {
  type: Number,
  min: 1,
  max: 5
},

trackingActive: {
  type: Boolean,
  default: false
}
//===---------- auto accept sos request by provider

    
  },
  { timestamps: true }
);


sosSchema.index({ location: '2dsphere' });
sosSchema.index({ driverId: 1, status: 1 });
sosSchema.index({ providerId: 1, status: 1 });
sosSchema.index({ status: 1, createdAt: -1 });

// Auto-set resolvedAt when status is terminal
sosSchema.pre('save', function() {
  if (
    this.isModified('status') &&
    ['COMPLETED', 'CANCELLED'].includes(this.status) &&
    !this.resolvedAt
  ) {
    this.resolvedAt = new Date();
  }
  
  });

export const SosRequest= mongoose.model("SOSRequest",sosSchema)