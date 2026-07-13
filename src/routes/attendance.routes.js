// routes/attendance.routes.js
import express from "express";
import {
  punchIn,
  punchOut,
  getMyAttendance,
  getTodayStatus,
  getMyMonthlyReport,
  getAttendanceById,
  getDriverAttendance,
  getTodaySummary,
  getAdminMonthlyReport,
  updateAttendance,
  deleteAttendance,
} from "../controller/attendance.controller.js";
import { protectDriver } from "../middleware/driverAuth.middleware.js";
import { verifyJWT } from "../middleware/auth.middleware.js";

const router = express.Router();

// ============ DRIVER ROUTES (Sirf Driver) ============
// ✅ FIXED: protectDriver ab sirf inhi driver routes pe lagega,
// admin routes isse affect nahi honge
router.post("/punch-in", protectDriver, punchIn);
router.post("/punch-out", protectDriver, punchOut);
router.get("/my-attendance", protectDriver, getMyAttendance);
router.get("/my-today-status", protectDriver, getTodayStatus);
router.get("/my-monthly-report", protectDriver, getMyMonthlyReport);

// ============ ADMIN ROUTES (verifyJWT + Role Check) ============
// ✅ FIXED: static/specific paths hamesha upar, ":id" wala dynamic route sabse last me
// Warna Express "monthly-report", "today-summary" jaise strings ko bhi
// ":id" samajh ke getAttendanceById pe bhej deta hai (CastError aata hai)

router.get("/admin/today-summary", verifyJWT, getTodaySummary);
router.get("/admin/monthly-report", verifyJWT, getAdminMonthlyReport);
router.get("/admin/driver/:driverId", verifyJWT, getDriverAttendance);

// ⚠️ Ye ":id" wale routes hamesha sabse NEECHE rakhna — naye static
// admin routes add karte waqt bhi inke UPAR hi likhna
router.get("/admin/:id", verifyJWT, getAttendanceById);
router.put("/admin/:id", verifyJWT, updateAttendance);
router.delete("/admin/:id", verifyJWT, deleteAttendance);

export default router;