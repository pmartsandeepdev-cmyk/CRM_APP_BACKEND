import mongoose from "mongoose";

const staffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["admin", "manager", "employee", "staff"],
      default: "staff",
    },

  },
  {
    timestamps: true, 
  }
);

export default mongoose.model("Staff", staffSchema);