import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const adminSchema = new Schema(
  {
    username: {
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
    password: {
      type: String,
      required: true,
    },
    changepasswordcode: {
      type: String,
      default: null,
    },
    adminType: {
      type: String,
      enum: ["Admin", "Superadmin", "Manager", "Hr"],
      required: true,
    },
    accessToken: { 
      type: String,
      default: null,
    },
    refreshToken: { 
      type: String,
      default: null,
    },
    massage: [
      {
        message: String,
        sender: String,
        receiver: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },       
        status: {
          type: String,
          enum: ['sent', 'delivered', 'read'],
          default: 'sent'
        },
        read: { 
          type: Boolean, 
          default: false 
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// NO PRE-SAVE MIDDLEWARE - We'll hash passwords manually in the controller

// Method to check if password is correct
adminSchema.methods.isPasswordCorrect = async function(password) {
  console.log("=== CHECKING PASSWORD ===");
  console.log("Input password:", password);
  console.log("Stored password (first 20 chars):", this.password?.substring(0, 20));
  console.log("Is stored password a bcrypt hash?", this.password?.startsWith('$2'));
  
  if (!this.password) {
    console.log("No password stored!");
    return false;
  }
  
  try {
    const result = await bcrypt.compare(password, this.password);
    console.log("Password comparison result:", result);
    return result;
  } catch (error) {
    console.error("Error comparing passwords:", error);
    return false;
  }
};

adminSchema.methods.generateAccessToken = function () {
  console.log("Generating access token for:", this.email);
  
  // Check if JWT secret exists
  if (!process.env.ACCESS_TOKEN_SECRET) {
    console.error("❌ ACCESS_TOKEN_SECRET is not defined in environment variables!");
    throw new Error("JWT secret not configured. Please check your .env file");
  }
  
  const payload = {
    _id: this._id,
    id: this._id,
    email: this.email,
    username: this.username,
    adminType: this.adminType,
  };
  
  console.log("Access token payload:", payload);
  console.log("Using ACCESS_TOKEN_SECRET:", process.env.ACCESS_TOKEN_SECRET.substring(0, 10) + "...");
  
  try {
    const token = jwt.sign(
      payload,
      process.env.ACCESS_TOKEN_SECRET,
      {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "1d",
      }
    );
    console.log("Access token generated successfully");
    return token;
  } catch (error) {
    console.error("Error generating access token:", error);
    throw error;
  }
};

adminSchema.methods.generateRefreshToken = function () {
  console.log("Generating refresh token for:", this.email);
  
  // Check if JWT secret exists
  if (!process.env.REFRESH_TOKEN_SECRET) {
    console.error("❌ REFRESH_TOKEN_SECRET is not defined in environment variables!");
    throw new Error("JWT secret not configured. Please check your .env file");
  }
  
  const payload = {
    _id: this._id,
    id: this._id,
  };
  
  console.log("Refresh token payload:", payload);
  console.log("Using REFRESH_TOKEN_SECRET:", process.env.REFRESH_TOKEN_SECRET.substring(0, 10) + "...");
  
  try {
    const token = jwt.sign(
      payload,
      process.env.REFRESH_TOKEN_SECRET,                   
      {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "10d",
      }
    );
    console.log("Refresh token generated successfully");
    return token;
  } catch (error) {
    console.error("Error generating refresh token:", error);
    throw error;
  }
};

export const Admin = mongoose.model("Admin", adminSchema);