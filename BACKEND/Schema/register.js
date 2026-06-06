import mongoose from "mongoose";
import bcrypt from "bcrypt";
import crypto from "crypto";

function generateRandomCartId() {
  // 9-digit cryptographically random id (was 6-digit Math.random — enumerable)
  return Number(crypto.randomInt(100000000, 999999999));
}

const userSchema = new mongoose.Schema({
  cartId: {
    type: Number,
    unique: true,
  },
  empId: {
    type: Number, // No need to make it unique
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
  panel: {
    type: String,
    default: "Employee",
    enum: ["Employee", "Branch Manager", "Shopkeeper"],
  },
  designation: {
    type: String,
  },
  mNumber: {
    type: String,
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

  if (!this.empId) {
    const lastUser = await registerUsers.findOne(
      {},
      {},
      { sort: { empId: -1 } }
    );
    if (lastUser) {
      this.empId = lastUser.empId + 1;
    } else {
      this.empId = 1;
    }
  }

  if (this.role === "branch manager") {
    this.isConfirmed = "approved";
  }

  if (this.isModified("password")) {
    const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;
    this.password = await bcrypt.hash(this.password, rounds);
  }

  next();
});

userSchema.methods.comparePassword = function comparePassword(plain) {
  if (!this.password) return false;
  // Self-heal: legacy plaintext rows are detected and reported as mismatch
  // unless the caller invokes `comparePasswordOrRehash` (login path).
  if (!this.password.startsWith("$2")) {
    return plain === this.password;
  }
  return bcrypt.compare(plain, this.password);
};

const registerUsers = mongoose.model("RegisterUsers", userSchema);

export default registerUsers;
