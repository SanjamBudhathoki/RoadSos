import Joi from "joi";
import { User } from "../Model/userModule.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import {logger} from "../utils/logger.js"

//* Register User
export const registerService=async (req, res) => {
    // console.log("BODY:", req.body);
    try {
         // extract req.body
  const newUser = req.body;
   // console.log(newUser);
   // validate userData with joi
  const schema = Joi.object({
    email: Joi.string().email().required().trim().min(5).max(40).lowercase().regex( /^[a-zA-Z0-9]+@[a-zA-Z0-9]+(\.[a-zA-Z0-9]+)*$/),
    password: Joi.string().required().trim().min(4).max(20),
    address: Joi.string().required().trim().min(2).max(55),
    gender: Joi.string().required().valid("male", "female", "preferNotToSay"),
    firstName: Joi.string().required().trim().min(3).max(30),
    lastName: Joi.string().required().trim().min(3).max(30),
    role: Joi.string().valid("driver", "provider","admin").trim().required().lowercase(),
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
    return res.status(500).send({ message: "Internal Server Error" });
    }
}

//*Login User
export const loginUserServices=async (req, res) => {
  try {
      //   extract login credentials from req.body
 
    const loginCredentials = req.body;
  console.log(loginCredentials);
  //   validate login credentials
  const schemaLog =  Joi.object({
    email: Joi.string().email().required().trim().min(5).max(40).lowercase(),
    password: Joi.string().required().trim().min(4).max(20),
  });
  
  try {
    await schemaLog.validateAsync(loginCredentials);
  } catch (error) {
    // if error, throw error
    return res.status(400).send({ message: error.message });
  }
  //   find user by email
  const user = await User.findOne({ email: loginCredentials.email });

  // if not user, throw error
  if (!user) {
    return res.status(400).send({ message: "User Not Found" });
  }
  // password match check
  const passwordMatch = await bcrypt.compare(
    loginCredentials.password, //plain_password
    user.password, //hashed password
  );
  //   if not password match, throw error
  if (!passwordMatch) {
  return res.status(400).send({ message: "Invalid credentials." });
}

  //   generate a token
  const token = jwt.sign(
    { email: user.email },
    process.env.JWT_ACCESS_TOKEN_SECRET_KEY,
    {expiresIn:"1d"}
  )

  console.log(token);
  //   hide password
  user.password = undefined;
  // send appropriate response
  return res.status(200).send({ user, token });
  } catch (error) {
  logger.error("loginUserServices error", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
}

}

//* Edit User
export const editUserServices=async (req, res) => {
  try {
    // extract new values from req.body
  const updatedValues = req.body;

  const schema = Joi.object({
    gender: Joi.string().valid("male","female","preferNotToSay"),
    firstName: Joi.string().trim().min(3).max(30),
    lastName: Joi.string().trim().min(3).max(30),
    password: Joi.string().trim().min(4).max(20),
    address: Joi.string().trim().min(2).max(55),
    role: Joi.string().valid("driver","provider").trim(),
    phone: Joi.string().trim().min(10).max(10),
  });
  

  // validate new values
  try {
    await schema.validateAsync(updatedValues);
  } catch (error) {
    // if validation fails, terminate
    return res.status(400).send({ message: error.message });
  }

  // extract logged in user id from req.loggedInUser._id
  const userId = req.loggedInUser._id;

  //   hashPassword
let hashedPassword;
if (updatedValues.password) {
  hashedPassword = await bcrypt.hash(updatedValues.password, 10);
  // console.log(hashedPassword)
}
  //   update user data
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        password: hashedPassword,
        gender: updatedValues.gender,
        firstName: updatedValues.firstName,
        lastName: updatedValues.lastName,
        location: updatedValues.location,
        role:updatedValues.role,
        plan:updatedValues.plan,
      },
    },
  );

  // return res
  return res.status(200).send({ message: "Profile is updated successfully." });
  } catch (error) {
        logger.error("editUserServices error", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });
  }
  
}

//* Get user Profile
export const getUserProfile=async (req, res) => {
  try{
  // extract logged in user id from req.loggedInUser._id
  const userId = req.loggedInUser._id;
  // console.log(userId)
  const user = await User.findOne({ _id: userId });
  if(!user){
    throw new Error("User not found");
  }

   return res.status(200).json({
      _id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      address: user.address,
      gender: user.gender,
      isAvailable: user.isAvailable,
      currentLocation: user.currentLocation,
    });
  }catch(error){
    logger.error("getUserProfile error", { error: error.message });
    return res.status(500).json({ message: "Internal Server Error" });

  }
}

//*Update Provider Availability
export const updateProviderAvailability = async (req, res) => {

  const values = req.body;

  const schema = Joi.object({
    isAvailable: Joi.boolean().required(),// json input true false not True False
    coordinates: Joi.array()
      .items(Joi.number())
      .length(2)
      .optional()
  });

  try {
    await schema.validateAsync(values);
  } catch (error) {
    return res.status(400).json({
      message: error.message
    });
  }

  try {
    const userId = req.loggedInUser._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.role !== "provider") {
      return res.status(403).json({
        message: "Only providers can update availability"
      });
    }

    // Update availability
    user.isAvailable = values.isAvailable;

    // Update coordinates if provided
    if (values.coordinates) {
      user.currentLocation = { type: "Point", coordinates: values.coordinates };
    }

    await user.save();

    // Socket.IO broadcast
    const io = req.app.get("io");

    io.emit("provider:availability", {
      providerId: user._id,
      isAvailable: user.isAvailable,
      coordinates: user.coordinates
    });

    return res.status(200).json({
      message: "Availability updated successfully",
      provider: {
        id: user._id,
        isAvailable: user.isAvailable,
        coordinates: user.coordinates
      }
    });

  } catch (error) {
    console.error("Update Availability Error:", error);
    logger.error("updateProviderAvailability error", { error: error.message });
    return res.status(500).json({
      message: "Internal server error"
    });
  }
};

//* Delete User /Ban
export const deleteUserServices=async (req, res) => {
   try {
    
    if (!req.loggedInUser) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const user = req.loggedInUser;

    const result = await User.deleteOne({ _id: user._id });

    if (result.deletedCount === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.status(200).send({
      message: "Your account has been permanently deleted.",
    });

  } catch (err) {
    return res.status(500).send({ message: err.message });
    logger.error("deleteUserServices error", { error: error.message });

  }

}
