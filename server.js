import express from "express";
import app from "./app.js";
import { dbConnect } from "./config/dbConnect.js";

const port=process.env.PORT;

await dbConnect();


app.listen(port,()=>{
    console.log(`Server Listening on port :${port}`)
})
