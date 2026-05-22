import jwt from "jsonwebtoken";
import { Driver } from "../model/driver.model.js";

export const protectDriver = async (req, res, next) => {
  try {
    let token;

    const authHeader = req.headers.authorization;

    if (authHeader) {
      token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;
    }

    console.log("TOKEN =>", token);
    console.log("SECRET =>", process.env.ACCESS_TOKEN_SECRET);

    const decoded = jwt.verify(
      token,
      process.env.ACCESS_TOKEN_SECRET
    );

    console.log("DECODED =>", decoded);

    req.driver = await Driver.findById(decoded.id);

    next();
  } catch (error) {
    console.log("AUTH ERROR =>", error.message);

    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};