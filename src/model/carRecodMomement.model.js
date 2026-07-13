import mongoose from "mongoose";

const carRecordSchema = new mongoose.Schema(
  {

    //  add this (Driver reference)
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
   
    },
     //  add this (Driver reference)
    staff: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
  
    },
    drivertrakinglocation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DriverLocation"
    },

    name: {
      type: String,

    },
  
    staffName: String,
    sector: String,
  
    // 🔹 Movement Purpose
    movementPurpose: {
      type: String,
      enum: ["movement", "petrol", "maintenance", "cng"],
      default: "movement",
    },

    // 🔹 Route Type (Start / End)
    startroute: {
      type: String,
  
    },

    endroute: {
      type: String,
    
    },
    
    startReading: {
      type: Number,
    },

    endReading: {
      type: Number,
    },

    totalKm: {
      type: Number,
    },

    // 🔹 Petrol
    petrol: {
      refillingReading: Number,
      amount: Number,
    },

    
    visit: {
      notes: String,
      closeReadingHome: Number,
    },

    // 🔹 Maintenance
    maintenance: {
      reading: Number,
      amount: Number,
      workDetails: String,
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
  { timestamps: true }
);

export const CarRecord = mongoose.model("CarRecord", carRecordSchema);