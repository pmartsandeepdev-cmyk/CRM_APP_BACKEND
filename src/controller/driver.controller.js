import { Driver } from "../model/driver.model.js";
import mongoose from "mongoose";
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


 const createDriver = async (req, res) => {
  try {
    const { driverName, email, password, phone, vehicle, license, rc, carNumber } =
      req.body;

    if (!driverName || !email || !password) {
      return res.status(400).json({
        message: "Required fields missing",
        success: false,
      });
    }

    const exist = await Driver.findOne({ email });
    if (exist) {
      return res.status(400).json({
        message: "Driver already exists",
        success: false,
      });
    }

   const driver = await Driver.create({
  driverName,
  email,
  password,
  profile: { phone },

  vehicle,     // ✅ direct object
  license,     // ✅ direct object
  rc,          // ✅ direct object
  carNumber    // ✅ direct value
});

    res.status(201).json({
      message: "Driver created",
      data: driver,
      success: true,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error while creating driver",
      error: error.message,
      success: false,
    });
  }
};

const editDriver = async (req, res) => {
const { driverName, email, phone, vehicle, license, rc, _id } = req.body;
  
  try {
    if (!driverName || !email || !phone) {
      return res.status(400).json({
        message: "Name, email, and phone are required fields",
        success: false,
      });
    }

    const driver = await Driver.findByIdAndUpdate(
      _id,
      {
        $set: {
          name,
          email,
          phone,
          address,
          city,
          state,
          pincode
        }
      },
      { new: true }
    ).select("-password -refreshToken");

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
        success: false,
      });
    }

    return res.status(200).json({
      data: driver,
      message: "Driver updated successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error while editing driver",
      success: false,
    });
  }
};

const updatePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const id = req.driver?._id;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      message: "Both old and new passwords are required",
      success: false,
    });
  }
  
  try {
    const driver = await Driver.findById(id);
    if (!driver) {
      return res.status(400).json({
        message: "Invalid credentials",
        success: false,
      });
    }

    const isPasswordCorrect = await driver.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
      return res.status(400).json({
        message: "Wrong password",
        success: false,
      });
    }

    driver.password = newPassword;
    await driver.save({ validateBeforeSave: false });

    return res.status(200).json({
      message: "Password updated successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went   while updating password",
      success: false,
    });
  }
};


const getAllDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find().select("-password -refreshToken").sort({ createdAt: -1 });

    if (!drivers || drivers.length === 0) {
      return res.status(404).json({
        message: "No drivers found",
        success: false,
      });
    }

    // Get driver distribution by city
    const driverCities = await Driver.aggregate([
      {
        $group: {
          _id: "$city",
          value: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          name: "$_id",
          value: 1,
        },
      },
      {
        $sort: { value: -1 },
      },
    ]);
    
    return res.status(200).json({
      message: "All drivers fetched successfully",
      data: drivers,
      citiesSummary: driverCities,
      count: drivers.length,
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Something went wrong while fetching drivers",
      success: false,
    });
  }
};

const getDriverData = async (req, res) => {
  let id;
  if (req.body._id) {
    id = new mongoose.Types.ObjectId(req.body._id);
  } else if (req.driver?._id) {
    id = req.driver?._id;
  }
  
  try {
    const driver = await Driver.findById(id).select("-password -refreshToken");

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
        success: false,
      });
    }
    
    return res.status(200).json({
      data: driver,
      message: "Driver fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error while getting driver data",
      success: false,
    });
  }
};

const getCurrentDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.driver?._id).select("-password -refreshToken");

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
        success: false,
      });
    }
    
    return res.status(200).json({
      data: driver,
      message: "Current driver fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error while fetching current driver",
      success: false,
    });
  }
};

const deleteDriver = async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid driver ID format",
        success: false,
      });
    }

    const deletedDriver = await Driver.findByIdAndDelete(id);

    if (!deletedDriver) {
      return res.status(404).json({
        message: "Driver not found",
        success: false,
      });
    }
    
    return res.status(200).json({
      message: "Driver deleted successfully",
      success: true,
      data: deletedDriver
    });
  } catch (error) {
    console.error("Error deleting driver:", error);
    return res.status(500).json({
      message: "Error while deleting driver",
      success: false,
      error: error.message
    });
  }
};
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const sendPasswordResetEmail = async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({
      message: "Email is required",
      success: false,
    });
  }
  
  try {
    const driver = await Driver.findOne({ email });
    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
        success: false,
      });
    }
    
    // In a real implementation, you would send an email with a reset link
    // For now, we'll just generate an OTP and store it
    const resetToken = generateOTP();
    driver.resetPasswordToken = resetToken;
    driver.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await driver.save();

    // Here you would send the email with the reset token
    // await sendEmail(driver.email, "Password Reset", `Your OTP is: ${resetToken}`);
    
    return res.status(200).json({
      message: "Password reset email sent",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error sending password reset email",
      success: false,
    });
  }
};

const resetPassword = async (req, res) => {
  const { email, token, newPassword } = req.body;
  
  if (!email || !token || !newPassword) {
    return res.status(400).json({
      message: "Email, token, and new password are required",
      success: false,
    });
  }
  
  try {
    const driver = await Driver.findOne({
      email,
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!driver) {
      return res.status(400).json({
        message: "Invalid or expired token",
        success: false,
      });
    }
    
    driver.password = newPassword;
    driver.resetPasswordToken = undefined;
    driver.resetPasswordExpires = undefined;
    await driver.save();

    return res.status(200).json({
      message: "Password reset successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error resetting password",
      success: false,
    });
  }
};

const getDriverById = async (req, res) => {
  const { id } = req.params;
  
  try {
    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        message: "Invalid driver ID format",
        success: false,
      });
    }

    const driver = await Driver.findById(id).select("-password -refreshToken");

    if (!driver) {
      return res.status(404).json({
        message: "Driver not found",
        success: false,
      });
    }
    
    return res.status(200).json({
      data: driver,
      message: "Driver fetched successfully",
      success: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error while getting driver data",
      error: error.message,
      success: false,
    });
  }
};

export const getTotalDriversCount = async (req, res) => {
  try {
    const totalDrivers = await Driver.countDocuments(); // ✅ MongoDB se total driver count
    return res.status(200).json({
      success: true,
      totalDrivers, // number of drivers
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error fetching total drivers",
      error: error.message,
    });
  }
};

// ✅ GET DRIVER DASHBOARD STATS
const getDriverDashboardStats = async (req, res) => {
  try {
    const driverId = req.driver?._id;
    
    if (!driverId) {
      return res.status(400).json({
        message: "Driver ID is required",
        success: false,
      });
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get driver's orders count by status
    // Note: You'll need to adjust this based on your Order model
    const Order = mongoose.model("OrderDispatch") || mongoose.model("Order");
    
    const orderStats = await Order.aggregate([
      {
        $match: {
          "driver.driverId": new mongoose.Types.ObjectId(driverId)
        }
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Transform order stats
    const stats = {
      totalOrders: 0,
      assigned: 0,
      accepted: 0,
      inTransit: 0,
      delivered: 0
    };

    orderStats.forEach(stat => {
      stats.totalOrders += stat.count;
      if (stat._id === "assigned") stats.assigned = stat.count;
      if (stat._id === "Accepted") stats.accepted = stat.count;
      if (stat._id === "In Transit") stats.inTransit = stat.count;
      if (stat._id === "Delivered") stats.delivered = stat.count;
    });

    // Get today's orders
    const todaysOrders = await Order.countDocuments({
      "driver.driverId": new mongoose.Types.ObjectId(driverId),
      createdAt: { $gte: today, $lt: tomorrow }
    });

    return res.status(200).json({
      message: "Dashboard stats fetched successfully",
      success: true,
      data: {
        ...stats,
        todaysOrders,
        driverId: driverId.toString()
      }
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    return res.status(500).json({
      message: "Error fetching dashboard stats",
      error: error.message,
      success: false,
    });
  }
};


// Route

export {
  createDriver,
  editDriver,
  getDriverById,
  getCurrentDriver,
  updatePassword,
  getAllDrivers,
  getDriverData,
  deleteDriver,
  sendPasswordResetEmail,
  resetPassword,
 getDriverDashboardStats

};