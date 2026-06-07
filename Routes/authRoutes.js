import express from "express";
import { isProvider, isUser } from "../Middleware/authMiddleWare.js";
import {  deleteUserServices, editUserServices, getUserProfile, loginUserServices, registerService,  updateProviderAvailability } from "../controllers/authController.js";

const userRouter=express.Router();

console.log("user router initialized");

userRouter.post("/register",registerService);

userRouter.post("/login",loginUserServices);

userRouter.put("/update",isUser,editUserServices)

userRouter.get("/profile",isUser,getUserProfile);


userRouter.put("/provider/updateAvailability", isProvider,updateProviderAvailability);

//delete user
userRouter.delete("/delete/:id",isUser,deleteUserServices)






export default userRouter;