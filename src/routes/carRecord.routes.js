// routes/carRecord.routes.js
import express from "express";
import { protectDriver } from "../middleware/driverAuth.middleware.js";
import {
  createCarRecord,
  getAllCarRecords,
  getCarRecordById,
  getAllStaff,
  getCarRecordsByStaff,
  getCarRecordsByRegistration,
  getCarRecordSummary,
  updateCarRecord,
  deleteCarRecord,
  myRoutetripDriver,
  updateTripLocation,
  stopTrip,
  getActiveTrip,
  getTripLocations,
  getTripRoute,
  exportCarRecordsToExcel,
  exportCarRecordsWithExcelJS,
} from "../controller/carRecord.controller.js";

const router = express.Router();

// ============ DRIVER PROTECTED ROUTES ============
router.post("/create", protectDriver, createCarRecord);
router.post("/update-location", protectDriver, updateTripLocation);
router.post("/stop-trip/:tripId", protectDriver, stopTrip);
router.get("/active-trip", protectDriver, getActiveTrip);
router.get("/my-trips", protectDriver, myRoutetripDriver);
router.get("/trip-locations/:tripId", protectDriver, getTripLocations);
router.get("/trip-route/:tripId", protectDriver, getTripRoute);

// ============ PUBLIC / ADMIN ROUTES ============
router.get("/", getAllCarRecords);
router.get("/:id", getCarRecordById);
router.put("/:id", updateCarRecord);
router.delete("/:id", deleteCarRecord);
router.get("/staff/all", getAllStaff);
router.get("/staff/:staffId/records", getCarRecordsByStaff);
router.get("/registration/:registrationNumber", getCarRecordsByRegistration);
router.get("/summary/analytics", getCarRecordSummary);



// Export routes
router.get("/export/excel", exportCarRecordsToExcel);
// Or using ExcelJS
router.get("/export/exceljs", exportCarRecordsWithExcelJS);
export default router;