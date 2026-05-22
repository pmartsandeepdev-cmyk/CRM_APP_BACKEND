import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
    },

    date: {
      type: String, 
      required: true,
    },

    // Punch In Details
    checkInTime: {
      type: String,
    },
    checkInLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    checkInSelfie: {
      type: String, // image URL
    },

    // Punch Out Details
    checkOutTime: {
      type: String,
    },
    checkOutLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    checkOutSelfie: {
      type: String,
    },

    // Working hours
    totalHours: {
      type: Number, // in hours (auto calculate)
      default: 0,
    },

    // Status
    status: {
      type: String,
      enum: ["Present", "Absent", "Half Day", "Leave"],
      default: "Present",
    },

    // Distance validation (optional)
    isWithinOfficeRange: {
      type: Boolean,
      default: false,
    },

    // Late mark
    isLate: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);


attendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);