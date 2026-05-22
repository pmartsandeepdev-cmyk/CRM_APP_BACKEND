// routes/attendance.routes.js (Driver only version)
import express from "express";
import {
  punchIn,
  punchOut,
  getMyAttendance,
  getTodayStatus,
} from "../controller/attendance.controller.js";
import { protectDriver } from "../middleware/driverAuth.middleware.js";

const router = express.Router();


router.use(protectDriver);

// Driver attendance routes
router.post("/punch-in", punchIn);
router.post("/punch-out", punchOut);
router.get("/my-attendance", getMyAttendance);
router.get("/my-today-status", getTodayStatus);

export default router;