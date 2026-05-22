import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { type } from "os";

const driverSchema = new mongoose.Schema(
  {
    
    driverName: {
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
      minlength: 6,
      select: false,
    },

    role: {
      type: String,
      enum: ["driver", "admin"],
      default: "driver",
    },
 carNumber: {
  type: Number,
  require: true
},
    profile: {
      firstName: String,
      lastName: String,
      phone: String,
      avatar: String,
    },

    vehicle: {
      type: {
        type: String,
      },
      brand: String,
      model: String,
      registrationNumber: {
        type: String,
        uppercase: true,
        trim: true,
      },
    },

    license: {
      number: {
        type: String,
        uppercase: true,
        trim: true,
      },
      category: String,
      verified: {
        type: Boolean,
        default: false,
      },
    },

    rc: {
      number: {
        type: String,
        uppercase: true,
        trim: true,
      },
      verified: {
        type: Boolean,
        default: false,
      },
    },

    otp: {
      type: String,
      select: false,
    },
    otpExpires: Date,

    refreshToken: {
      type: String,
      select: false,
    },

    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret.password;
        delete ret.refreshToken;
        delete ret.otp;
        return ret;
      },
    },
  }
);


// ✅ ONLY ONE PRE-SAVE HOOK (FIXED)
driverSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});


// ✅ PASSWORD CHECK
driverSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};


// ✅ ACCESS TOKEN
driverSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET || "access_secret",
    {
      expiresIn: "1d",
    }
  );
};


// ✅ REFRESH TOKEN
driverSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET || "refresh_secret",
    {
      expiresIn: "7d",
    }
  );
};


// ✅ OTP GENERATE
driverSchema.methods.generateOTP = function () {
  const otp = crypto.randomInt(100000, 999999).toString();

  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpires = Date.now() + 5 * 60 * 1000;

  return otp;
};


// ✅ OTP VERIFY
driverSchema.methods.verifyOTP = function (candidateOTP) {
  if (!this.otp || !this.otpExpires) return false;

  const hashed = crypto
    .createHash("sha256")
    .update(candidateOTP)
    .digest("hex");

  return this.otp === hashed && this.otpExpires > Date.now();
};


// ✅ CLEAR OTP
driverSchema.methods.clearOTP = function () {
  this.otp = undefined;
  this.otpExpires = undefined;
};


export const Driver = mongoose.model("Driver", driverSchema);