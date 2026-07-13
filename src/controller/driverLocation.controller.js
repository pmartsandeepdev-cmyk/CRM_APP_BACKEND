import { DriverLocation } from "../model/driverLocation.model.js";
import { Driver } from "../model/driver.model.js";

export const updateDriverLocation = async (req, res) => {
  try {
    const driverId = req.driver._id;

    const {
      tripId,
      latitude,
      longitude,
      address,
      speed,
      heading,
      accuracy,
      battery,
    } = req.body;

    // Save History
    const history = await DriverLocation.create({
      driver: driverId,
      trip: tripId,
      latitude,
      longitude,
      address,
      speed,
      heading,
      accuracy,
      battery,
    });

    // Update Current Location
    await Driver.findByIdAndUpdate(driverId, {
      currentLocation: {
        latitude,
        longitude,
        address,
        speed,
        heading,
        accuracy,
        battery,
        updatedAt: new Date(),
      },
    });

    // Socket Emit
    req.app.get("io").emit("driver-location-updated", {
      driverId,
      tripId,
      latitude,
      longitude,
      address,
      speed,
    });

    return res.status(200).json({
      success: true,
      message: "Location Updated",
      data: history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getDriverHistory = async (req, res) => {
  try {
    const { driverId } = req.params;

    const locations = await DriverLocation.find({
      driver: driverId,
    })
      .sort({ createdAt: -1 })
      .populate("driver", "driverName email")
      .populate("trip");

    return res.json({
      success: true,
      total: locations.length,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getTripHistory = async (req, res) => {
  try {
    const { tripId } = req.params;

    const locations = await DriverLocation.find({
      trip: tripId,
    }).sort({ createdAt: 1 });

    res.json({
      success: true,
      total: locations.length,
      data: locations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCurrentDrivers = async (req, res) => {
  try {
    const drivers = await Driver.find()
      .select("driverName currentLocation vehicle");

    res.json({
      success: true,
      data: drivers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};