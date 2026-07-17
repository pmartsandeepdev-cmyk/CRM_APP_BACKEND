// index.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import connectDB from './src/db/index.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const httpServer = createServer(app);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:8081", 
    "http://localhost:5174",
    "http://localhost:5176",
    "https://admin.thepropmart.com",
    "http://localhost:8082",
    "http://localhost:19006",
    "http://localhost:19000",
];

const io = new Server(httpServer, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
        credentials: true,
    },
    transports: ['websocket', 'polling']
});

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Connect to Database
connectDB();

// ============ IMPORT MODELS ============
import { Driver } from './src/model/driver.model.js';
import { DriverLocation } from './src/model/driverLocation.model.js';
import { CarRecord } from './src/model/carRecodMomement.model.js';

// ============ IMPORT ROUTES ============
import adminRoutes from './src/routes/admin.routes.js';
import driverRoutes from './src/routes/driver.routes.js';
import driverLoginRoutes from './src/routes/driverLogin.routes.js';
import routedriverRoutes from './src/routes/carRecord.routes.js';
import attandenceRoutes from './src/routes/attendance.routes.js';
import staffRoutes from './src/routes/staff.routes.js';
import driverlivetrackingRoutes from './src/routes/driverLocation.routes.js';

// ============ MOUNT ROUTES ============
app.use('/admin', adminRoutes);
app.use('/driver', driverRoutes);
app.use('/driver-login', driverLoginRoutes);
app.use('/routedriver', routedriverRoutes);
app.use('/api/attendance', attandenceRoutes);
app.use('/staff', staffRoutes);
app.use('/driver-livetraking', driverlivetrackingRoutes);

// ==================== SOCKET.IO - CAR TRACKING ====================

// Store active drivers in memory
const activeDrivers = new Map();

// ============ GET ACTIVE VEHICLES FROM CAR RECORDS ============
const getActiveVehicles = async () => {
    try {
        console.log('🚗 Fetching active vehicles from CarRecord...');

        const activeTrips = await CarRecord.find({
            tripStatus: "active",
        })
            .populate({
                path: "driver",
                select: "driverName email vehicle profile status",
            })
            .populate({
                path: "drivertrakinglocation",
                select: "latitude longitude speed heading accuracy createdAt",
            })
            .populate({
                path: "staff",
                select: "name",
            })
            .sort({ createdAt: -1 });

        console.log(`📍 Found ${activeTrips.length} active trips`);

        const vehicles = activeTrips.map((trip) => {
            const driver = trip.driver;
            const location = trip.drivertrakinglocation;
            const staff = trip.staff;

            return {
                driverId: driver?._id || trip.driver,
                driverName: driver?.driverName || "Unknown Driver",
                email: driver?.email || "",
                vehicle: {
                    registrationNumber: trip.carNumber || "Unknown",
                    brand: driver?.vehicle?.brand || "",
                    model: driver?.vehicle?.model || "",
                    type: driver?.vehicle?.type || "",
                },
                staffName: staff?.name || trip.staffName || "",
                status: trip.tripStatus || "active",
                isActive: trip.tripStatus === "active",
                onDuty: trip.tripStatus === "active",
                tripId: trip._id,
                carNumber: trip.carNumber,
                currentLocation: location ? {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    speed: location.speed || 0,
                    heading: location.heading || 0,
                    accuracy: location.accuracy || 0,
                    updatedAt: location.createdAt || new Date(),
                } : null,
                lastUpdated: location?.createdAt || trip.startTime || new Date(),
                locationId: location?._id || null,
                startRoute: trip.startroute,
                endRoute: trip.endroute,
                movementPurpose: trip.movementPurpose,
                sector: trip.sector,
                source: 'carRecord'
            };
        });

        console.log(`✅ Returning ${vehicles.length} active vehicles`);
        return vehicles;

    } catch (error) {
        console.error('❌ Error fetching active vehicles:', error);
        return [];
    }
};

// ============ GET VEHICLES FROM DRIVER LOCATIONS (BACKUP) ============
const getVehiclesFromLocations = async () => {
    try {
        console.log('📍 Fetching from DriverLocation as backup...');

        const activeLocations = await DriverLocation.find({ isActive: true })
            .sort({ createdAt: -1 })
            .populate({
                path: 'driver',
                select: 'driverName email vehicle profile status'
            })
            .populate({
                path: 'trip',
                select: 'carNumber tripStatus staffName startroute endroute movementPurpose sector'
            });

        console.log(`📍 Found ${activeLocations.length} active locations`);

        const driverMap = new Map();

        activeLocations.forEach(loc => {
            const driverId = loc.driver?._id?.toString() || loc.driver?.toString();
            if (!driverId) return;

            if (!driverMap.has(driverId) ||
                new Date(loc.createdAt) > new Date(driverMap.get(driverId).lastUpdated)) {

                const trip = loc.trip;

                driverMap.set(driverId, {
                    driverId: driverId,
                    driverName: loc.driver?.driverName || "Unknown Driver",
                    email: loc.driver?.email || "",
                    vehicle: {
                        registrationNumber: trip?.carNumber || loc.driver?.vehicle?.registrationNumber || "Unknown",
                        brand: loc.driver?.vehicle?.brand || "",
                        model: loc.driver?.vehicle?.model || "",
                        type: loc.driver?.vehicle?.type || "",
                    },
                    staffName: trip?.staffName || "",
                    status: trip?.tripStatus || "active",
                    isActive: true,
                    onDuty: true,
                    tripId: trip?._id || loc.trip,
                    carNumber: trip?.carNumber || "Unknown",
                    currentLocation: {
                        latitude: loc.latitude,
                        longitude: loc.longitude,
                        speed: loc.speed || 0,
                        heading: loc.heading || 0,
                        accuracy: loc.accuracy || 0,
                        updatedAt: loc.createdAt || new Date(),
                    },
                    lastUpdated: loc.createdAt || new Date(),
                    locationId: loc._id,
                    startRoute: trip?.startroute || "",
                    endRoute: trip?.endroute || "",
                    movementPurpose: trip?.movementPurpose || "",
                    sector: trip?.sector || "",
                    source: 'driverLocation'
                });
            }
        });

        const drivers = Array.from(driverMap.values());
        console.log(`✅ Returning ${drivers.length} vehicles from DriverLocation backup`);
        return drivers;

    } catch (error) {
        console.error('❌ Error fetching from DriverLocation:', error);
        return [];
    }
};

// ============ MERGE VEHICLES FROM BOTH SOURCES ============
const getAllActiveVehicles = async () => {
    try {
        // Get from both sources
        const [vehiclesFromCarRecord, vehiclesFromLocation] = await Promise.all([
            getActiveVehicles(),
            getVehiclesFromLocations()
        ]);

        const mergedMap = new Map();

        // Add vehicles from CarRecord (primary source)
        vehiclesFromCarRecord.forEach(v => {
            const key = v.driverId?.toString() || v.tripId?.toString();
            if (key) {
                mergedMap.set(key, { ...v, source: 'carRecord' });
            }
        });

        // Add vehicles from DriverLocation (backup - only if not already present)
        vehiclesFromLocation.forEach(v => {
            const key = v.driverId?.toString() || v.tripId?.toString();
            if (key) {
                const existing = mergedMap.get(key);
                if (!existing) {
                    mergedMap.set(key, { ...v, source: 'driverLocation' });
                } else if (new Date(v.lastUpdated) > new Date(existing.lastUpdated)) {
                    // Update if location is newer
                    mergedMap.set(key, { ...v, source: 'driverLocation' });
                }
            }
        });

        const merged = Array.from(mergedMap.values());
        console.log(`✅ Total ${merged.length} active vehicles found`);
        return merged;

    } catch (error) {
        console.error('❌ Error merging vehicle data:', error);
        return [];
    }
};

// ==================== SOCKET.IO CONNECTION ====================

io.on("connection", (socket) => {
    console.log("✅ New client connected:", socket.id);

    // 1. JOIN ALL DRIVERS ROOM (Admin view)
    socket.on("join-all-drivers", async () => {
        socket.join('all-drivers');
        console.log(`📡 Socket ${socket.id} joined all-drivers room`);

        try {
            const vehicles = await getAllActiveVehicles();
            socket.emit("all-drivers-locations", { drivers: vehicles });
            console.log(`📤 Sent ${vehicles.length} vehicles to client`);
        } catch (error) {
            console.error("❌ Error sending vehicles data:", error);
            socket.emit("all-drivers-locations", { drivers: [] });
        }
    });

    // 2. DRIVER JOINS (Driver app)
    socket.on("join-driver", async (driverId) => {
        if (!driverId) {
            console.error("❌ No driverId provided");
            return;
        }

        socket.join(`driver-${driverId}`);
        console.log(`🚚 Driver ${driverId} joined room`);

        activeDrivers.set(driverId, {
            socketId: socket.id,
            lastLocation: null,
            lastUpdate: new Date()
        });

        socket.emit("driver-joined", {
            driverId,
            timestamp: new Date()
        });

        // Notify all-drivers room
        try {
            const vehicles = await getAllActiveVehicles();
            io.to('all-drivers').emit("all-drivers-locations", { drivers: vehicles });
        } catch (error) {
            console.error("❌ Error updating after driver join:", error);
        }
    });

    // 3. JOIN TRIP ROOM (For specific trip tracking)
    socket.on("join-trip", async (tripId) => {
        if (!tripId) {
            console.error("❌ No tripId provided");
            return;
        }

        socket.join(`trip-${tripId}`);
        console.log(`🚗 Socket joined trip-${tripId}`);

        try {
            const trip = await CarRecord.findById(tripId)
                .populate('driver', 'driverName email')
                .populate('drivertrakinglocation');

            if (trip) {
                socket.emit("trip-details", {
                    tripId: trip._id,
                    carNumber: trip.carNumber,
                    status: trip.tripStatus,
                    driver: trip.driver,
                    location: trip.drivertrakinglocation
                });
            }
        } catch (err) {
            console.error("❌ Error fetching trip:", err);
        }
    });

    // 4. DRIVER LOCATION UPDATE
    socket.on("driver-location-update", async (data) => {
        try {
            const { tripId, driverId, latitude, longitude, speed = 0, accuracy = 0 } = data;

            console.log(`📍 Location update - Driver: ${driverId}, Trip: ${tripId}`);

            // Update active drivers map
            activeDrivers.set(driverId, {
                socketId: socket.id,
                lastLocation: { latitude, longitude, speed, accuracy },
                lastUpdate: new Date()
            });

            // Save to DriverLocation
            const location = new DriverLocation({
                driver: driverId,
                trip: tripId,
                latitude,
                longitude,
                speed,
                heading: data.heading || 0,
                accuracy,
                isActive: true,
                locationTimestamp: new Date(),
                createdAt: new Date(),
            });

            await location.save();
            console.log(`✅ Location saved to database`);

            // Update CarRecord with latest location
            await CarRecord.findByIdAndUpdate(tripId, {
                drivertrakinglocation: location._id,
            });

            // Update Driver status
            await Driver.findByIdAndUpdate(driverId, {
                status: 'active',
                currentLocation: {
                    latitude,
                    longitude,
                    timestamp: new Date(),
                },
            });

            // Send confirmation to driver
            io.to(`driver-${driverId}`).emit("location-confirmed", {
                tripId,
                success: true,
                timestamp: new Date()
            });

            // Broadcast to trip room
            io.to(`trip-${tripId}`).emit("location-updated", {
                tripId,
                driverId,
                location: {
                    latitude,
                    longitude,
                    speed,
                    accuracy,
                    updatedAt: new Date()
                },
                timestamp: new Date()
            });

            // Broadcast to all-drivers room
            io.to('all-drivers').emit("driver-location-updated", {
                driverId,
                location: { latitude, longitude, speed, accuracy },
                timestamp: new Date(),
                tripId
            });

            // Update all vehicles data
            try {
                const vehicles = await getAllActiveVehicles();
                io.to('all-drivers').emit("all-drivers-locations", { drivers: vehicles });
            } catch (error) {
                console.error("❌ Error broadcasting updated vehicles:", error);
            }

        } catch (error) {
            console.error("❌ Location update error:", error);
            socket.emit("error", { message: "Failed to update location" });
        }
    });

    // 5. GET TRIP ROUTE HISTORY
    socket.on("get-trip-route", async (data) => {
        try {
            const { tripId } = data;

            const locations = await DriverLocation.find({ trip: tripId })
                .sort({ createdAt: 1 })
                .select('latitude longitude speed heading accuracy createdAt');

            socket.emit("trip-route", {
                tripId,
                route: locations
            });
        } catch (error) {
            console.error("❌ Error fetching trip route:", error);
        }
    });

    // 6. UPDATE DRIVER STATUS
    socket.on("update-driver-status", async (data) => {
        try {
            const { driverId, status } = data;

            await Driver.findByIdAndUpdate(driverId, {
                status,
                lastActiveAt: new Date()
            });

            // Broadcast status update
            io.to('all-drivers').emit("driver-status-updated", {
                driverId,
                status,
                timestamp: new Date()
            });

            // Update all vehicles data
            try {
                const vehicles = await getAllActiveVehicles();
                io.to('all-drivers').emit("all-drivers-locations", { drivers: vehicles });
            } catch (error) {
                console.error("❌ Error broadcasting updated vehicles:", error);
            }

        } catch (error) {
            console.error("❌ Error updating driver status:", error);
        }
    });

    // 7. REQUEST VEHICLES DATA
    socket.on("request-vehicles-data", async () => {
        try {
            const vehicles = await getAllActiveVehicles();
            socket.emit("all-drivers-locations", { drivers: vehicles });
        } catch (error) {
            console.error("❌ Error sending requested data:", error);
        }
    });

    // 8. DISCONNECT
    socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);

        for (const [driverId, data] of activeDrivers.entries()) {
            if (data.socketId === socket.id) {
                activeDrivers.delete(driverId);
                console.log(`👋 Removed driver ${driverId} from active list`);

                getAllActiveVehicles().then(vehicles => {
                    io.to('all-drivers').emit("all-drivers-locations", { drivers: vehicles });
                }).catch(error => {
                    console.error("❌ Error updating after disconnect:", error);
                });
                break;
            }
        }
    });

    // 9. PING-PONG
    socket.on("ping", () => {
        socket.emit("pong", { timestamp: new Date() });
    });
});

// ==================== PERIODIC UPDATES ====================

// Broadcast to all clients every 15 seconds
setInterval(async () => {
    try {
        const vehicles = await getAllActiveVehicles();
        io.to('all-drivers').emit("all-drivers-locations", { drivers: vehicles });
    } catch (error) {
        console.error("❌ Error in periodic update:", error);
    }
}, 15000);

// Clean up inactive drivers every 5 minutes
setInterval(() => {
    const now = new Date();
    const FIVE_MINUTES = 5 * 60 * 1000;
    let removedCount = 0;

    for (const [driverId, data] of activeDrivers.entries()) {
        if (now - data.lastUpdate > FIVE_MINUTES) {
            activeDrivers.delete(driverId);
            removedCount++;
        }
    }

    if (removedCount > 0) {
        console.log(`🕒 Removed ${removedCount} inactive drivers`);
    }
}, 300000);

// ==================== ROUTES ====================

app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: '🚀 Car Visit Tracking API is running',
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date(),
    });
});

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date(),
        service: 'Car Visit Tracking API',
        socketConnected: io.engine.clientsCount,
        activeDrivers: activeDrivers.size,
        allDriversRoom: io.sockets.adapter.rooms.get('all-drivers')?.size || 0
    });
});

app.set("io", io);

const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready for real-time car tracking`);
    console.log(`🚗 Car visit tracking system initialized`);
});