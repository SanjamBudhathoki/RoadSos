import mongoose from "mongoose"
import {logger} from "../utils/logger.js"
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); 

export const dbConnect= async()=>{
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log("DataBase connected Successfully");
    logger.info("Database connected successfully");

    } catch (error) {
        console.log("DataBase Connection Failed");
            logger.error("Database connection failed", { error: error.message });
    process.exit(1);
    }
}