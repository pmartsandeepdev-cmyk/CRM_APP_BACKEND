import express from "express";
import { protectDriver } from "../middleware/driverAuth.middleware.js";

import {
  updateDriverLocation,
  getDriverHistory,
  getTripHistory,
  getCurrentDrivers,
} from "../controller/driverLocation.controller.js";

const router = express.Router();

// Driver Update Location
router.post(
  "/update-location",
  protectDriver,
  updateDriverLocation
);

// Driver History
router.get(
  "/history/:driverId",
  getDriverHistory
);

// Trip History
router.get(
  "/trip-history/:tripId",
  getTripHistory
);

// Current Drivers Location
router.get(
  "/current",
  getCurrentDrivers
);

export default router;