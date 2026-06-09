import jwt from "jsonwebtoken";
import { User } from "../Model/userModule.js";


const resolveUser = async (req) => {
       // 1.extract token from headers
// token is in req.headers.authorization in format "Bearer eyJhbGciOiJIUzI1NiIsInR....."
// {
// we have to split the string by space (" ")
// it returns array with two elements ["Bearer","eyJhbGciOiJIUzI1NiIsInR....."]
// token  = splittedArray[1]
// }
  const authorization = req.headers?.authorization;
  const token = authorization?.startsWith("Bearer ")
  
    ? authorization.split(" ")[1]
    : null;

  if (!token) throw new Error("Unauthorized");

  // 2. decrypt the token with jwt.verify(token,secretKey)
const userData= jwt.verify(token,process.env.JWT_ACCESS_TOKEN_SECRET_KEY);
// decrypted value gives the unique information we have put during encryption
    // find user from email decrypted from token
// let us suppose we had put email in token
// after decryption, we get that user email

  const user = await User.findOne({ email: decoded.email });
  if (!user) throw new Error("Unauthorized");

  return user;
};



//* Is loggedIn user
export const isUser=async(req,res,next)=>{
    try {
    // add user to req.userInfo
req.loggedInUser=await resolveUser(req);
// if user is found, let him use other service/call next function
next();
    } catch (error) {
    return res.status(401).send({ message: "Unauthorized." });
        
    }
};

//* Admin Authectiation
export const isAdmin = async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (user.role !== "admin") throw new Error("Forbidden");
    req.loggedInUser = user;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized." });
  }
};

//* Provider Authenciation
export const isProvider = async (req, res, next) => {
  try {
    const user = await resolveUser(req);
    if (user.role !== "provider") throw new Error("Forbidden");
    req.loggedInUser = user;
    next();
  } catch {
    return res.status(401).json({ message: "Unauthorized." });
  }
};