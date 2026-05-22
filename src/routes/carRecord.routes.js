import express from "express";
import {
  createCarRecord,
  getAllCarRecords,
  getCarRecordById,
  updateCarRecord,
  deleteCarRecord,
  myRoutetripDriver,

} from "../controller/carRecord.controller.js";
import { protectDriver } from "../middleware/driverAuth.middleware.js";

const router = express.Router();

// ✅ Create new record
router.post("/create", protectDriver, createCarRecord);
// ✅ Get all records (with filters)
router.get("/getAll", getAllCarRecords);

// ✅ Get summary
// router.get("/summary", getCarRecordSummary);

router.get("/my-route", protectDriver, myRoutetripDriver);

router.get("/:id", getCarRecordById);

// ✅ Update record
router.put("/:id", updateCarRecord);

// ✅ Delete record
router.delete("/:id", deleteCarRecord);

export default router;