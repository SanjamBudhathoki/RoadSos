import express from "express";
import Joi from "joi";
import bcrypt from "bcrypt";
import { User } from "../Model/UserModule.js";
// import asyncHandler from "../utils/asynchHandler.js";

const userRouter=express.Router()

console.log("user router initialized");

userRouter.post("/register",async (req, res) => {
    // console.log("BODY:", req.body);
    try {
         // extract req.body
  const newUser = req.body;
   // console.log(newUser);
   // validate userData with joi
  const schema = Joi.object({
    email: Joi.string().email().required().trim().min(5).max(40).lowercase().regex( /^[a-zA-Z0-9]+@[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/),
    password: Joi.string().required().trim().min(4).max(20),
    location: Joi.string().required().trim().min(2).max(55),
    gender: Joi.string().required().valid("male", "female", "preferNotToSay"),
    firstName: Joi.string().required().trim().min(3).max(30),
    lastName: Joi.string().required().trim().min(3).max(30),
    role: Joi.string().valid("driver", "provider","admin").trim().required(),
    isAvailable: Joi.boolean(),
    phone: Joi.string().required().trim().min(10).max(10),
  });

  try {
    await schema.validateAsync(newUser);
  } catch (error) {
     // if !valid,terminate
    return res.status(400).send({ message: error.message });
  }
   //check if user email already exists
  const user = await User.findOne({ email: newUser.email });
   //if yes,terminate
  if (user) {
    return res
      .status(401)
      .send({ message: "User with this Email already exists" });
  }
   // hash password using bcrypt.hash()
  const hashedPassword = await bcrypt.hash(newUser.password, 10);
   // replace password with hash
  newUser.password = hashedPassword;
   // create user
  await User.create(newUser);
   // send response
  return res.status(201).send({ message: "User has been added to server" });

    } catch (error) {  
        return res.status(500).send({
    message: error.message,
    });
    next(error)
    }
  
});









export default userRouter;