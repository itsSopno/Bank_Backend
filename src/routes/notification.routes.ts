import { Router } from "express";
import {
  getMyNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../controllers/notification.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// নোটিফিকেশন লিস্ট
router.get("/", authenticate, getMyNotifications);

// সব নোটিফিকেশন Read মার্ক করা
router.patch("/read-all", authenticate, markAllNotificationsAsRead);

// নির্দিষ্ট নোটিফিকেশন Read মার্ক করা
router.patch("/:id/read", authenticate, markNotificationAsRead);

export default router;
