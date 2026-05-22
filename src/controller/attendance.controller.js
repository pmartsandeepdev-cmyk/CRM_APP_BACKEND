import Attendance from "../model/attendance.model.js";
import { Driver } from "../model/driver.model.js";
import { Admin } from "../model/admin.model.js";
import mongoose from "mongoose";

// Helper function to calculate total hours
const calculateTotalHours = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) return 0;
  
  const [inHour, inMinute] = checkInTime.split(":").map(Number);
  const [outHour, outMinute] = checkOutTime.split(":").map(Number);
  
  let totalMinutes = (outHour * 60 + outMinute) - (inHour * 60 + inMinute);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  
  return parseFloat((totalMinutes / 60).toFixed(2));
};

// Helper function to check if driver is late
const checkIsLate = (checkInTime, officeStartTime = "09:00") => {
  if (!checkInTime) return false;
  return checkInTime > officeStartTime;
};

// Helper function to determine status
const determineStatus = (totalHours, expectedHours = 8) => {
  if (totalHours === 0) return "Absent";
  if (totalHours < expectedHours / 2) return "Half Day";
  return "Present";
};

// Helper to get userId from request (works with different auth methods)
const getUserIdFromRequest = (req) => {
  // For verifyJWT middleware
  if (req.user && req.user._id) return req.user._id;
  // For protectDriver or authenticate middleware
  if (req.driver && req.driver._id) return req.driver._id;
  // Fallback
  return null;
};

// Helper to check if user is admin
const isAdminUser = (req) => {
  // For verifyJWT middleware
  if (req.userType === 'admin') return true;
  // For other middlewares, check role
  if (req.driver && req.driver.role === 'admin') return true;
  if (req.user && req.user.role === 'admin') return true;
  return false;
};

// @desc    Punch In
// @route   POST /api/attendance/punch-in
// @access  Private (Drivers only)
export const punchIn = async (req, res) => {
  try {
    const driverId = getUserIdFromRequest(req);
    const isAdmin = isAdminUser(req);
    
    // Only drivers can punch in/out (admins cannot)
    if (isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot perform punch in/out operations",
      });
    }

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { checkInTime, checkInLocation, checkInSelfie, officeRange } = req.body;
    const today = new Date().toISOString().split("T")[0];

    if (!checkInTime) {
      return res.status(400).json({
        success: false,
        message: "Check-in time is required",
      });
    }

    // Check if attendance already exists for today
    let attendance = await Attendance.findOne({ driverId, date: today });

    if (attendance && attendance.checkInTime) {
      return res.status(400).json({
        success: false,
        message: "Already punched in for today",
      });
    }

    const isLate = checkIsLate(checkInTime, "09:00");
    const isWithinOfficeRange = officeRange || false;

    if (!attendance) {
      attendance = new Attendance({
        driverId,
        date: today,
        checkInTime,
        checkInLocation,
        checkInSelfie,
        isLate,
        isWithinOfficeRange,
        status: "Present",
      });
    } else {
      attendance.checkInTime = checkInTime;
      attendance.checkInLocation = checkInLocation;
      attendance.checkInSelfie = checkInSelfie;
      attendance.isLate = isLate;
      attendance.isWithinOfficeRange = isWithinOfficeRange;
    }

    await attendance.save();

    res.status(201).json({
      success: true,
      message: "Punched in successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Punch In Error:", error);
    res.status(500).json({
      success: false,
      message: "Error during punch in",
      error: error.message,
    });
  }
};

// @desc    Punch Out
// @route   POST /api/attendance/punch-out
// @access  Private (Drivers only)
export const punchOut = async (req, res) => {
  try {
    const driverId = getdriverIdFromRequest(req);
    const isAdmin = isAdminUser(req);
    
    if (isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot perform punch out operations",
      });
    }

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { checkOutTime, checkOutLocation, checkOutSelfie } = req.body;
    const today = new Date().toISOString().split("T")[0];

    if (!checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "Check-out time is required",
      });
    }

    const attendance = await Attendance.findOne({ driverId, date: today });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "No attendance record found. Please punch in first.",
      });
    }

    if (!attendance.checkInTime) {
      return res.status(400).json({
        success: false,
        message: "Please punch in first before punching out",
      });
    }

    if (attendance.checkOutTime) {
      return res.status(400).json({
        success: false,
        message: "Already punched out for today",
      });
    }

    const totalHours = calculateTotalHours(attendance.checkInTime, checkOutTime);
    const status = determineStatus(totalHours);

    attendance.checkOutTime = checkOutTime;
    attendance.checkOutLocation = checkOutLocation;
    attendance.checkOutSelfie = checkOutSelfie;
    attendance.totalHours = totalHours;
    attendance.status = status;

    await attendance.save();

    res.status(200).json({
      success: true,
      message: "Punched out successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Punch Out Error:", error);
    res.status(500).json({
      success: false,
      message: "Error during punch out",
      error: error.message,
    });
  }
};

// @desc    Get my attendance records
// @route   GET /api/attendance/my-attendance
// @access  Private (Drivers only)
export const getMyAttendance = async (req, res) => {
  try {
    const driverId = getdriverIdFromRequest(req);
    const isAdmin = isAdminUser(req);
    
    if (isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot access this route. Use admin endpoints instead.",
      });
    }

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { startDate, endDate, status, page = 1, limit = 10 } = req.query;

    let query = { driverId };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    } else if (endDate) {
      query.date = { $lte: endDate };
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Attendance.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get My Attendance Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance",
      error: error.message,
    });
  }
};

// @desc    Get today's status
// @route   GET /api/attendance/my-today-status
// @access  Private (Drivers only)
export const getTodayStatus = async (req, res) => {
  try {
    const driverId = getdriverIdFromRequest(req);
    const isAdmin = isAdminUser(req);
    
    if (isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot access this route",
      });
    }

    if (!driverId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const attendance = await Attendance.findOne({ driverId, date: today });

    if (!attendance) {
      return res.status(200).json({
        success: true,
        data: {
          isPunchedIn: false,
          isPunchedOut: false,
          message: "Not punched in yet today",
        },
      });
    }

    res.status(200).json({
      success: true,
      data: {
        isPunchedIn: !!attendance.checkInTime,
        isPunchedOut: !!attendance.checkOutTime,
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime,
        checkInLocation: attendance.checkInLocation,
        checkOutLocation: attendance.checkOutLocation,
        totalHours: attendance.totalHours,
        isLate: attendance.isLate,
        status: attendance.status,
      },
    });
  } catch (error) {
    console.error("Get Today Status Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching today's status",
      error: error.message,
    });
  }
};

// ==================== ADMIN ONLY CONTROLLERS ====================

// @desc    Get attendance by ID (Admin only)
// @route   GET /api/attendance/:id
// @access  Private/Admin
export const getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate("driverId", "name email phone")
      .lean();

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.status(200).json({
      success: true,
      data: attendance,
    });
  } catch (error) {
    console.error("Get Attendance By ID Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance",
      error: error.message,
    });
  }
};

// @desc    Get driver attendance (Admin only)
// @route   GET /api/attendance/driver/:userId
// @access  Private/Admin
export const getDriverAttendance = async (req, res) => {
  try {
    const { driverId } = req.params;
    const { startDate, endDate, status, page = 1, limit = 10 } = req.query;

    let query = { driverId: new mongoose.Types.ObjectId(driverId) };

    if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else if (startDate) {
      query.date = { $gte: startDate };
    } else if (endDate) {
      query.date = { $lte: endDate };
    }

    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("driverId", "name email phone")
        .lean(),
      Attendance.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get Driver Attendance Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching driver attendance",
      error: error.message,
    });
  }
};

// @desc    Today's summary (Admin only)
// @route   GET /api/attendance/summary/today
// @access  Private/Admin
export const getTodaySummary = async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    const [totalPresent, totalAbsent, totalLate, totalHalfDay] = await Promise.all([
      Attendance.countDocuments({ date: today, status: "Present" }),
      Attendance.countDocuments({ date: today, status: "Absent" }),
      Attendance.countDocuments({ date: today, isLate: true }),
      Attendance.countDocuments({ date: today, status: "Half Day" }),
    ]);

    const allRecords = await Attendance.find({ date: today })
      .populate("driverId", "name email phone")
      .lean();

    const totalDrivers = await Driver.countDocuments({ isActive: true });

    res.status(200).json({
      success: true,
      data: {
        date: today,
        summary: {
          totalDrivers,
          totalPresent,
          totalAbsent,
          totalLate,
          totalHalfDay,
          attendancePercentage: totalDrivers > 0 ? ((totalPresent / totalDrivers) * 100).toFixed(2) : 0,
        },
        records: allRecords,
      },
    });
  } catch (error) {
    console.error("Get Today Summary Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching today's summary",
      error: error.message,
    });
  }
};

// @desc    Attendance by date range (Admin only)
// @route   GET /api/attendance/range
// @access  Private/Admin
export const getAttendanceByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, status, driverId, page = 1, limit = 20 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Please provide startDate and endDate",
      });
    }

    let query = { date: { $gte: startDate, $lte: endDate } };

    if (status) {
      query.status = status;
    }

    if (driverId) {
      query.driverId = new mongoose.Types.ObjectId(driverId);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [attendance, total] = await Promise.all([
      Attendance.find(query)
        .populate("driverId", "name email phone")
        .sort({ date: -1, driverId: 1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Attendance.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: attendance,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Get Attendance By Date Range Error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching attendance by date range",
      error: error.message,
    });
  }
};

// @desc    Update attendance (Admin only)
// @route   PUT /api/attendance/:id
// @access  Private/Admin
export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (updates.checkInTime || updates.checkOutTime) {
      const attendance = await Attendance.findById(id);
      if (attendance) {
        const checkIn = updates.checkInTime || attendance.checkInTime;
        const checkOut = updates.checkOutTime || attendance.checkOutTime;
        if (checkIn && checkOut) {
          updates.totalHours = calculateTotalHours(checkIn, checkOut);
          updates.status = determineStatus(updates.totalHours);
        }
      }
    }

    if (updates.checkInTime) {
      updates.isLate = checkIsLate(updates.checkInTime);
    }

    const attendance = await Attendance.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    ).populate("driverId", "name email");

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      data: attendance,
    });
  } catch (error) {
    console.error("Update Attendance Error:", error);
    res.status(500).json({
      success: false,
      message: "Error updating attendance",
      error: error.message,
    });
  }
};

// @desc    Delete attendance (Admin only)
// @route   DELETE /api/attendance/:id
// @access  Private/Admin
export const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: "Attendance record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Attendance record deleted successfully",
    });
  } catch (error) {
    console.error("Delete Attendance Error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting attendance",
      error: error.message,
    });
  }
};

// @desc    Monthly report (Admin only)
// @route   GET /api/attendance/report/monthly
// @access  Private/Admin
export const getMonthlyReport = async (req, res) => {
  try {
    const { year, month, driverId } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Please provide year and month",
      });
    }

    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0).toISOString().split("T")[0];

    let query = {
      date: { $gte: startDate, $lte: endDate },
    };

    if (driverId) {
      query.driverId = new mongoose.Types.ObjectId(driverId);
    }

    const attendance = await Attendance.find(query)
      .populate("driverId", "name email phone")
      .sort({ date: 1 })
      .lean();

    const stats = {
      totalDays: attendance.length,
      present: attendance.filter(a => a.status === "Present").length,
      absent: attendance.filter(a => a.status === "Absent").length,
      halfDay: attendance.filter(a => a.status === "Half Day").length,
      late: attendance.filter(a => a.isLate).length,
      totalHours: attendance.reduce((sum, a) => sum + a.totalHours, 0).toFixed(2),
    };

    let driverDetails = null;
    if (driverId) {
      driverDetails = await Driver.findById(driverId).select("name email phone");
    }

    res.status(200).json({
      success: true,
      data: {
        year,
        month,
        driver: driverDetails,
        statistics: stats,
        records: attendance,
      },
    });
  } catch (error) {
    console.error("Get Monthly Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating monthly report",
      error: error.message,
    });
  }
};