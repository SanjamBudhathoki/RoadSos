import express from "express";
import cors from "cors";
import userRouter from "./Routes/authRoutes.js";
import sosRouter from "./Routes/sosRoutes.js";
import aiRouter from "./Routes/aiRoutes.js";
import { Server } from "socket.io";
import http from "http";
import rateLimit from "express-rate-limit";

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true
}));

app.use(express.json());

// Rate limiter
const globalLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" }
});

app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  max: 20,
  message: { message: "Too many login attempts, please try again later" }
});

// Routes
app.use("/user", authLimiter, userRouter);
app.use("/sos", sosRouter);
app.use("/ai", aiRouter);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "RoadSOS Server Running",
    timestamp: new Date().toISOString()
  });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  console.log("Total connected clients:", io.engine.clientsCount);

  // Join SOS room for private communication
  socket.on("join-sos-room", (sosId) => {
    socket.join(`sos:${sosId}`);
    console.log(`User ${socket.id} joined room sos:${sosId}`);
  });

  // Leave SOS room
  socket.on("leave-sos-room", (sosId) => {
    socket.leave(`sos:${sosId}`);
    console.log(`User ${socket.id} left room sos:${sosId}`);
  });

  // Provider location update
  socket.on("provider:location-update", (data) => {
    console.log("Provider location received:", {
      sosId: data.sosId,
      coordinates: `${data.latitude}, ${data.longitude}`,
      from: socket.id
    });

    // Validate data before broadcasting
    if (!data.sosId || !data.latitude || !data.longitude) {
      console.error("Invalid location data:", data);
      return;
    }

    // Broadcast to ALL connected clients (or specific room)
    io.emit("provider:location-updated", {
      sosId: data.sosId,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude)
    });



    console.log(" Location broadcasted");
  });

  // SOS status updates
  socket.on("sos:statusUpdated", (data) => {
    console.log(" SOS status updated:", data);
    
    if (!data.sosId || !data.status) {
      console.error("Invalid status data:", data);
      return;
    }

    io.emit("sos:statusUpdated", {
      sosId: data.sosId,
      status: data.status
    });
  });

  // Provider arrived
  socket.on("provider-arrived", (data) => {
    console.log("Provider arrived:", data);
    
    if (!data.sosId) {
      console.error("Invalid arrival data:", data);
      return;
    }

    io.emit("provider-arrived", {
      sosId: data.sosId
    });
  });

  // New SOS alert
  socket.on("sos:new", (data) => {
    console.log("🆕 New SOS alert:", data?.sosId);
    socket.broadcast.emit("sos:new", data);
  });

  // SOS accepted
  socket.on("sos:accepted", (data) => {
    console.log(" SOS accepted:", data);
    socket.broadcast.emit("sos:accepted", data);
  });

  // SOS completed
  socket.on("sos:completed", (data) => {
    console.log("SOS completed:", data);
    socket.broadcast.emit("sos:completed", data);
  });

  // Handle disconnection
  socket.on("disconnect", (reason) => {
    console.log(" User disconnected:", socket.id, "Reason:", reason);
    console.log("Remaining clients:", io.engine.clientsCount - 1);
  });

  // Handle errors
  socket.on("error", (error) => {
    console.error(" Socket error:", error);
  });
});


app.set('io', io);

// Middleware to attach io to req
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Store server reference
app.server = server;

export { app, server, io };