// model/carRecodMomement.model.js
import mongoose from "mongoose";

const carRecordSchema = new mongoose.Schema(
  {
    // ================= DRIVER =================
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },

    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
    },

    drivertrakinglocation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DriverLocation",
    },

    // ================= VEHICLE =================
    carNumber: {
      type: String,
    },

    name: {
      type: String,
    },

    // ================= STAFF =================
    staffName: {
      type: String,
    },

    sector: {
      type: String,
    },

    // ================= MOVEMENT =================
    movementPurpose: {
      type: String,
      enum: ["movement", "petrol", "maintenance", "cng", "visit"],
      default: "movement",
    },

    startroute: {
      type: String,
    },

    endroute: {
      type: String,
    },

    // ================= METER =================
    startReading: {
      type: Number,
    },

    endReading: {
      type: Number,
    },

    startkm: {
      type: Number,
    },

    endkm: {
      type: Number,
    },

    totalKm: {
      type: Number,
      default: 0,
    },

    // ================= TRIP STATUS =================
    tripStatus: {
      type: String,
      enum: ["active", "completed"],
      default: "active",
      index: true,
    },

    startTime: {
      type: Date,
      default: Date.now,
    },

    endTime: {
      type: Date,
    },

    totalDuration: {
      type: Number,
      default: 0,
    },

    // ================= PETROL =================
    petrol: {
      refillingReading: Number,
      amount: Number,
      endReading: Number,
      images: [String],
      completedAt: Date,
    },

    // ================= VISIT =================
    visit: {
      notes: String,
      closeReadingHome: Number,
      completedAt: Date,
    },

    // ================= MAINTENANCE =================
    maintenance: {
      reading: Number,
      amount: Number,
      workDetails: String,
      images: [String],
      completedAt: Date,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },

    date: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Fast query for active trip of driver
carRecordSchema.index({
  driver: 1,
  tripStatus: 1,
});

export const CarRecord = mongoose.model("CarRecord", carRecordSchema);