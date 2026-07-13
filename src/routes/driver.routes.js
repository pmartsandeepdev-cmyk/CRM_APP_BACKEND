import Router from "express";
import { verifyJWT, authorize  } from "../middleware/auth.middleware.js";
import { createDriver, getAllDrivers, getCurrentDriver, getDriverById, getDriverData, resetPassword, sendPasswordResetEmail, updatePassword } from "../controller/driver.controller.js";
    


const router = Router();

// Public routes (no authentication required)
router.route("/register", verifyJWT, authorize(["admin", "superadmin"]),).post(createDriver);
router.route("/password-reset-email").post(sendPasswordResetEmail);
router.route("/reset-password").post(resetPassword);

router.get("/getById/:id", getDriverById);

// router.route("/logout").post(verifyJWT, logoutUser); 

router.route("/update-password").post(verifyJWT, updatePassword);

router.route("/profile").get(verifyJWT, getCurrentDriver);

router.route("/data").post(verifyJWT, getDriverData);

router.get("/driver-all", getAllDrivers);

// router.get('/drivers/locations', getAllDriversWithLocations);
// router.get('/driver/:driverId/order/:orderId/route', getDriverRouteHistory);
// router.get('/drivers/active-map', getActiveDriversOnMap);

export default router;