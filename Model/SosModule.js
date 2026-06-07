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
      enum: ['PENDING', 'ACCEPTED', 'ARRIVED', 'COMPLETED', 'CANCELLED'],
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
    statusHistory: [statusHistorySchema],
    resolvedAt: { type: Date, default: null }
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