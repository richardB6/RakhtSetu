import { connectToDatabase } from '@/lib/db/mongodb';
import { AuditLog } from '@/models/AuditLog';

export async function createAuditLog(data: {
  userId: string;
  userRole: string;
  userName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  previousState?: any;
  newState?: any;
  metadata?: {
    ipAddress?: string;
    userAgent?: string;
  };
}) {
  await connectToDatabase();
  
  const log = await AuditLog.create(data);
  return log;
}

export async function getAuditLogs(filters?: {
  entityType?: string;
  entityId?: string;
  userId?: string;
  action?: string;
  dateRange?: { start: Date; end: Date };
  page?: number;
  limit?: number;
}) {
  await connectToDatabase();

  const query: any = {};

  if (filters?.entityType) query.entityType = filters.entityType;
  if (filters?.entityId) query.entityId = filters.entityId;
  if (filters?.userId) query.userId = filters.userId;
  if (filters?.action) query.action = filters.action;
  
  if (filters?.dateRange) {
    query.createdAt = {
      $gte: filters.dateRange.start,
      $lte: filters.dateRange.end
    };
  }

  const page = filters?.page || 1;
  const limit = filters?.limit || 50;
  const skip = (page - 1) * limit;

  const logs = await AuditLog.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await AuditLog.countDocuments(query);

  return {
    data: logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

export async function getEntityTimeline(entityType: string, entityId: string) {
  await connectToDatabase();

  const logs = await AuditLog.find({ entityType, entityId })
    .sort({ createdAt: 1 }); // chronological

  return logs;
}
