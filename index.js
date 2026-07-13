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
    "http://localhost:19006",  // Expo web default
    "http://localhost:19000",  // Expo dev
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

// At the top of your index.js, after other imports
import adminRoutes from './src/routes/admin.routes.js';
import driverRoutes from './src/routes/driver.routes.js';
import driverLoginRoutes from './src/routes/driverLogin.routes.js'
import routedriverRoutes  from './src/routes/carRecord.routes.js'
import attandenceRoutes from './src/routes/attendance.routes.js'
import staffRoutes  from './src/routes/staff.routes.js'
import driverlivetrackingRoutes from './src/routes/driverLocation.routes.js'

// Make sure these are mounted correctly
app.use('/admin', adminRoutes);
app.use('/driver', driverRoutes);
app.use('/driver-login' , driverLoginRoutes); 
app.use('/routedriver' , routedriverRoutes);
app.use('/api/attendance', attandenceRoutes)
app.use('/staff', staffRoutes)
app.use('/driver-livetraking', driverlivetrackingRoutes)
// ==================== SOCKET.IO ====================

//  Store active drivers in memory
const activeDrivers = new Map(); // driverId -> { socketId, lastLocation, orderId }

// Function to get all drivers locations
const getAllDriversLocations = async () => {
    try {
        const drivers = await Driver.find({ status: 'active' })
            .select('driverName email vehicle status')
            .lean();

        const driversWithLocations = await Promise.all(
            drivers.map(async (driver) => {
                // Get driver's active order
                const activeOrder = await OrderDispatch.findOne({
                    'driver.driverId': driver._id,
                    status: { $in: ['Accepted', 'In Transit', 'Out for Delivery'] }
                })
                .select('trackingNumber status customer liveTracking')
                .lean();

                let currentLocation = null;
                let isActive = false;
                let lastUpdated = null;

                // Check if driver is in active drivers map
                const activeDriver = activeDrivers.get(driver._id.toString());
                if (activeDriver) {
                    currentLocation = activeDriver.lastLocation;
                    isActive = true;
                    lastUpdated = activeDriver.lastUpdate;
                } else if (activeOrder?.liveTracking?.currentLocation) {
                    currentLocation = activeOrder.liveTracking.currentLocation;
                    lastUpdated = activeOrder.liveTracking.lastUpdated;
                }

                return {
                    driverId: driver._id,
                    driverName: driver.driverName,
                    email: driver.email,
                    vehicle: driver.vehicle,
                    status: driver.status,
                    isActive,
                    onDuty: isActive,
                    currentOrder: activeOrder,
                    currentLocation,
                    lastUpdated
                };
            })
        );

        return driversWithLocations;
    } catch (error) {
        console.error('Error fetching drivers locations:', error);
        return [];
    }
};

io.on("connection", (socket) => {
    console.log("✅ New client connected:", socket.id);

    // 1. JOIN ALL DRIVERS ROOM (For admin/global view)
    socket.on("join-all-drivers", () => {
        socket.join('all-drivers');
        console.log(`📡 Socket ${socket.id} joined all-drivers room`);
        
        // Send current drivers data immediately
        getAllDriversLocations().then(drivers => {
            socket.emit("all-drivers-locations", { drivers });
        });
    });

    // 2. DRIVER JOINS
    socket.on("join-driver", async (driverId) => {
        if (!driverId) {
            console.error("❌ No driverId provided");
            return;
        }
        
        socket.join(`driver-${driverId}`);
        console.log(`🚚 Driver ${driverId} joined room`);
        
        // Add to active drivers map
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
        getAllDriversLocations().then(drivers => {
            io.to('all-drivers').emit("all-drivers-locations", { drivers });
        });
    });

    // 3. JOIN ORDER ROOM
    socket.on("join-order", async (orderId) => {
        if (!orderId) {
            console.error("❌ No orderId provided");
            return;
        }
        
        socket.join(`order-${orderId}`);
        console.log(`📦 Socket joined order-${orderId}`);
        
        try {
            const order = await OrderDispatch.findById(orderId);
            if (order) {
                socket.emit("order-details", {
                    orderId: order._id,
                    status: order.status,
                    trackingNumber: order.trackingNumber,
                    customer: order.customer,
                    liveTracking: order.liveTracking
                });
            }
        } catch (err) {
            console.error("Error fetching order:", err);
        }
    });

    // 4. DRIVER LOCATION UPDATE
    socket.on("driver-location-update", async (data) => {
        try {
            const { orderId, driverId, latitude, longitude, speed = 0, accuracy = 0 } = data;
            
            console.log(`📍 Driver location update for order ${orderId}`);

            // Update active drivers map
            activeDrivers.set(driverId, {
                socketId: socket.id,
                lastLocation: { latitude, longitude, speed, accuracy },
                lastUpdate: new Date()
            });

            // Update in database
            const order = await OrderDispatch.findOneAndUpdate(
                { _id: orderId, "driver.driverId": driverId },
                {
                    "liveTracking.isActive": true,
                    "liveTracking.currentLocation": {
                        latitude,
                        longitude,
                        speed,
                        accuracy,
                        updatedAt: new Date()
                    },
                    "liveTracking.lastUpdated": new Date(),
                    $push: {
                        "liveTracking.locationHistory": {
                            latitude,
                            longitude,
                            speed,
                            accuracy,
                            timestamp: new Date()
                        }
                    }
                },
                { new: true }
            );

            if (!order) {
                socket.emit("error", { message: "Order not found" });
                return;
            }

            console.log(`✅ Database updated for order ${orderId}`);

            // Broadcast to order room
            io.to(`order-${orderId}`).emit("location-updated", {
                orderId,
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

            // Send confirmation to driver
            io.to(`driver-${driverId}`).emit("location-confirmed", {
                orderId,
                success: true,
                timestamp: new Date()
            });

            // Broadcast individual driver update to all-drivers room
            io.to('all-drivers').emit("driver-location-updated", {
                driverId,
                location: { latitude, longitude, speed, accuracy },
                timestamp: new Date(),
                orderId
            });

            // Update all drivers data
            getAllDriversLocations().then(drivers => {
                io.to('all-drivers').emit("all-drivers-locations", { drivers });
            });

        } catch (error) {
            console.error("❌ Location update error:", error);
            socket.emit("error", { message: "Failed to update location" });
        }
    });

    // 5. GET DRIVER ROUTE HISTORY
    socket.on("get-driver-route-history", async (data) => {
        try {
            const { driverId, orderId } = data;
            
            const order = await OrderDispatch.findOne({
                _id: orderId,
                'driver.driverId': driverId
            }).select('liveTracking.locationHistory');
            
            if (order && order.liveTracking?.locationHistory) {
                socket.emit("driver-route-history", {
                    driverId,
                    orderId,
                    route: order.liveTracking.locationHistory
                });
            }
        } catch (error) {
            console.error("Error fetching driver route:", error);
        }
    });

    // 6. GET LOCATION HISTORY
    socket.on("get-location-history", async (data) => {
        try {
            const { orderId } = data;
            const order = await OrderDispatch.findById(orderId);
            
            if (order && order.liveTracking) {
                socket.emit("location-history", {
                    orderId,
                    history: order.liveTracking.locationHistory || []
                });
            }
        } catch (error) {
            console.error("Error fetching location history:", error);
        }
    });

    // 7. UPDATE DRIVER STATUS
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
            
            // Update all drivers data
            getAllDriversLocations().then(drivers => {
                io.to('all-drivers').emit("all-drivers-locations", { drivers });
            });
            
        } catch (error) {
            console.error("Error updating driver status:", error);
        }
    });

    // 8. REQUEST DRIVERS DATA
    socket.on("request-drivers-data", () => {
        getAllDriversLocations().then(drivers => {
            socket.emit("all-drivers-locations", { drivers });
        });
    });

    // 9. DISCONNECT
    socket.on("disconnect", () => {
        console.log("❌ Client disconnected:", socket.id);
        
        // Remove from active drivers map
        for (const [driverId, data] of activeDrivers.entries()) {
            if (data.socketId === socket.id) {
                activeDrivers.delete(driverId);
                console.log(`👋 Removed driver ${driverId} from active list`);
                
                // Notify all-drivers room
                getAllDriversLocations().then(drivers => {
                    io.to('all-drivers').emit("all-drivers-locations", { drivers });
                });
                break;
            }
        }
    });

    // 10. PING-PONG for connection health
    socket.on("ping", () => {
        socket.emit("pong", { timestamp: new Date() });
    });
});

// ==================== PERIODIC UPDATES ====================


// Clean up inactive drivers every 5 minutes
setInterval(() => {
    const now = new Date();
    const FIVE_MINUTES = 5 * 60 * 1000;
    
    for (const [driverId, data] of activeDrivers.entries()) {
        if (now - data.lastUpdate > FIVE_MINUTES) {
            activeDrivers.delete(driverId);
            console.log(`🕒 Removed inactive driver ${driverId}`);
        }
    }
}, 300000);

// ------------------ ROUTES ------------------




// ------------------ ROOT ROUTE ------------------
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: '🚀 HardikExport Backend API is running',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date(),
    endpoints: {
      health: '/health',
      drivers: '/api/drivers/locations',
      socket: 'Socket.IO enabled'
    }
  });
});
// Health check
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        timestamp: new Date(),
        service: 'Order Dispatch API',
        socketConnected: io.engine.clientsCount,
        activeDrivers: activeDrivers.size,
        allDriversRoom: io.sockets.adapter.rooms.get('all-drivers')?.size || 0
    });
});

app.set("io", io);



const PORT = process.env.PORT || 8080;
httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server Running on http://localhost:${PORT}`);
    console.log(`📡 WebSocket server ready for real-time tracking`);
    console.log(`👨‍✈️ Active drivers tracking system initialized`);
});