import { Driver } from "../model/driver.model.js" ;
// import { nanoid } from "nanoid";
// import mongoose from "mongoose";
import jwt from "jsonwebtoken";  


const generateAccessAndRefreshToken = async (driverId) => {
  try {
    const driver = await Driver.findById(driverId);
    const accessToken = await driver.generateAccessToken();
    const refreshToken = await driver.generateRefreshToken();

    return { accessToken, refreshToken };
  } catch (error) {
    throw new Error("Something went wrong while generating tokens");
  }
};

const loginDriver = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ⚠️ Must include password
    const driver = await Driver.findOne({ email }).select("+password");

    if (!driver) {
      return res.status(404).json({
        message: "Account not found",
        success: false,
      });
    }

    const isMatch = await driver.isPasswordCorrect(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid credentials",
        success: false,
      });
    }

    // Generate tokens using schema methods
    const accessToken = driver.generateAccessToken();
    const refreshToken = driver.generateRefreshToken();

    // Save refresh token
    driver.refreshToken = refreshToken;
    await driver.save({ validateBeforeSave: false });

    return res.status(200).json({
      message: "Login successful",
      success: true,
      accessToken,
      refreshToken,
      driver: {
        _id: driver._id,
        driverName: driver.driverName,
        email: driver.email,
        role: driver.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message,
      success: false,
    });
  }
};

const logoutDriver = async (req, res) => {
  try {
    await Driver.findByIdAndUpdate(
      req.driver._id,
      {
        $set: {
          refreshToken: null,
        },
      },
      { new: true }
    );

    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json({
        message: "Driver logged out successfully",
        success: true,
      });
  } catch (error) {
    return res.status(500).json({
      message: "Error while logging out",
      success: false,
    });
  }
};


export { loginDriver, logoutDriver, generateAccessAndRefreshToken };

