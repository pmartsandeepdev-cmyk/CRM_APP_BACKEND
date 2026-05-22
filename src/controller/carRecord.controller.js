import mongoose from "mongoose";
import { CarRecord } from "../model/carRecodMomement.model.js";
import { Driver } from "../model/driver.model.js"; // Import Driver model





// ✅ Create a new car record with COMPLETE driver info population (carNumber optional)
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
      maintenance
    } = req.body;

    // Logged in driver ID from token
    const driverId = req.driver._id;

    if (!name || !startroute || !endroute) {
      return res.status(400).json({
        success: false,
        message: "Name, start route, and end route are required",
      });
    }

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
      maintenance,
      driver: driverId,   // ✅ auto assign logged-in driver
      date: new Date(),
    });

    await carRecord.save();

    await carRecord.populate({
      path: "driver",
      select: "driverName email role"
    });

    res.status(201).json({
      success: true,
      message: "Driver route created successfully",
      data: carRecord
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
// ✅ Get all car records with complete driver vehicle info
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
    } = req.query;

    // Build filter
    const filter = {};

    if (carNumber) filter.carNumber = { $regex: carNumber, $options: "i" };
    if (movementPurpose) filter.movementPurpose = movementPurpose;
    if (sector) filter.sector = { $regex: sector, $options: "i" };
    if (driver) filter.driver = driver;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get records with complete driver population
    const [records, total] = await Promise.all([
      CarRecord.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate({
          path: 'driver',
          select: 'driverName email profile vehicle license rc status role',
          // Populate all vehicle-related fields
        })
        .populate('createdBy', 'username email'),
      CarRecord.countDocuments(filter),
    ]);

    // Format response with complete vehicle information
    const formattedRecords = records.map(record => {
      const recordObj = record.toObject();
      if (recordObj.driver) {
        // Extract registration numbers from different possible sources
        const vehicleRegistration = recordObj.driver.vehicle?.registrationNumber;
        const rcNumber = recordObj.driver.rc?.number;
        
        recordObj.driver.vehicleInfo = {
          // Vehicle details
          type: recordObj.driver.vehicle?.type || null,
          brand: recordObj.driver.vehicle?.brand || null,
          model: recordObj.driver.vehicle?.model || null,
          
          // Registration numbers
          vehicleRegistrationNumber: vehicleRegistration || null,
          rcNumber: rcNumber || null,
          
          // Primary registration number (prioritize vehicle registration, then RC)
          registrationNumber: vehicleRegistration || rcNumber || null,
          
          // Verification status
          isRegistrationVerified: !!(vehicleRegistration),
          isRCVerified: recordObj.driver.rc?.verified || false,
          
          // License information
          licenseNumber: recordObj.driver.license?.number || null,
          licenseCategory: recordObj.driver.license?.category || null,
          isLicenseVerified: recordObj.driver.license?.verified || false,
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

// ✅ Get car record by ID with complete driver vehicle info
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
      .populate('createdBy', 'username email');

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "Car record not found",
      });
    }

    // Format response with complete vehicle information
    const response = record.toObject();
    if (response.driver) {
      const vehicleRegistration = response.driver.vehicle?.registrationNumber;
      const rcNumber = response.driver.rc?.number;
      
      response.driver.vehicleInfo = {
        // Vehicle specifications
        type: response.driver.vehicle?.type || null,
        brand: response.driver.vehicle?.brand || null,
        model: response.driver.vehicle?.model || null,
        
        // All registration numbers
        vehicleRegistrationNumber: vehicleRegistration || null,
        rcNumber: rcNumber || null,
        
        // Combined registration info
        registrationNumber: vehicleRegistration || rcNumber || null,
        hasRegistration: !!(vehicleRegistration || rcNumber),
        
        // Verification details
        isVehicleRegistered: !!vehicleRegistration,
        isRCVerified: response.driver.rc?.verified || false,
        isFullyVerified: (!!vehicleRegistration && response.driver.rc?.verified) || false,
        
        // License details
        license: {
          number: response.driver.license?.number || null,
          category: response.driver.license?.category || null,
          verified: response.driver.license?.verified || false,
        },
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

// ✅ Get all drivers with complete vehicle and RC information
export const getAllDriversWithVehicleInfo = async (req, res) => {
  try {
    const drivers = await Driver.find({ status: 'active' })
      .select('driverName email profile vehicle license rc status role')
      .sort({ driverName: 1 });

    const formattedDrivers = drivers.map(driver => {
      const driverObj = driver.toObject();
      const vehicleRegistration = driverObj.vehicle?.registrationNumber;
      const rcNumber = driverObj.rc?.number;
      
      return {
        _id: driverObj._id,
        driverName: driverObj.driverName,
        email: driverObj.email,
        profile: driverObj.profile,
        status: driverObj.status,
        role: driverObj.role,
        
        // Complete vehicle information
        vehicle: {
          type: driverObj.vehicle?.type || null,
          brand: driverObj.vehicle?.brand || null,
          model: driverObj.vehicle?.model || null,
          registrationNumber: vehicleRegistration || null,
        },
        
        // RC information
        rc: {
          number: rcNumber || null,
          verified: driverObj.rc?.verified || false,
        },
        
        // License information
        license: {
          number: driverObj.license?.number || null,
          category: driverObj.license?.category || null,
          verified: driverObj.license?.verified || false,
        },
        
        // Combined registration info
        registrationInfo: {
          primaryNumber: vehicleRegistration || rcNumber || null,
          vehicleRegistrationNumber: vehicleRegistration,
          rcNumber: rcNumber,
          hasValidRegistration: !!(vehicleRegistration || rcNumber),
          isFullyVerified: (!!vehicleRegistration && driverObj.rc?.verified) || false,
        }
      };
    });

    res.status(200).json({
      success: true,
      data: formattedDrivers,
      count: formattedDrivers.length,
    });
  } catch (error) {
    console.error("Error fetching drivers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers",
      error: error.message,
    });
  }
};

// ✅ Get car records by vehicle registration number or RC number
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
    
    // Find driver with matching registration number (either in vehicle or RC)
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

    // Build filter for car records
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
        .populate('createdBy', 'username email'),
      CarRecord.countDocuments(filter),
    ]);

    // Format driver info with complete registration details
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

// ✅ Get summary with vehicle registration info
export const getCarRecordSummary = async (req, res) => {
  try {
    const { startDate, endDate, carNumber } = req.query;

    // Build filter
    const filter = {};
    if (startDate && endDate) {
      filter.date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    if (carNumber) filter.carNumber = carNumber;

    // Aggregation pipeline with driver lookup
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
        $group: {
          _id: "$carNumber",
          totalTrips: { $sum: 1 },
          totalKm: { $sum: "$totalKm" },
          totalPetrolAmount: { $sum: "$petrol.amount" },
          totalMaintenanceAmount: { $sum: "$maintenance.amount" },
          averageKmPerTrip: { $avg: "$totalKm" },
          drivers: { $addToSet: "$driverInfo.driverName" },
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

// ✅ Update car record
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

    const updatedRecord = await CarRecord.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
      .populate({
        path: 'driver',
        select: 'driverName email vehicle license rc'
      })
      .populate('createdBy', 'username email');

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

// ✅ Delete car record
export const deleteCarRecord = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid record ID",
      });
    }

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

export const myRoutetripDriver = async (req, res) => {
  try {
    const driverId = req.driver._id;
    const { date } = req.query;

    let filter = {
      driver: driverId,
    };

    // optional date filter
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
      .populate("driver", "driverName email vehicle");

    // total km summary
    const totalKm = trips.reduce((sum, trip) => {
      return sum + (trip.totalKm || 0);
    }, 0);

    res.status(200).json({
      success: true,
      totalTrips: trips.length,
      totalKm,
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