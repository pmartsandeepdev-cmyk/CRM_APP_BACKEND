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

// Admin
router.get("/report/monthly", verifyJWT, getMonthlyReport);
router.get("/summary/today", verifyJWT, getTodaySummary);
router.get("/driver/:driverId", verifyJWT, getDriverAttendance);
router.get("/range", verifyJWT, getAttendanceByDateRange);

// Driver
router.use(protectDriver);

router.post("/punch-in", punchIn);
router.post("/punch-out", punchOut);
router.get("/my-attendance", getMyAttendance);
router.get("/my-today-status", getTodayStatus);

// Admin ID routes LAST
router.get("/:id", verifyJWT, getAttendanceById);
router.put("/:id", verifyJWT, updateAttendance);
router.delete("/:id", verifyJWT, deleteAttendance);



export default router;