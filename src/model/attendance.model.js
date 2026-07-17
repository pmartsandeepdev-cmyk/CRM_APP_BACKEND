import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Driver",
      required: true,
      index: true,
    },
    date: {
      type: String,
      required: true,
      index: true,
    },
    checkInTime: { type: String },
    checkInLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    checkInSelfie: { type: String },
    checkOutTime: { type: String },
    checkOutLocation: {
      latitude: Number,
      longitude: Number,
      address: String,
    },
    checkOutSelfie: { type: String },
    totalHours: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Present", "Absent", "Half Day", "Leave"],
      default: "Present",
    },
    isWithinOfficeRange: { type: Boolean, default: false },
    isLate: { type: Boolean, default: false },
  },
  { timestamps: true }
);


export default mongoose.model("Attendance", attendanceSchema);