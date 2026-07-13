// controller/attendance.controller.js
import Attendance from "../model/attendance.model.js";
import { Driver } from "../model/driver.model.js";
import { Admin } from "../model/admin.model.js";
import mongoose from "mongoose";

// ============ HELPER FUNCTIONS ============

const calculateTotalHours = (checkInTime, checkOutTime) => {
  if (!checkInTime || !checkOutTime) return 0;

  const [inHour, inMinute] = checkInTime.split(":").map(Number);
  const [outHour, outMinute] = checkOutTime.split(":").map(Number);

  let totalMinutes = outHour * 60 + outMinute - (inHour * 60 + inMinute);
  if (totalMinutes < 0) totalMinutes += 24 * 60;

  return parseFloat((totalMinutes / 60).toFixed(2));
};

const checkIsLate = (checkInTime, officeStartTime = "09:00") => {
  if (!checkInTime) return false;
  return checkInTime > officeStartTime;
};

const determineStatus = (totalHours, expectedHours = 8) => {
  if (totalHours === 0) return "Absent";
  if (totalHours < expectedHours / 2) return "Half Day";
  return "Present";
};

const getUserIdFromRequest = (req) => {
  if (req.user && req.user._id) return req.user._id;
  if (req.driver && req.driver._id) return req.driver._id;
  if (req.admin && req.admin._id) return req.admin._id;
  return null;
};

const isAdminUser = (req) => {
  if (req.userType === "admin") return true;
  if (req.admin) return true;
  if (req.driver && req.driver.role === "admin") return true;
  if (req.user && req.user.role === "admin") return true;
  return false;
};

// ============ DRIVER CONTROLLERS ============

// @desc    Punch In
// @route   POST /api/attendance/punch-in
export const punchIn = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const isAdmin = isAdminUser(req);

    if (isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot perform punch in/out operations",
      });
    }

    if (!userId) {
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

    let attendance = await Attendance.findOne({ driverId: userId, date: today });

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
        driverId: userId,
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
export const punchOut = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const isAdmin = isAdminUser(req);

    if (isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot perform punch out operations",
      });
    }

    if (!userId) {
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

    const attendance = await Attendance.findOne({ driverId: userId, date: today });

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
export const getMyAttendance = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const isAdmin = isAdminUser(req);

    if (isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot access this route. Use admin endpoints instead.",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { startDate, endDate, status, page = 1, limit = 10 } = req.query;

    let query = { driverId: userId };

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
export const getTodayStatus = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);
    const isAdmin = isAdminUser(req);

    if (isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admins cannot access this route",
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const attendance = await Attendance.findOne({ driverId: userId, date: today });

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

// @desc    Get my monthly attendance report
// @route   GET /api/attendance/my-monthly-report
export const getMyMonthlyReport = async (req, res) => {
  try {
    const userId = getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { year, month } = req.query;

    // Validation
    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Please provide year and month (e.g., year=2026&month=07)",
      });
    }

    // Month ka start aur end date
    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split("T")[0];

    console.log(`Fetching attendance for: ${startDate} to ${endDate}`);

    // Attendance records fetch karo
    const attendanceRecords = await Attendance.find({
      driverId: userId,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    console.log(`Found ${attendanceRecords.length} records`);

    // Statistics calculate karo
    const totalDays = attendanceRecords.length;
    const present = attendanceRecords.filter((a) => a.status === "Present").length;
    const absent = attendanceRecords.filter((a) => a.status === "Absent").length;
    const halfDay = attendanceRecords.filter((a) => a.status === "Half Day").length;
    const late = attendanceRecords.filter((a) => a.isLate === true).length;
    const totalHours = attendanceRecords.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    // Total working days in month
    const totalWorkingDays = new Date(year, parseInt(month), 0).getDate();
    const attendedDays = present + halfDay;
    const attendancePercentage = totalWorkingDays > 0 
      ? ((attendedDays / totalWorkingDays) * 100).toFixed(2) 
      : 0;

    // Driver details
    const driver = await Driver.findById(userId).select("driverName email phone carNumber");

    res.status(200).json({
      success: true,
      data: {
        driver: {
          name: driver?.driverName || "Unknown",
          email: driver?.email || "Unknown",
          phone: driver?.phone || "Unknown",
          carNumber: driver?.carNumber || "N/A",
        },
        month: `${month}/${year}`,
        summary: {
          totalWorkingDays,
          totalPresent: present,
          totalAbsent: absent,
          totalHalfDay: halfDay,
          totalLate: late,
          totalHours: parseFloat(totalHours.toFixed(2)),
          attendancePercentage: parseFloat(attendancePercentage),
        },
        dailyRecords: attendanceRecords.map((record) => ({
          date: record.date,
          checkInTime: record.checkInTime || "-",
          checkOutTime: record.checkOutTime || "-",
          totalHours: record.totalHours || 0,
          status: record.status,
          isLate: record.isLate,
          isWithinOfficeRange: record.isWithinOfficeRange,
        })),
      },
    });
  } catch (error) {
    console.error("Get My Monthly Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating monthly report",
      error: error.message,
    });
  }
};
// ============ ADMIN CONTROLLERS ============

// @desc    Get attendance by ID (Admin only)
// @route   GET /api/attendance/admin/:id
export const getAttendanceById = async (req, res) => {
  try {
    const attendance = await Attendance.findById(req.params.id)
      .populate("driverId", "driverName email phone")
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
// @route   GET /api/attendance/admin/driver/:driverId
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
        .populate("driverId", "driverName email phone")
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
// @route   GET /api/attendance/admin/today-summary
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
      .populate("driverId", "driverName email phone")
      .lean();

    const totalDrivers = await Driver.countDocuments({ status: "active" });

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
          attendancePercentage:
            totalDrivers > 0 ? ((totalPresent / totalDrivers) * 100).toFixed(2) : 0,
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

// @desc    Admin monthly report
// @route   GET /api/attendance/admin/monthly-report
export const getAdminMonthlyReport = async (req, res) => {
  try {
    const { year, month, driverId } = req.query;

    if (!year || !month) {
      return res.status(400).json({
        success: false,
        message: "Please provide year and month (e.g., year=2026&month=07)",
      });
    }

    const startDate = `${year}-${month.padStart(2, "0")}-01`;
    const endDate = new Date(year, parseInt(month), 0).toISOString().split("T")[0];

    let query = {
      date: { $gte: startDate, $lte: endDate },
    };

    if (driverId) {
      query.driverId = new mongoose.Types.ObjectId(driverId);
    }

    const attendanceRecords = await Attendance.find(query)
      .populate("driverId", "driverName email phone carNumber")
      .sort({ date: 1, driverId: 1 })
      .lean();

    // Group by driver
    const groupedData = {};
    attendanceRecords.forEach((record) => {
      const driverIdStr = record.driverId._id.toString();
      if (!groupedData[driverIdStr]) {
        groupedData[driverIdStr] = {
          driver: record.driverId,
          records: [],
        };
      }
      groupedData[driverIdStr].records.push(record);
    });

    const totalWorkingDays = new Date(year, parseInt(month), 0).getDate();

    const driverReports = Object.values(groupedData).map((group) => {
      const records = group.records;
      const present = records.filter((r) => r.status === "Present").length;
      const absent = records.filter((r) => r.status === "Absent").length;
      const halfDay = records.filter((r) => r.status === "Half Day").length;
      const late = records.filter((r) => r.isLate === true).length;
      const totalHours = records.reduce((sum, r) => sum + (r.totalHours || 0), 0);
      const attendedDays = present + halfDay;
      const attendancePercentage =
        totalWorkingDays > 0 ? ((attendedDays / totalWorkingDays) * 100).toFixed(2) : 0;

      return {
        driver: {
          id: group.driver._id,
          name: group.driver.driverName,
          email: group.driver.email,
          phone: group.driver.phone,
          carNumber: group.driver.carNumber,
        },
        summary: {
          totalPresent: present,
          totalAbsent: absent,
          totalHalfDay: halfDay,
          totalLate: late,
          totalHours: parseFloat(totalHours.toFixed(2)),
          attendancePercentage: parseFloat(attendancePercentage),
        },
        dailyRecords: records.map((r) => ({
          date: r.date,
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          totalHours: r.totalHours,
          status: r.status,
          isLate: r.isLate,
        })),
      };
    });

    // Overall summary
    const totalPresentAll = attendanceRecords.filter((r) => r.status === "Present").length;
    const totalAbsentAll = attendanceRecords.filter((r) => r.status === "Absent").length;
    const totalHalfDayAll = attendanceRecords.filter((r) => r.status === "Half Day").length;
    const totalLateAll = attendanceRecords.filter((r) => r.isLate === true).length;
    const totalHoursAll = attendanceRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0);
    const totalDrivers = await Driver.countDocuments({ status: "active" });
    const overallPercentage =
      totalDrivers * totalWorkingDays > 0
        ? ((totalPresentAll + totalHalfDayAll) / (totalDrivers * totalWorkingDays) * 100).toFixed(2)
        : 0;

    res.status(200).json({
      success: true,
      data: {
        month: `${month}/${year}`,
        overallSummary: {
          totalDrivers,
          totalPresent: totalPresentAll,
          totalAbsent: totalAbsentAll,
          totalHalfDay: totalHalfDayAll,
          totalLate: totalLateAll,
          totalHours: parseFloat(totalHoursAll.toFixed(2)),
          attendancePercentage: parseFloat(overallPercentage),
        },
        drivers: driverReports,
      },
    });
  } catch (error) {
    console.error("Get Admin Monthly Report Error:", error);
    res.status(500).json({
      success: false,
      message: "Error generating admin monthly report",
      error: error.message,
    });
  }
};

// @desc    Update attendance (Admin only)
// @route   PUT /api/attendance/admin/:id
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
    ).populate("driverId", "driverName email");

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
// @route   DELETE /api/attendance/admin/:id
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