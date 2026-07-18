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
  getLiveVehicles,
  getLiveVehiclesFromLocations,
  getVehiclesWithLocations,
  debugActiveTrips,
  debugLocationTrips,
  fixActiveTrips,
  completeHomeTrip,
  completeVisitTrip,
  completePetrolTrip,
  completeMaintenanceTrip,
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





// 1. Complete Home Trip (movement/CNG)
router.put("/trip/:tripId/complete-home", protectDriver, completeHomeTrip);

// 2. Complete Visit Trip (with notes and close reading)
router.put("/trip/:tripId/complete-visit", protectDriver, completeVisitTrip);

// 3. Complete Petrol Trip (with images)
router.put("/trip/:tripId/complete-petrol", protectDriver, completePetrolTrip);

// 4. Complete Maintenance Trip (with images)
router.put("/trip/:tripId/complete-maintenance", protectDriver, completeMaintenanceTrip);




// ============ DEBUG ROUTES (MUST BE BEFORE /:id) ============
router.get("/debug/active-trips", debugActiveTrips);
router.get("/debug/location-trips", debugLocationTrips);
router.post("/fix/active-trips", fixActiveTrips);

// ============ PUBLIC / ADMIN ROUTES (Specific paths FIRST) ============
router.get("/staff/all", getAllStaff);
router.get("/staff/:staffId/records", getCarRecordsByStaff);
router.get("/registration/:registrationNumber", getCarRecordsByRegistration);
router.get("/summary/analytics", getCarRecordSummary);

// Vehicle tracking routes - SPECIFIC PATHS FIRST
router.get("/live-vehicles", getLiveVehicles);
router.get("/live-vehicles-v2", getLiveVehiclesFromLocations);
router.get("/vehicles-with-locations", getVehiclesWithLocations);

// Export routes
router.get("/export/excel", exportCarRecordsToExcel);
router.get("/export/exceljs", exportCarRecordsWithExcelJS);

// Get all records (with query params)
router.get("/", getAllCarRecords);

// ============ PARAMETERIZED ROUTES (MUST BE LAST) ============
router.get("/:id", getCarRecordById);
router.put("/:id", updateCarRecord);
router.delete("/:id", deleteCarRecord);








export default router;