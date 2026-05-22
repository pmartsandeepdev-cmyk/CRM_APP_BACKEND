import jwt from "jsonwebtoken";
import  {Admin}  from "../model/admin.model.js";
import { Driver } from '../model/driver.model.js';

export const verifyJWT = async (req, res, next) => {
  try {
    const token = req.cookies?.accessToken || 
                  req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized request - No token provided"
      });
    }
    
    const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    // ✅ FIX: Check BOTH Admin and Driver collections
    let user = null;
    let userType = null;
    
    // Try to find as Admin first
    user = await Admin.findById(decodedToken?._id || decodedToken?.id)
      .select("-password -refreshToken");
    
    if (user) {
      userType = 'admin';
    } else {
      // If not admin, try as Driver
      user = await Driver.findById(decodedToken?._id || decodedToken?.id)
        .select("-password -refreshToken");
      if (user) {
        userType = 'driver';
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid Access Token - User not found"
      });
    }

    // Attach the user and type to the request object
    req.user = user;
    req.userType = userType;
    
    // For backward compatibility, also set req.driver if it's a driver
    if (userType === 'driver') {
      req.driver = user;
    }
    
    next();
    
  } catch (error) {
    console.error("JWT Verification Error:", error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        expired: true
      });
    }
    
    return res.status(401).json({
      success: false,
      message: error?.message || "Invalid access token"
    });
  }
}; 

export const authenticate = async (req, res, next) => {
  try {
    // 1. Get token from cookies or Authorization header
    const token = req.cookies?.accessToken || 
                 req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized access - No token provided"
      });
    }

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);

    // 3. Find driver (without password and refreshToken)
    const driver = await Driver.findById(decoded.id).select('-password -refreshToken -otp');

    if (!driver) {
      return res.status(401).json({
        success: false,
        message: "Invalid access token - Driver not found"
      });
    }

    // 4. Check if driver is locked
    if (driver.isLocked) {
      return res.status(403).json({
        success: false,
        message: "Account temporarily locked due to multiple failed attempts"
      });
    }

    // 5. Check if email is verified (if you require email verification)
    if (!driver.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first"
      });
    }

    // 6. Attach driver to request object
    req.driver = driver;
    next();

  } catch (error) {
    // Handle different JWT errors specifically
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: "Invalid token"
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: "Token expired",
        shouldRefresh: true
      });
    }

    return res.status(401).json({
      success: false,
      message: error.message || "Authentication failed"
    });
  }
};

// Middleware for role-based access control
export const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.driver.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden - ${req.driver.role} role not authorized`
      });
    }
    next();
  };
};

// Middleware to check if OTP is required
export const checkOTPRequirement = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    // In a real app, you might check user preferences or security settings here
    // For this example, we'll assume OTP is always required for non-admin logins

    const driver = await Driver.findOne({ email });
    if (!driver) return next(); // Will be caught in the actual login flow

    if (driver.role !== 'admin') {
      return res.status(202).json({
        success: true,
        requiresOTP: true,
        message: "OTP required for login"
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};