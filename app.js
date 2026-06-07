import express from "express";
import cors from "cors";
import userRouter from "./Routes/authRoutes.js";
import { Server } from "socket.io";
import http from "http";

const app=express();
//Cor//? Cors config fror sockect and express left
app.use(cors());
app.use(express.json());

//* Firstime using rateLimit() from express-rate-limit
import rateLimit from "express-rate-limit";
import sosRouter from "./Routes/sosRoutes.js";

const globalLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minute 
  max: 100, // Limit each IP to 100 requests per `window` 
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers    
  message:{message:"Too many request, plase try again after 1 minute"}
});

app.use(globalLimiter);

const authLimiter= rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minute 
  max:20, // Limit each IP 
  message:{message:"Too many request, plase try again after 1 minute"}
})

//* impoet userRouter
app.use("/user",authLimiter,userRouter);


//* import sosRouter
app.use("/sos",sosRouter);


//*Socket Io
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

app.set('io',io)



export default app;