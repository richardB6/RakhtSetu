import { connectToDatabase } from '@/lib/db/mongodb';
import { Notification } from '@/models/Notification';
import mongoose from 'mongoose';
import { NotificationType, NotificationSeverity } from '@/types';

export async function createNotification(data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: NotificationSeverity;
  referenceType?: string;
  referenceId?: string;
}) {
  await connectToDatabase();

  const notificationData = {
    ...data,
    channel: 'IN_APP',
    deliveryStatus: 'DELIVERED',
    isRead: false
  };

  const notification = await Notification.create(notificationData);
  return notification;
}

export async function getNotifications(userId: string, filters?: {
  isRead?: boolean;
  severity?: NotificationSeverity;
  type?: NotificationType;
  page?: number;
  limit?: number;
}) {
  await connectToDatabase();

  const query: any = { userId };
  
  if (filters?.isRead !== undefined) query.isRead = filters.isRead;
  if (filters?.severity) query.severity = filters.severity;
  if (filters?.type) query.type = filters.type;

  const page = filters?.page || 1;
  const limit = filters?.limit || 20;
  const skip = (page - 1) * limit;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Notification.countDocuments(query);

  return {
    data: notifications,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getUnreadCount(userId: string) {
  await connectToDatabase();
  return await Notification.countDocuments({ userId, isRead: false });
}

export async function markAsRead(notificationId: string, userId: string) {
  await connectToDatabase();

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() },
    { new: true }
  );

  if (!notification) {
    throw new Error('Notification not found or does not belong to user');
  }

  return notification;
}

export async function markAllAsRead(userId: string) {
  await connectToDatabase();

  const result = await Notification.updateMany(
    { userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return result.modifiedCount;
}
