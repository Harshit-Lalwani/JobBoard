import mongoose from "mongoose";

const { Schema } = mongoose;

export const USER_ROLES = ["poster", "applicant"];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
    },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, required: true },
    refreshTokenHash: { type: String, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

export const User = mongoose.model("User", userSchema);
