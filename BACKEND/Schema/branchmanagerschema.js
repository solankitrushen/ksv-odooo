import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

function generateRandomCartId() {
  return Number(crypto.randomInt(100000000, 999999999));
}
const userSchema = new mongoose.Schema({
  cartId: {
    type: Number,
    unique: true,
  },
  branchManagerId: {
    type: String,
    default: generateRandomCartId,
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  fullName: {
    type: String,
    required: true,
  },
  dept: {
    type: String,
    required: true,
  },

  mNumber: {
    type: String,
    unique: true,

    validate: {
      validator: function (value) {
        return value.length <= 10;
      },
      message: "mNumber cannot be longer than 10 characters",
    },
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    select: false,
  },
  isConfirmed: {
    type: String,
    enum: ["approved", "declined", "pending"],
    default: "pending",
  },
  verified: {
    type: Boolean,
    default: false,
    required: true,
  },
});
userSchema.pre("save", async function (next) {
  if (!this.cartId) {
    this.cartId = generateRandomCartId();
  }
  if (this.isModified("password")) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
    this.password = await bcrypt.hash(this.password, rounds);
  }
  next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.password) return false;
  if (!this.password.startsWith("$2")) {
    return plain === this.password;
  }
  return bcrypt.compare(plain, this.password);
};

const registerBranchUser = mongoose.model("registerBranchUser", userSchema);

export default registerBranchUser;
