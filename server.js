import express from "express";
import {app,io,server} from "./app.js";
import { dbConnect } from "./config/dbConnect.js";

const port=process.env.PORT;

await dbConnect();


server.listen(port,()=>{
    console.log(`Server Listening on port :${port}`)
})
