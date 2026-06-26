import { logger } from "../utils/logger.js";



export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    logger.info("Socket connected", { socketId: socket.id });

    // General room join (role-based rooms: "users", "providers", etc.)
    socket.on("join:room", ({ room }) => {
      if (room) {
        socket.join(room);
        logger.info("Socket joined room", { socketId: socket.id, room });
      }
    });

    // user joins their personal room to receive targeted notifications
    socket.on("user:join", ({ userId }) => {
      if (userId) {
        socket.join(`user:${userId}`);
        logger.info("user socket registered", { userId });
      }
    });

    // Provider joins their personal room
    socket.on("provider:join", ({ providerId }) => {
      if (providerId) {
        socket.join(`provider:${providerId}`);
        logger.info("Provider socket registered", { providerId });
      }
    });

    // Admin joins the admin broadcast room
    socket.on("admin:join", () => {
      socket.join("admin");
      logger.info("Admin socket registered", { socketId: socket.id });
    });

    socket.on(
  "provider-location",
  (data) => {

    io.emit(
      "provider-location-updated",
      data
    );

  }
);

// In socketHandler.js
socket.on("provider:location-update" || "provider-location", (data) => {
  const { sosId, latitude, longitude } = data;
  
  // Broadcast to the user who created this SOS
  io.emit("provider:location-updated", {
    sosId,
    latitude: Number(latitude),   // Ensure these are numbers
    longitude: Number(longitude), // Not strings
  });
});

    socket.on("disconnect", () => {
      logger.info("Socket disconnected", { socketId: socket.id });
    });
  });

  logger.info("Socket handlers initialized");
}

