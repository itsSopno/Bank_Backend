import type { Request, Response } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../config/server.js";
import { notifications } from "../db/schema.js";

/**
 * ১. কাস্টমার বা ইউজারের সকল নোটিফিকেশন দেখা
 */
export const getMyNotifications = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const userNotifications = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(30);

    const [unreadCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, req.user.id),
          eq(notifications.isRead, false)
        )
      );

    res.status(200).json({
      success: true,
      notifications: userNotifications,
      unreadCount: Number(unreadCount.count),
    });
  } catch (error) {
    console.error("Get Notifications Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error fetching notifications.",
    });
  }
};

/**
 * ২. নোটিফিকেশন Read মার্ক করা
 */
export const markNotificationAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const notificationId = parseInt(req.params.id as string, 10);

    const [updated] = await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, req.user.id)
        )
      )
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Notification not found." });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Notification marked as read.",
    });
  } catch (error) {
    console.error("Mark Read Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error updating notification.",
    });
  }
};

/**
 * ৩. সব নোটিফিকেশন এক ক্লিকে Read মার্ক করা
 */
export const markAllNotificationsAsRead = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, req.user.id),
          eq(notifications.isRead, false)
        )
      );

    res.status(200).json({
      success: true,
      message: "All notifications marked as read.",
    });
  } catch (error) {
    console.error("Mark All Read Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error updating notifications.",
    });
  }
};

