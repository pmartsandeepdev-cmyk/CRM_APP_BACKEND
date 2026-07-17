import jwt from "jsonwebtoken";
import { Driver } from "../model/driver.model.js";

export const protectDriver = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      console.error("❌ No Authorization header found");
      return res.status(401).json({
        success: false,
        message: "No authorization token provided",
        details: "Authorization header is missing"
      });
    }

    // Check if Bearer token
    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      console.error("❌ Invalid Authorization format:", authHeader);
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format",
        details: "Use 'Bearer <token>' format"
      });
    }

    // Check if token exists
    if (!token || token === 'null' || token === 'undefined') {
      console.error("❌ Token is empty or null");
      return res.status(401).json({
        success: false,
        message: "Invalid token",
        details: "Token is empty or null"
      });
    }

    // Log token info (remove in production)
    console.log("📝 TOKEN:", token.substring(0, 20) + "...");
    console.log("🔑 SECRET exists:", !!process.env.ACCESS_TOKEN_SECRET);

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log("✅ DECODED:", decoded);

    // Find driver
    const driver = await Driver.findById(decoded.id);
    
    if (!driver) {
      console.error("❌ Driver not found for id:", decoded.id);
      return res.status(401).json({
        success: false,
        message: "Driver not found",
        details: "No driver exists with this token"
      });
    }

    // Attach driver to request
    req.driver = driver;
    req.driverId = driver._id;
    
    console.log(`✅ Authenticated driver: ${driver.driverName || driver.email}`);
    next();

  } catch (error) {
    console.error("❌ AUTH ERROR:", error.message);

    // Send more specific error messages
    let errorMessage = "Authentication failed";
    if (error.name === "JsonWebTokenError") {
      errorMessage = "Invalid token - " + error.message;
    } else if (error.name === "TokenExpiredError") {
      errorMessage = "Token has expired - Please login again";
    } else if (error.name === "NotBeforeError") {
      errorMessage = "Token not yet active";
    }

    return res.status(401).json({
      success: false,
      message: errorMessage,
      error: error.message,
      name: error.name
    });
  }
};


export const protectAdmin = async (req, res, next) => {
  try {
    let token;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        message: "No authorization token provided"
      });
    }

    if (authHeader.startsWith("Bearer ")) {
      token = authHeader.split(" ")[1];
    } else {
      return res.status(401).json({
        success: false,
        message: "Invalid authorization format"
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    // Find driver
    const driver = await Driver.findById(decoded.id);
    
    if (!driver) {
      return res.status(401).json({
        success: false,
        message: "User not found"
      });
    }

    // ✅ Check if user is ADMIN
    if (driver.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
        details: "You do not have admin privileges"
      });
    }

    req.driver = driver;
    req.driverId = driver._id;
    
    console.log(`✅ Admin authenticated: ${driver.driverName || driver.email}`);
    next();

  } catch (error) {
    console.error("❌ ADMIN AUTH ERROR:", error.message);
    return res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: error.message
    });
  }
};