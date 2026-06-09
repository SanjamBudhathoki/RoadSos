import { logger } from "../utils/logger.js";

export function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    logger.info("Socket connected", { socketId: socket.id });

    // Client joins a room by role or userId
    socket.on("join:room", ({ room }) => {
      if (room) {
        socket.join(room);
        logger.info("Socket joined room", { socketId: socket.id, room });
      }
    });

    // Provider joins their own room to receive targeted notifications
    socket.on("provider:join", ({ providerId }) => {
      if (providerId) {
        socket.join(`provider:${providerId}`);
        logger.info("Provider socket registered", { providerId });
      }
    });

    // Admin joins admin room
    socket.on("admin:join", () => {
      socket.join("admin");
      logger.info("Admin socket registered", { socketId: socket.id });
    });

    socket.on("disconnect", () => {
      logger.info("Socket disconnected", { socketId: socket.id });
    });
  });

  // ── Exported helpers used by controllers ───────────────────────────────────

  /**
   * Emit sos:new to all connected clients (providers + admin dashboard)
   */
  io.emitNewSOS = (sosData) => {
    io.emit("sos:new", sosData);
  };

  /**
   * Emit sos:priority only for HIGH / CRITICAL — to admin room and all providers
   */
  io.emitPrioritySOS = (sosData) => {
    io.emit("sos:priority", sosData);
    io.to("admin").emit("sos:priority", sosData);
  };

  logger.info("Socket handlers initialized");
}
