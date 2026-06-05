import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 40,
    unique: true,
    lowercase: true,
  },

  password: {
    type: String,
    required: true,
    trim: true,
  },
  phone: { 
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 10,
  },

  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 55,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 55,
  },
  address: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 55,
  },

  gender: {
    type: String,
    required: true,
    enum: ["male", "female", "preferNotToSay"],
  },
  role: {
    type: String,
    required: true,
    trim: true,
    enum:['driver', 'provider', 'admin'],
    default: 'driver'
  },
  isAvailable: {
     type: Boolean,
      default: false }, // for providers

  currentLocation: {
    type: { 
      type: String, 
      enum: ['Point'],
       default: 'Point' },
    coordinates: { 
      type: [Number],
       default: [0, 0] } // [longitude, latitude]
  }
}, { timestamps: true }
);



//  creates a geospatial index on the currentLocation field, which is required to perform proximity and range queries (such as $nearSphere or $geoNear) on that field.
userSchema.index({currentLocation:"2dsphere"});

export const User=mongoose.model("User",userSchema);

