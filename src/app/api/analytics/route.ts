import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/withAuth';
import { getDashboardStats } from '@/lib/services/emergency.service';
import { connectToDatabase } from '@/lib/db/mongodb';
import { EmergencyRequest } from '@/models/EmergencyRequest';

export const GET = withAuth(async (req, context) => {
  try {
    await connectToDatabase();
    
    const stats = await getDashboardStats();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const byDay = await EmergencyRequest.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const bySeverity = await EmergencyRequest.aggregate([
      {
        $group: {
          _id: "$severity",
          count: { $sum: 1 }
        }
      }
    ]);

    const byComponent = await EmergencyRequest.aggregate([
      {
        $group: {
          _id: "$component",
          count: { $sum: 1 }
        }
      }
    ]);

    const byBloodGroup = await EmergencyRequest.aggregate([
      {
        $group: {
          _id: "$bloodGroup",
          count: { $sum: 1 }
        }
      }
    ]);

    const analyticsData = {
      ...stats,
      byDay,
      bySeverity,
      byComponent,
      byBloodGroup
    };

    return NextResponse.json({ success: true, data: analyticsData });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}, { roles: ['ADMIN', 'HOSPITAL', 'BLOOD_BANK'] });
