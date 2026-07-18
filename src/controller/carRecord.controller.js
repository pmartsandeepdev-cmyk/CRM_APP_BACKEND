// controller/carRecord.controller.js
import mongoose from "mongoose";
import { CarRecord } from "../model/carRecodMomement.model.js";
import { DriverLocation } from "../model/driverLocation.model.js";
import { Driver } from "../model/driver.model.js";
import Staff from "../model/staff.model.js";

// ============ HELPER FUNCTIONS ============
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}


export const createCarRecord = async (req, res) => {
  try {
    const {
      carNumber,
      name,
      staffName,
      sector,
      movementPurpose,
      startroute,
      endroute,
      startReading,
      endReading,
      petrol,
      visit,
      startkm,
      endkm,
      maintenance,
      staffId,
      latitude,
      longitude,
    } = req.body;

    const driverId = req.driver._id; // ✅ Driver ID from token

    console.log(`📤 Creating trip for driver: ${driverId}`);

    if (staffId && !mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    // Create Car Record with driver
const carRecord = new CarRecord({
  carNumber,
  name,
  staffName,
  sector,
  movementPurpose,
  startroute,
  endroute,
  startReading,
  endReading,
  petrol,
  visit,
  startkm,
  endkm,
  maintenance,
  driver: driverId,
  staff: staffId || null,
  tripStatus: "active",
  startTime: new Date(),
  date: new Date(),
});

    await carRecord.save();

 // Create Initial Location
let locationData = null;

console.log("📍 Latitude:", latitude);
console.log("📍 Longitude:", longitude);

if (latitude != null && longitude != null) {
  locationData = new DriverLocation({
    driver: driverId,
    trip: carRecord._id,
    latitude: Number(latitude),
    longitude: Number(longitude),
    isActive: true,
    locationTimestamp: new Date(),
    createdAt: new Date(),
  });

  await locationData.save();

  carRecord.drivertrakinglocation = locationData._id;
  await carRecord.save();

  console.log("✅ Initial location saved");
} else {
  console.log("❌ Latitude/Longitude not received from frontend");
}
    // Update Driver Status
    await Driver.findByIdAndUpdate(driverId, {
      status: 'active',
      currentLocation: locationData ? {
        latitude: latitude,
        longitude: longitude,
        timestamp: new Date(),
      } : undefined,
    });

    // Populate Response
    await carRecord.populate([
      {
        path: "driver",
        select: "driverName email profile vehicle license rc status role"
      },
      {
        path: "staff",
        select: "name email phone role createdAt"
      },
      {
        path: "drivertrakinglocation",
        select: "latitude longitude speed heading accuracy createdAt"
      }
    ]);

    res.status(201).json({
      success: true,
      message: "Driver route created successfully and tracking started",
      data: {
        ...carRecord.toObject(),
        trackingStatus: 'active',
        locationTracking: locationData ? true : false,
      }
    });

  } catch (error) {
    console.error("Create record error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create record",
      error: error.message
    });
  }
};


export const updateTripLocation = async (req, res) => {
  try {
    const { tripId, latitude, longitude, speed, heading, accuracy } = req.body;
    const driverId = req.driver._id; // ✅ Driver ID from token

    console.log(`📍 Updating location for trip: ${tripId}, driver: ${driverId}`);

    // ✅ Verify trip belongs to this driver
    const trip = await CarRecord.findOne({
      _id: tripId,
      driver: driverId, // ✅ IMPORTANT: Verify driver ownership
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found or unauthorized",
      });
    }

    if (trip.tripStatus !== 'active') {
      return res.status(400).json({
        success: false,
        message: `Trip is ${trip.tripStatus}, cannot update location`,
      });
    }

    const location = new DriverLocation({
      driver: driverId,
      trip: tripId,
      latitude,
      longitude,
      speed: speed || 0,
      heading: heading || 0,
      accuracy: accuracy || 0,
      isActive: true,
      locationTimestamp: new Date(),
      createdAt: new Date(),
    });

    await location.save();

    await CarRecord.findByIdAndUpdate(tripId, {
      drivertrakinglocation: location._id,
    });

    await Driver.findByIdAndUpdate(driverId, {
      currentLocation: {
        latitude,
        longitude,
        timestamp: new Date(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
      data: location,
    });

  } catch (error) {
    console.error("Update location error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update location",
      error: error.message,
    });
  }
};


export const stopTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const driverId = req.driver._id; // ✅ Driver ID from token

    console.log(`🛑 Stopping trip: ${tripId}, driver: ${driverId}`);

    // ✅ Verify trip belongs to this driver
    const trip = await CarRecord.findOne({
      _id: tripId,
      driver: driverId, // ✅ IMPORTANT: Verify driver ownership
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found or unauthorized",
      });
    }

    if (trip.tripStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Trip is already completed",
      });
    }

    const endTime = new Date();
    const startTime = trip.startTime || trip.createdAt;
    const totalDuration = Math.round((endTime - startTime) / (1000 * 60));

    trip.tripStatus = 'completed';
    trip.endTime = endTime;
    trip.totalDuration = totalDuration;
    await trip.save();

    await DriverLocation.updateMany(
      { trip: tripId, isActive: true },
      { isActive: false }
    );

    await Driver.findByIdAndUpdate(driverId, {
      status: 'offline',
    });

    const totalLocations = await DriverLocation.countDocuments({ trip: tripId });
    const latestLocation = await DriverLocation.findOne({ trip: tripId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Trip stopped successfully",
      data: {
        trip,
        summary: {
          totalDuration: `${totalDuration} minutes`,
          totalLocations,
          startTime,
          endTime,
          latestLocation,
        }
      },
    });

  } catch (error) {
    console.error("Stop trip error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop trip",
      error: error.message,
    });
  }
};

export const getActiveTrip = async (req, res) => {
  try {
    const driverId = req.driver._id;

    console.log("================================");
    console.log("Logged Driver:", driverId.toString());
    console.log("Email:", req.driver.email);

    const activeTrip = await CarRecord.findOne({
      driver: driverId,
      tripStatus: "active",
    }).sort({ createdAt: -1 });

    console.log("Trip Found:", activeTrip?._id);
    console.log("Trip Driver:", activeTrip?.driver?.toString());
    console.log("================================");

    if (!activeTrip) {
      return res.json({
        success: true,
        data: null,
      });
    }

const latestLocation = await DriverLocation.findOne({
    trip: activeTrip._id
});

    return res.json({
      success: true,
      data: {
        trip: activeTrip,
        latestLocation,
        isTracking: !!latestLocation,
      },
    });
  } catch (err) {
    console.log(err);
  }
};
// ============ GET TRIP LOCATIONS ============
export const getTripLocations = async (req, res) => {
  try {
    const { tripId } = req.params;
    const { page = 1, limit = 100 } = req.query;

    const trip = await CarRecord.findById(tripId);
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const locations = await DriverLocation.find({ trip: tripId })
      .sort({ createdAt: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit));

    const total = await DriverLocation.countDocuments({ trip: tripId });

    res.status(200).json({
      success: true,
      data: {
        trip: {
          id: trip._id,
          carNumber: trip.carNumber,
          tripStatus: trip.tripStatus,
          startTime: trip.startTime,
          endTime: trip.endTime,
        },
        locations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });

  } catch (error) {
    console.error("Get trip locations error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get trip locations",
      error: error.message,
    });
  }
};

// ============ GET TRIP ROUTE (For Map) ============
export const getTripRoute = async (req, res) => {
  try {
    const { tripId } = req.params;

    const locations = await DriverLocation.find({ trip: tripId })
      .sort({ createdAt: 1 })
      .select('latitude longitude speed heading accuracy createdAt');

    const trip = await CarRecord.findById(tripId)
      .select('carNumber tripStatus startTime endTime');

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not found",
      });
    }

    const route = locations.map(loc => ({
      latitude: loc.latitude,
      longitude: loc.longitude,
      timestamp: loc.createdAt,
      speed: loc.speed,
      accuracy: loc.accuracy,
    }));

    let totalDistance = 0;
    if (route.length >= 2) {
      for (let i = 1; i < route.length; i++) {
        const prev = route[i - 1];
        const curr = route[i];
        const distance = calculateDistance(
          prev.latitude, prev.longitude,
          curr.latitude, curr.longitude
        );
        totalDistance += distance;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        trip: {
          id: trip._id,
          carNumber: trip.carNumber,
          status: trip.tripStatus,
          startTime: trip.startTime,
          endTime: trip.endTime,
        },
        route,
        summary: {
          totalPoints: route.length,
          totalDistance: Math.round(totalDistance * 100) / 100,
          totalDistanceMeters: Math.round(totalDistance * 1000),
        },
      },
    });

  } catch (error) {
    console.error("Get trip route error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get trip route",
      error: error.message,
    });
  }
};

// ============ GET ALL CAR RECORDS ============
export const getAllCarRecords = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      carNumber,
      movementPurpose,
      startDate,
      endDate,
      sector,
      driver,
      staffId
    } = req.query;

    const filter = {};

    if (carNumber) filter.carNumber = { $regex: carNumber, $options: "i" };
    if (movementPurpose) filter.movementPurpose = movementPurpose;
    if (sector) filter.sector = { $regex: sector, $options: "i" };
    if (driver) filter.driver = driver;
    if (staffId) filter.staff = staffId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      CarRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: 'driver',
          select: 'driverName email profile vehicle license rc status role',
        })
        .populate({
          path: 'staff',
          select: 'name email phone role createdAt'
        })
        .populate('createdBy', 'username email')
        .populate({
          path: 'drivertrakinglocation',
          select: 'latitude longitude speed heading accuracy createdAt'
        }),
      CarRecord.countDocuments(filter),
    ]);

    const formattedRecords = records.map(record => {
      const recordObj = record.toObject();
      
      if (recordObj.driver) {
        const vehicleRegistration = recordObj.driver.vehicle?.registrationNumber;
        const rcNumber = recordObj.driver.rc?.number;
        
        recordObj.driver.vehicleInfo = {
          type: recordObj.driver.vehicle?.type || null,
          brand: recordObj.driver.vehicle?.brand || null,
          model: recordObj.driver.vehicle?.model || null,
          vehicleRegistrationNumber: vehicleRegistration || null,
          rcNumber: rcNumber || null,
          registrationNumber: vehicleRegistration || rcNumber || null,
          isRegistrationVerified: !!(vehicleRegistration),
          isRCVerified: recordObj.driver.rc?.verified || false,
          licenseNumber: recordObj.driver.license?.number || null,
          licenseCategory: recordObj.driver.license?.category || null,
          isLicenseVerified: recordObj.driver.license?.verified || false,
        };
      }
      
      if (recordObj.staff) {
        recordObj.staffInfo = {
          id: recordObj.staff._id,
          name: recordObj.staff.name,
          email: recordObj.staff.email,
          phone: recordObj.staff.phone,
          role: recordObj.staff.role,
          joinedAt: recordObj.staff.createdAt
        };
      }
      
      return recordObj;
    });

    res.status(200).json({
      success: true,
      data: formattedRecords,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching car records:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch car records",
      error: error.message,
    });
  }
};

// ============ GET CAR RECORD BY ID ============
export const getCarRecordById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record ID",
      });
    }

    const record = await CarRecord.findById(id)
      .populate({
        path: 'driver',
        select: 'driverName email profile vehicle license rc status role createdAt'
      })
      .populate({
        path: 'staff',
        select: 'name email phone role createdAt'
      })
      .populate('createdBy', 'username email')
      .populate({
        path: 'drivertrakinglocation',
        select: 'latitude longitude speed heading accuracy createdAt'
      });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Car record not found",
      });
    }

    const response = record.toObject();
    
    if (response.driver) {
      const vehicleRegistration = response.driver.vehicle?.registrationNumber;
      const rcNumber = response.driver.rc?.number;
      
      response.driver.vehicleInfo = {
        type: response.driver.vehicle?.type || null,
        brand: response.driver.vehicle?.brand || null,
        model: response.driver.vehicle?.model || null,
        vehicleRegistrationNumber: vehicleRegistration || null,
        rcNumber: rcNumber || null,
        registrationNumber: vehicleRegistration || rcNumber || null,
        hasRegistration: !!(vehicleRegistration || rcNumber),
        isVehicleRegistered: !!vehicleRegistration,
        isRCVerified: response.driver.rc?.verified || false,
        isFullyVerified: (!!vehicleRegistration && response.driver.rc?.verified) || false,
        license: {
          number: response.driver.license?.number || null,
          category: response.driver.license?.category || null,
          verified: response.driver.license?.verified || false,
        },
      };
    }
    
    if (response.staff) {
      response.staffInfo = {
        id: response.staff._id,
        name: response.staff.name,
        email: response.staff.email,
        phone: response.staff.phone,
        role: response.staff.role,
        joinedAt: response.staff.createdAt
      };
    }

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Error fetching car record:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch car record",
      error: error.message,
    });
  }
};

// ============ GET ALL STAFF ============
export const getAllStaff = async (req, res) => {
  try {
    const { role, page = 1, limit = 50 } = req.query;
    
    let query = {};
    if (role) query.role = role;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const staff = await Staff.find(query)
      .select('name email phone role createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Staff.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: staff,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error("Error fetching staff:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch staff members",
      error: error.message
    });
  }
};

// ============ GET CAR RECORDS BY STAFF ============
export const getCarRecordsByStaff = async (req, res) => {
  try {
    const { staffId } = req.params;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    const staff = await Staff.findById(staffId).select('name email phone role');
    if (!staff) {
      return res.status(404).json({
        success: false,
        message: "Staff member not found",
      });
    }

    const filter = { staff: staffId };
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      CarRecord.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: 'driver',
          select: 'driverName email vehicle license rc profile'
        })
        .populate({
          path: 'staff',
          select: 'name email phone role'
        })
        .populate('createdBy', 'username email')
        .populate({
          path: 'drivertrakinglocation',
          select: 'latitude longitude speed heading accuracy createdAt'
        }),
      CarRecord.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: {
        staff: {
          _id: staff._id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          role: staff.role
        },
        records: records,
        summary: {
          totalRecords: total,
          totalPages: Math.ceil(total / parseInt(limit)),
          currentPage: parseInt(page)
        }
      },
    });
  } catch (error) {
    console.error("Error fetching records by staff:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch records",
      error: error.message,
    });
  }
};

// ============ GET CAR RECORDS BY REGISTRATION ============
export const getCarRecordsByRegistration = async (req, res) => {
  try {
    const { registrationNumber } = req.params;
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    if (!registrationNumber) {
      return res.status(400).json({
        success: false,
        message: "Registration number is required",
      });
    }

    const upperRegNumber = registrationNumber.toUpperCase();
    
    const driver = await Driver.findOne({
      $or: [
        { 'vehicle.registrationNumber': upperRegNumber },
        { 'rc.number': upperRegNumber }
      ]
    });

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "No driver found with this registration number",
      });
    }

    const filter = { driver: driver._id };
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [records, total] = await Promise.all([
      CarRecord.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: 'driver',
          select: 'driverName email vehicle license rc profile'
        })
        .populate({
          path: 'staff',
          select: 'name email phone role'
        })
        .populate('createdBy', 'username email')
        .populate({
          path: 'drivertrakinglocation',
          select: 'latitude longitude speed heading accuracy createdAt'
        }),
      CarRecord.countDocuments(filter),
    ]);

    const driverInfo = driver.toObject();
    const vehicleRegistration = driverInfo.vehicle?.registrationNumber;
    const rcNumber = driverInfo.rc?.number;

    res.status(200).json({
      success: true,
      data: {
        driver: {
          _id: driverInfo._id,
          driverName: driverInfo.driverName,
          email: driverInfo.email,
          profile: driverInfo.profile,
          vehicle: {
            type: driverInfo.vehicle?.type,
            brand: driverInfo.vehicle?.brand,
            model: driverInfo.vehicle?.model,
            registrationNumber: vehicleRegistration,
          },
          rc: {
            number: rcNumber,
            verified: driverInfo.rc?.verified,
          },
          license: {
            number: driverInfo.license?.number,
            category: driverInfo.license?.category,
            verified: driverInfo.license?.verified,
          },
          registrationSummary: {
            vehicleRegistrationNumber: vehicleRegistration,
            rcNumber: rcNumber,
            primaryNumber: vehicleRegistration || rcNumber,
            matchingNumber: upperRegNumber,
          }
        },
        records: records,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching records by registration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch records",
      error: error.message,
    });
  }
};

// ============ GET CAR RECORD SUMMARY ============
export const getCarRecordSummary = async (req, res) => {
  try {
    const { startDate, endDate, carNumber, staffId } = req.query;

    const filter = {};
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    if (carNumber) filter.carNumber = carNumber;
    if (staffId && mongoose.Types.ObjectId.isValid(staffId)) filter.staff = mongoose.Types.ObjectId(staffId);

    const summary = await CarRecord.aggregate([
      { $match: filter },
      {
        $lookup: {
          from: "drivers",
          localField: "driver",
          foreignField: "_id",
          as: "driverInfo"
        }
      },
      { $unwind: { path: "$driverInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "staffs",
          localField: "staff",
          foreignField: "_id",
          as: "staffInfo"
        }
      },
      { $unwind: { path: "$staffInfo", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$carNumber",
          totalTrips: { $sum: 1 },
          totalKm: { $sum: "$totalKm" },
          totalPetrolAmount: { $sum: "$petrol.amount" },
          totalMaintenanceAmount: { $sum: "$maintenance.amount" },
          averageKmPerTrip: { $avg: "$totalKm" },
          drivers: { $addToSet: "$driverInfo.driverName" },
          staffMembers: { $addToSet: "$staffInfo.name" },
          vehicleRegistrations: { 
            $addToSet: "$driverInfo.vehicle.registrationNumber" 
          },
          rcNumbers: { 
            $addToSet: "$driverInfo.rc.number" 
          }
        },
      },
      {
        $project: {
          carNumber: "$_id",
          totalTrips: 1,
          totalKm: 1,
          totalPetrolAmount: 1,
          totalMaintenanceAmount: 1,
          averageKmPerTrip: { $round: ["$averageKmPerTrip", 2] },
          associatedDrivers: { $size: "$drivers" },
          driverNames: "$drivers",
          associatedStaff: { $size: "$staffMembers" },
          staffNames: "$staffMembers",
          vehicleRegistrations: "$vehicleRegistrations",
          rcNumbers: "$rcNumbers",
        },
      },
      { $sort: { totalTrips: -1 } },
    ]);

    res.status(200).json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch summary",
      error: error.message,
    });
  }
};

// ============ UPDATE CAR RECORD ============
export const updateCarRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record ID",
      });
    }

    if (updateData.staffId && !mongoose.Types.ObjectId.isValid(updateData.staffId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid staff ID",
      });
    }

    if (updateData.staffId) {
      updateData.staff = updateData.staffId;
      delete updateData.staffId;
    }

    const updatedRecord = await CarRecord.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate({
        path: 'driver',
        select: 'driverName email vehicle license rc'
      })
      .populate({
        path: 'staff',
        select: 'name email phone role'
      })
      .populate('createdBy', 'username email')
      .populate({
        path: 'drivertrakinglocation',
        select: 'latitude longitude speed heading accuracy createdAt'
      });

    if (!updatedRecord) {
      return res.status(404).json({
        success: false,
        message: "Car record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Car record updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    console.error("Error updating car record:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update car record",
      error: error.message,
    });
  }
};

// ============ DELETE CAR RECORD ============
export const deleteCarRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record ID",
      });
    }

    // Delete associated locations too
    await DriverLocation.deleteMany({ trip: id });

    const deletedRecord = await CarRecord.findByIdAndDelete(id);

    if (!deletedRecord) {
      return res.status(404).json({
        success: false,
        message: "Car record not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Car record deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting car record:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete car record",
      error: error.message,
    });
  }
};

// controller/carRecord.controller.js - Confirm this is correct
// controller/carRecord.controller.js - Confirm this is correct

export const myRoutetripDriver = async (req, res) => {
  try {
    // ✅ IMPORTANT: Driver ID from token
    const driverId = req.driver._id;
    const { date } = req.query;

    console.log(`📤 Fetching trips for driver: ${driverId}`);
    console.log(`📤 Driver email: ${req.driver.email}`);

    // ✅ ONLY filter for this specific driver
    let filter = {
      driver: driverId, // ✅ CRITICAL: Sirf is driver ki trips
    };

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay,
      };
    }

    const trips = await CarRecord.find(filter)
      .sort({ createdAt: -1 })
      .populate("driver", "driverName email vehicle")
      .populate("staff", "name email phone role")
      .populate({
        path: 'drivertrakinglocation',
        select: 'latitude longitude speed heading accuracy createdAt'
      });

    console.log(`✅ Found ${trips.length} trips for driver ${driverId}`);

    res.status(200).json({
      success: true,
      totalTrips: trips.length,
      totalKm: trips.reduce((sum, trip) => sum + (trip.totalKm || 0), 0),
      data: trips,
    });
  } catch (error) {
    console.error("MY ROUTE ERROR =>", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
// ============ EXPORT TO EXCEL ============
import xlsx from 'xlsx';
import ExcelJS from 'exceljs';

export const exportCarRecordsToExcel = async (req, res) => {
  try {
    const records = await CarRecord.find()
      .populate("driver", "driverName email")
      .populate("staff", "name")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const excelData = records.map((record, index) => ({
      "S.No": index + 1,
      "Driver Name": record.driver?.driverName || "N/A",
      "Staff Name": record.staff?.name || record.staffName || "N/A",
      "Vehicle Name": record.name || "N/A",
      "Sector": record.sector || "N/A",
      "Movement Purpose": record.movementPurpose || "N/A",
      "Start Route": record.startroute || "N/A",
      "End Route": record.endroute || "N/A",
      "Start Reading": record.startReading || "N/A",
      "End Reading": record.endReading || "N/A",
      "Total KM": record.totalKm || "N/A",
      "Petrol Amount": record.petrol?.amount || "N/A",
      "Maintenance Amount": record.maintenance?.amount || "N/A",
      "Date": record.date ? new Date(record.date).toLocaleDateString() : "N/A",
    }));

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(excelData);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Car Records");

    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=car-records-${new Date().toISOString().split("T")[0]}.xlsx`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export car records",
      error: error.message,
    });
  }
};

export const exportCarRecordsWithExcelJS = async (req, res) => {
  try {
    const records = await CarRecord.find()
      .populate("driver", "driverName email")
      .populate("staff", "name")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Car Records");

    worksheet.columns = [
      { header: "S.No", key: "sno", width: 8 },
      { header: "Driver Name", key: "driver", width: 20 },
      { header: "Staff Name", key: "staff", width: 20 },
      { header: "Vehicle Name", key: "name", width: 20 },
      { header: "Sector", key: "sector", width: 15 },
      { header: "Movement Purpose", key: "purpose", width: 18 },
      { header: "Start Route", key: "startRoute", width: 25 },
      { header: "End Route", key: "endRoute", width: 25 },
      { header: "Start Reading", key: "startReading", width: 15 },
      { header: "End Reading", key: "endReading", width: 15 },
      { header: "Total KM", key: "totalKm", width: 12 },
      { header: "Petrol Amount", key: "petrolAmount", width: 15 },
      { header: "Maintenance Amount", key: "maintAmount", width: 15 },
      { header: "Date", key: "date", width: 15 },
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    records.forEach((record, index) => {
      worksheet.addRow({
        sno: index + 1,
        driver: record.driver?.driverName || "N/A",
        staff: record.staff?.name || record.staffName || "N/A",
        name: record.name || "N/A",
        sector: record.sector || "N/A",
        purpose: record.movementPurpose || "N/A",
        startRoute: record.startroute || "N/A",
        endRoute: record.endroute || "N/A",
        startReading: record.startReading || "N/A",
        endReading: record.endReading || "N/A",
        totalKm: record.totalKm || "N/A",
        petrolAmount: record.petrol?.amount || "N/A",
        maintAmount: record.maintenance?.amount || "N/A",
        date: record.date ? new Date(record.date).toLocaleDateString() : "N/A",
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=car-records-${new Date().toISOString().split("T")[0]}.xlsx`
    );

    res.send(buffer);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export car records",
      error: error.message,
    });
  }
};

// ============ LIVE VEHICLES TRACKING ============

// Method 1: Get from CarRecord with tripStatus: 'active'
export const getLiveVehicles = async (req, res) => {
  try {
    const activeTrips = await CarRecord.find({
      tripStatus: "active",
    })
      .populate({
        path: "driver",
        select: "driverName email vehicle profile status",
      })
      .populate({
        path: "staff",
        select: "name",
      })
      .populate({
        path: "drivertrakinglocation",
        select: "latitude longitude speed heading accuracy createdAt",
      })
      .sort({ createdAt: -1 });

    const vehicles = activeTrips.map((trip) => ({
      tripId: trip._id,
      carNumber: trip.carNumber,
      driverId: trip.driver?._id,
      driverName: trip.driver?.driverName,
      staffName: trip.staff?.name || trip.staffName,
      status: trip.tripStatus,
      latitude: trip.drivertrakinglocation?.latitude || null,
      longitude: trip.drivertrakinglocation?.longitude || null,
      speed: trip.drivertrakinglocation?.speed || 0,
      heading: trip.drivertrakinglocation?.heading || 0,
      accuracy: trip.drivertrakinglocation?.accuracy || 0,
      updatedAt: trip.drivertrakinglocation?.createdAt,
    }));

    res.status(200).json({
      success: true,
      total: vehicles.length,
      data: vehicles,
    });
  } catch (error) {
    console.error("Live Vehicle Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Method 2: Get from Locations (more reliable)
export const getLiveVehiclesFromLocations = async (req, res) => {
  try {
    console.log('📍 Fetching live vehicles from locations...');
    
    const activeLocations = await DriverLocation.find({ isActive: true })
      .sort({ createdAt: -1 })
      .populate({
        path: 'driver',
        select: 'driverName email'
      });
    
    console.log(`📍 Found ${activeLocations.length} active locations`);
    
    if (activeLocations.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        data: [],
        message: 'No active locations found'
      });
    }
    
    // Get unique trip IDs (handle null/undefined)
    const tripIds = [];
    activeLocations.forEach(loc => {
      if (loc.trip) {
        const tripId = loc.trip.toString();
        if (!tripIds.includes(tripId)) {
          tripIds.push(tripId);
        }
      }
    });
    
    console.log(`📍 Found ${tripIds.length} unique trip IDs`);
    
    if (tripIds.length === 0) {
      return res.status(200).json({
        success: true,
        total: 0,
        data: [],
        message: 'No trips associated with active locations'
      });
    }
    
    const trips = await CarRecord.find({
      _id: { $in: tripIds }
    }).populate('driver', 'driverName email');
    
    console.log(`📍 Found ${trips.length} trips`);
    
    const vehicles = trips.map(trip => {
      const location = activeLocations.find(
        loc => loc.trip && loc.trip.toString() === trip._id.toString()
      );
      
      return {
        tripId: trip._id,
        carNumber: trip.carNumber || 'Unknown',
        driverId: trip.driver?._id || null,
        driverName: trip.driver?.driverName || 'Unknown',
        staffName: trip.staffName || 'N/A',
        status: trip.tripStatus || 'active',
        latitude: location?.latitude || null,
        longitude: location?.longitude || null,
        speed: location?.speed || 0,
        heading: location?.heading || 0,
        accuracy: location?.accuracy || 0,
        updatedAt: location?.createdAt || null,
        locationId: location?._id || null
      };
    });
    
    res.status(200).json({
      success: true,
      total: vehicles.length,
      data: vehicles,
      debug: {
        totalActiveLocations: activeLocations.length,
        uniqueTrips: tripIds.length,
        tripsFound: trips.length
      }
    });
    
  } catch (error) {
    console.error("Error in getLiveVehiclesFromLocations:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Method 3: Using MongoDB Aggregation (most efficient)
export const getVehiclesWithLocations = async (req, res) => {
  try {
    const vehicles = await DriverLocation.aggregate([
      { $match: { isActive: true } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$trip",
          locationId: { $first: "$_id" },
          latitude: { $first: "$latitude" },
          longitude: { $first: "$longitude" },
          speed: { $first: "$speed" },
          heading: { $first: "$heading" },
          accuracy: { $first: "$accuracy" },
          updatedAt: { $first: "$createdAt" },
          driverId: { $first: "$driver" }
        }
      },
      { $match: { _id: { $ne: null } } },
      {
        $lookup: {
          from: "carrecords",
          localField: "_id",
          foreignField: "_id",
          as: "trip"
        }
      },
      { $unwind: { path: "$trip", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "drivers",
          localField: "driverId",
          foreignField: "_id",
          as: "driver"
        }
      },
      { $unwind: { path: "$driver", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          tripId: "$_id",
          carNumber: "$trip.carNumber",
          driverId: "$driverId",
          driverName: "$driver.driverName",
          staffName: "$trip.staffName",
          status: "$trip.tripStatus",
          latitude: 1,
          longitude: 1,
          speed: 1,
          heading: 1,
          accuracy: 1,
          updatedAt: 1,
          locationId: 1
        }
      }
    ]);
    
    res.status(200).json({
      success: true,
      total: vehicles.length,
      data: vehicles
    });
    
  } catch (error) {
    console.error("Error in getVehiclesWithLocations:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============ DEBUG FUNCTIONS ============

export const debugActiveTrips = async (req, res) => {
  try {
    const allRecords = await CarRecord.find({});
    const activeRecords = await CarRecord.find({ tripStatus: 'active' });
    const activeWithDetails = await CarRecord.find({ tripStatus: 'active' })
      .populate('driver', 'driverName email')
      .populate('drivertrakinglocation');
    
    const allLocations = await DriverLocation.find({});
    const activeLocations = await DriverLocation.find({ isActive: true });
    
    res.status(200).json({
      success: true,
      debug: {
        totalCarRecords: allRecords.length,
        activeCarRecords: activeRecords.length,
        activeWithDetails: activeWithDetails.map(t => ({
          id: t._id,
          carNumber: t.carNumber,
          tripStatus: t.tripStatus,
          driver: t.driver?.driverName,
          locationId: t.drivertrakinglocation?._id,
          locationData: t.drivertrakinglocation
        })),
        totalDriverLocations: allLocations.length,
        activeDriverLocations: activeLocations.length,
        sampleLocations: allLocations.slice(0, 3).map(l => ({
          trip: l.trip,
          lat: l.latitude,
          lng: l.longitude,
          isActive: l.isActive
        }))
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const fixActiveTrips = async (req, res) => {
  try {
    console.log('🔧 Fixing active trips...');
    
    const activeLocations = await DriverLocation.find({ isActive: true });
    
    if (activeLocations.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No active locations found',
        modifiedCount: 0
      });
    }
    
    const tripIds = [];
    activeLocations.forEach(loc => {
      if (loc.trip) {
        const tripId = loc.trip.toString();
        if (!tripIds.includes(tripId)) {
          tripIds.push(tripId);
        }
      }
    });
    
    console.log(`📍 Found ${tripIds.length} unique trips with active locations`);
    
    const result = await CarRecord.updateMany(
      { _id: { $in: tripIds } },
      { 
        $set: { 
          tripStatus: 'active',
          startTime: new Date()
        } 
      }
    );
    
    const updatedTrips = await CarRecord.find({ 
      _id: { $in: tripIds } 
    }).select('carNumber tripStatus');
    
    res.status(200).json({
      success: true,
      message: `${result.modifiedCount} trips updated to active`,
      modifiedCount: result.modifiedCount,
      matchedCount: result.matchedCount,
      updatedTrips: updatedTrips,
      totalActiveLocations: activeLocations.length
    });
    
  } catch (error) {
    console.error("Error in fixActiveTrips:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ============ DEBUG LOCATION TRIPS ============
export const debugLocationTrips = async (req, res) => {
  try {
    const activeLocations = await DriverLocation.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(10);
    
    const tripIds = activeLocations.map(loc => loc.trip);
    const trips = await CarRecord.find({ 
      _id: { $in: tripIds } 
    }).select('_id carNumber tripStatus');
    
    const locationWithTripStatus = activeLocations.map(loc => {
      const trip = trips.find(t => t._id.toString() === loc.trip?.toString());
      return {
        locationId: loc._id,
        tripId: loc.trip,
        tripStatus: trip?.tripStatus || 'No trip found',
        carNumber: trip?.carNumber || 'Unknown',
        latitude: loc.latitude,
        longitude: loc.longitude,
        isActive: loc.isActive,
        createdAt: loc.createdAt
      };
    });
    
    res.status(200).json({
      success: true,
      data: {
        totalActiveLocations: await DriverLocation.countDocuments({ isActive: true }),
        sampleLocations: locationWithTripStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};











// ============ END TRIP - HOME TRIP ============
export const completeHomeTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const driverId = req.driver._id;
    const {
      endroute,
      endReading,
      endkm,
    } = req.body;

    console.log(`🏠 Completing home trip: ${tripId}, driver: ${driverId}`);

    const trip = await CarRecord.findOne({
      _id: tripId,
      driver: driverId,
      movementPurpose: { $in: ['movement', 'cng'] },
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Home trip not found or unauthorized",
      });
    }

    if (trip.tripStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Trip is already completed",
      });
    }

    const endTime = new Date();
    const startTime = trip.startTime || trip.createdAt;
    const totalDuration = Math.round((endTime - startTime) / (1000 * 60));

    const startKm = trip.startkm || trip.startReading || 0;
    const endKm = endkm || endReading || 0;
    const totalKm = Math.max(0, endKm - startKm);

    const updatedTrip = await CarRecord.findByIdAndUpdate(
      tripId,
      {
        $set: {
          tripStatus: 'completed',
          endTime: endTime,
          totalDuration: totalDuration,
          endroute: endroute || trip.endroute,
          endReading: endReading || trip.endReading,
          endkm: endkm || trip.endkm,
          totalKm: totalKm,
        }
      },
      { new: true, runValidators: true }
    );

    // Deactivate locations
    await DriverLocation.updateMany(
      { trip: tripId, isActive: true },
      { isActive: false }
    );

    await Driver.findByIdAndUpdate(driverId, {
      status: 'offline',
    });

    await updatedTrip.populate([
      {
        path: "driver",
        select: "driverName email profile vehicle license rc status role"
      },
      {
        path: "staff",
        select: "name email phone role createdAt"
      }
    ]);

    res.status(200).json({
      success: true,
      message: "Home trip completed successfully",
      data: {
        trip: updatedTrip,
        summary: {
          totalDuration: `${totalDuration} minutes`,
          totalDistance: totalKm,
          startTime: startTime,
          endTime: endTime,
        },
      },
    });

  } catch (error) {
    console.error("Complete home trip error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete home trip",
      error: error.message,
    });
  }
};

// ============ END TRIP - VISIT TRIP ============
export const completeVisitTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const driverId = req.driver._id;
    const {
      endroute,
      endReading,
      endkm,
      visitNotes,
      closeReadingHome,
    } = req.body;

    console.log(`🏢 Completing visit trip: ${tripId}, driver: ${driverId}`);

    const trip = await CarRecord.findOne({
      _id: tripId,
      driver: driverId,
      movementPurpose: 'visit',
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Visit trip not found or unauthorized",
      });
    }

    if (trip.tripStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Trip is already completed",
      });
    }

    const endTime = new Date();
    const startTime = trip.startTime || trip.createdAt;
    const totalDuration = Math.round((endTime - startTime) / (1000 * 60));

    const startKm = trip.startkm || trip.startReading || 0;
    const endKm = endkm || endReading || 0;
    const totalKm = Math.max(0, endKm - startKm);

    const updatedTrip = await CarRecord.findByIdAndUpdate(
      tripId,
      {
        $set: {
          tripStatus: 'completed',
          endTime: endTime,
          totalDuration: totalDuration,
          endroute: endroute || trip.endroute,
          endReading: endReading || trip.endReading,
          endkm: endkm || trip.endkm,
          totalKm: totalKm,
          'visit.notes': visitNotes || trip.visit?.notes || '',
          'visit.closeReadingHome': closeReadingHome || trip.visit?.closeReadingHome || endReading,
          'visit.completedAt': endTime,
        }
      },
      { new: true, runValidators: true }
    );

    await DriverLocation.updateMany(
      { trip: tripId, isActive: true },
      { isActive: false }
    );

    await Driver.findByIdAndUpdate(driverId, {
      status: 'offline',
    });

    await updatedTrip.populate([
      {
        path: "driver",
        select: "driverName email profile vehicle license rc status role"
      },
      {
        path: "staff",
        select: "name email phone role createdAt"
      }
    ]);

    res.status(200).json({
      success: true,
      message: "Visit trip completed successfully",
      data: {
        trip: updatedTrip,
        summary: {
          totalDuration: `${totalDuration} minutes`,
          totalDistance: totalKm,
          startTime: startTime,
          endTime: endTime,
          visitNotes: visitNotes || trip.visit?.notes,
          closeReading: closeReadingHome || trip.visit?.closeReadingHome,
        },
      },
    });

  } catch (error) {
    console.error("Complete visit trip error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete visit trip",
      error: error.message,
    });
  }
};

// ============ END TRIP - PETROL TRIP ============
export const completePetrolTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const driverId = req.driver._id;
    const {
      endroute,
      endReading,
      endkm,
      petrolEndReading,
      petrolImages = [],
    } = req.body;

    console.log(`⛽ Completing petrol trip: ${tripId}, driver: ${driverId}`);

    const trip = await CarRecord.findOne({
      _id: tripId,
      driver: driverId,
      movementPurpose: 'petrol',
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Petrol trip not found or unauthorized",
      });
    }

    if (trip.tripStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Trip is already completed",
      });
    }

    const endTime = new Date();
    const startTime = trip.startTime || trip.createdAt;
    const totalDuration = Math.round((endTime - startTime) / (1000 * 60));

    const startKm = trip.startkm || trip.startReading || 0;
    const endKm = endkm || endReading || 0;
    const totalKm = Math.max(0, endKm - startKm);

    const updatedTrip = await CarRecord.findByIdAndUpdate(
      tripId,
      {
        $set: {
          tripStatus: 'completed',
          endTime: endTime,
          totalDuration: totalDuration,
          endroute: endroute || trip.endroute,
          endReading: endReading || trip.endReading,
          endkm: endkm || trip.endkm,
          totalKm: totalKm,
          'petrol.endReading': petrolEndReading || endReading,
          'petrol.images': petrolImages,
          'petrol.completedAt': endTime,
        }
      },
      { new: true, runValidators: true }
    );

    await DriverLocation.updateMany(
      { trip: tripId, isActive: true },
      { isActive: false }
    );

    await Driver.findByIdAndUpdate(driverId, {
      status: 'offline',
    });

    await updatedTrip.populate([
      {
        path: "driver",
        select: "driverName email profile vehicle license rc status role"
      },
      {
        path: "staff",
        select: "name email phone role createdAt"
      }
    ]);

    res.status(200).json({
      success: true,
      message: "Petrol trip completed successfully",
      data: {
        trip: updatedTrip,
        summary: {
          totalDuration: `${totalDuration} minutes`,
          totalDistance: totalKm,
          startTime: startTime,
          endTime: endTime,
          petrolEndReading: petrolEndReading || endReading,
          images: petrolImages,
        },
      },
    });

  } catch (error) {
    console.error("Complete petrol trip error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete petrol trip",
      error: error.message,
    });
  }
};

// ============ END TRIP - MAINTENANCE TRIP ============
export const completeMaintenanceTrip = async (req, res) => {
  try {
    const { tripId } = req.params;
    const driverId = req.driver._id;
    const {
      endroute,
      endReading,
      endkm,
      maintenanceReading,
      maintenanceAmount,
      workDetails,
      maintenanceImages = [],
    } = req.body;

    console.log(`🔧 Completing maintenance trip: ${tripId}, driver: ${driverId}`);

    const trip = await CarRecord.findOne({
      _id: tripId,
      driver: driverId,
      movementPurpose: 'maintenance',
    });

    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Maintenance trip not found or unauthorized",
      });
    }

    if (trip.tripStatus === 'completed') {
      return res.status(400).json({
        success: false,
        message: "Trip is already completed",
      });
    }

    const endTime = new Date();
    const startTime = trip.startTime || trip.createdAt;
    const totalDuration = Math.round((endTime - startTime) / (1000 * 60));

    const startKm = trip.startkm || trip.startReading || 0;
    const endKm = endkm || endReading || 0;
    const totalKm = Math.max(0, endKm - startKm);

    const updatedTrip = await CarRecord.findByIdAndUpdate(
      tripId,
      {
        $set: {
          tripStatus: 'completed',
          endTime: endTime,
          totalDuration: totalDuration,
          endroute: endroute || trip.endroute,
          endReading: endReading || trip.endReading,
          endkm: endkm || trip.endkm,
          totalKm: totalKm,
          'maintenance.reading': maintenanceReading || endReading,
          'maintenance.amount': maintenanceAmount || trip.maintenance?.amount || 0,
          'maintenance.workDetails': workDetails || trip.maintenance?.workDetails || '',
          'maintenance.images': maintenanceImages,
          'maintenance.completedAt': endTime,
        }
      },
      { new: true, runValidators: true }
    );

    await DriverLocation.updateMany(
      { trip: tripId, isActive: true },
      { isActive: false }
    );

    await Driver.findByIdAndUpdate(driverId, {
      status: 'offline',
    });

    await updatedTrip.populate([
      {
        path: "driver",
        select: "driverName email profile vehicle license rc status role"
      },
      {
        path: "staff",
        select: "name email phone role createdAt"
      }
    ]);

    res.status(200).json({
      success: true,
      message: "Maintenance trip completed successfully",
      data: {
        trip: updatedTrip,
        summary: {
          totalDuration: `${totalDuration} minutes`,
          totalDistance: totalKm,
          startTime: startTime,
          endTime: endTime,
          maintenanceReading: maintenanceReading || endReading,
          maintenanceAmount: maintenanceAmount || trip.maintenance?.amount,
          workDetails: workDetails || trip.maintenance?.workDetails,
          images: maintenanceImages,
        },
      },
    });

  } catch (error) {
    console.error("Complete maintenance trip error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to complete maintenance trip",
      error: error.message,
    });
  }
};
