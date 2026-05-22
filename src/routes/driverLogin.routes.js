import Router from "express";
import { verifyJWT } from "../middleware/auth.middleware.js";
import { loginDriver, logoutDriver } from "../controller/driverLogin.controller.js";

const router = Router();

router.route("/login").post(loginDriver);


router.route("/logout").post(verifyJWT, logoutDriver);


export default router;

