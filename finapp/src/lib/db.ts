import mongoose from "mongoose";
import { ConnectOptions } from "mongoose";

const uri = process.env.MONGODB_URI;

export async function connectToDB() {
  if (!uri) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    } as ConnectOptions); // Add 'as ConnectOptions' to specify the type
    console.log("MongoDB is connected");
  } catch (err) {
    console.error("Error in DB connection: " + err);
  }
}
