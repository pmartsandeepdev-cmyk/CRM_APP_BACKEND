import express from "express";
import {
  createStaff,
  getAllStaff,
  getStaffById,
  updateStaff,
  deleteStaff,
  updateStaffRole,
} from "../controller/staff.controller.js";

const router = express.Router();

// Routes
router.route("/")
  .post(createStaff)    // Create staff
  .get(getAllStaff);

router.route("/:id")
  .get(getStaffById)    // Get single staff
  .put(updateStaff)     // Update staff
  .delete(deleteStaff); // Delete staff

router.patch("/:id/role", updateStaffRole); // Update staff role only

export default router;