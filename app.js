import express from "express";
import cors from "cors";
import userRouter from "./Routes/authRoutes.js";
const app=express();
//Cor//? Cors config fror sockect and express left
app.use(cors());
app.use(express.json());

//* import SosRouter

//* impoet userRouter
app.use("/user",userRouter);


export default app;