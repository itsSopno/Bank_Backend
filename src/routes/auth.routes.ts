import { Router } from "express";
import {
  register,
  login,
  getMe,
  setTransactionPin,
  logout,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  registerSchema,
  loginSchema,
  setPinSchema,
} from "../validators/auth.validators.js";

const router = Router();

// পাবলিক রাউটস
router.post("/register", validate(registerSchema), register);
router.post("/login", validate(loginSchema), login);

// প্রটেক্টেড রাউটস
router.get("/me", authenticate, getMe);
router.post("/set-pin", authenticate, validate(setPinSchema), setTransactionPin);
router.post("/logout", authenticate, logout);

export default router;
