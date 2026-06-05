import mongoose from "mongoose"
import dns from 'node:dns';
dns.setServers(['8.8.8.8', '8.8.4.4']); 

export const dbConnect= async()=>{
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log("DataBase connected Successfully")
    } catch (error) {
        console.log("DataBase Connection Failed")
    }
}