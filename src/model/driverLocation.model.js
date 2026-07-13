// model/driverLocation.model.js
import mongoose from "mongoose";

const driverLocationSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },

    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CarRecord",
      required: true,
      index: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    address: {
      type: String,
      default: "",
    },

    speed: {
      type: Number,
      default: 0,
    },

    heading: {
      type: Number,
      default: 0,
    },

    accuracy: {
      type: Number,
      default: 0,
    },

    battery: {
      type: Number,
      default: 0,
    },

    // ============ NEW FIELDS ============
    isActive: {
      type: Boolean,
      default: true,
    },

    locationTimestamp: {
      type: Date,
      default: Date.now,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
  }
);

// Compound index for faster queries
driverLocationSchema.index({ driver: 1, trip: 1, createdAt: -1 });

export const DriverLocation = mongoose.model(
  "DriverLocation",
  driverLocationSchema
);