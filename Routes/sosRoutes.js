import express from "express";
import Joi from "joi";
import { SosRequest } from "../Model/sosModule.js";

const sosRouter=express.Router();
console.log("Sos Router Initalized")

sosRouter.post("/create",async(req,res)=> {
    const input=req.body;
    
    const schema=Joi.object({
        emergencyType:Joi.string().required().trim().valid(["medical","police","towing","general"]).lowercase(),
        coordinates:Joi.array({min:2,max:2}).required(),
        notes:Joi.string().optional().trim().min(10).max(500),
    });
    try {
        await schema.validateAsync(input)
    } catch (error) {
        return res.status(400).json({error:error.details[0].message})
    };

    const sos = await SosRequest.create({
        driverId: req.user._id,
        emergencyType: input.emergencyType,
        notes: input.notes,
        location: {
            type:"Point",
            coordinates: input.coordinates
        },
        statusHistory:[{status:"PENDING",changedBy:req.user._id }]
    })

})


export default sosRouter;