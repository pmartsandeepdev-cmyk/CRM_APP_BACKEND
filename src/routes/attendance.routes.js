import express from "express";
import {
  punchIn,
  punchOut,
  getMyAttendance,
  getTodayStatus,
  getAttendanceById,
  getDriverAttendance,
  getTodaySummary,
  getAttendanceByDateRange,
  updateAttendance,
  deleteAttendance,
  getMonthlyReport,
} from "../controller/attendance.controller.js";
import { protectDriver } from "../middleware/driverAuth.middleware.js";
import { verifyJWT } from '../middleware/auth.middleware.js'
const router = express.Router();

// Admin routes
router.get("/report/monthly", verifyJWT, getMonthlyReport);
router.get("/summary/today", verifyJWT, getTodaySummary);
router.get("/driver/:driverId", verifyJWT, getDriverAttendance);
router.get("/range", verifyJWT, getAttendanceByDateRange);
router.get("/:id", verifyJWT, getAttendanceById);
router.put("/:id", verifyJWT, updateAttendance);
router.delete("/:id", verifyJWT, deleteAttendance);

// ============ DRIVER ROUTES ============
// All driver routes require driver authentication
router.use(protectDriver);

// Driver attendance routes
router.post("/punch-in", punchIn);
router.post("/punch-out", punchOut);
router.get("/my-attendance", getMyAttendance);
router.get("/my-today-status", getTodayStatus);

export default router;