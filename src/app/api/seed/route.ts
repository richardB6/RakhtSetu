import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/mongodb';
import { User } from '@/models/User';
import { Hospital } from '@/models/Hospital';
import { BloodBank } from '@/models/BloodBank';
import { Donor } from '@/models/Donor';
import { EmergencyRequest } from '@/models/EmergencyRequest';
import { Match } from '@/models/Match';
import { Inventory } from '@/models/Inventory';
import { Notification } from '@/models/Notification';
import { AuditLog } from '@/models/AuditLog';
import { Escalation } from '@/models/Escalation';
import { hashPassword } from '@/lib/auth/password';
import { BLOOD_GROUPS, COMPONENT_TYPES, SEVERITY_LEVELS } from '@/lib/engine/compatibility';

// Maharashtra Locations
const HOSPITALS = [
  { name: 'KEM Hospital, Mumbai', coords: [72.8420, 19.0003] },
  { name: 'Sassoon General Hospital, Pune', coords: [73.8743, 18.5320] },
  { name: 'JJ Hospital, Mumbai', coords: [72.8335, 18.9631] },
  { name: 'Ruby Hall Clinic, Pune', coords: [73.8803, 18.5354] },
  { name: 'Lilavati Hospital, Mumbai', coords: [72.8276, 19.0511] },
  { name: 'AIIMS Nagpur', coords: [79.0500, 21.1465] },
  { name: 'Wockhardt Hospital, Mumbai', coords: [72.8347, 19.0176] },
  { name: 'Deenanath Mangeshkar Hospital, Pune', coords: [73.8358, 18.5024] },
];

const BLOOD_BANKS = [
  { name: 'Maharashtra State Blood Bank, Mumbai', coords: [72.8362, 18.9401] },
  { name: 'Jeevan Jyoti Blood Bank, Pune', coords: [73.8564, 18.5196] },
  { name: 'Indian Red Cross Blood Bank, Mumbai', coords: [72.8312, 18.9387] },
  { name: 'Jankalyan Blood Bank, Mumbai', coords: [72.8540, 19.0170] },
  { name: 'Sasoon Blood Bank, Pune', coords: [73.8745, 18.5318] },
  { name: 'Niramaya Blood Bank, Nagpur', coords: [79.0882, 21.1458] },
  { name: 'LifeLine Blood Bank, Mumbai', coords: [72.8777, 19.0760] },
  { name: 'Prathama Blood Centre, Thane', coords: [72.9781, 19.1860] },
  { name: 'Sahyadri Blood Bank, Pune', coords: [73.8077, 18.5089] },
  { name: 'Kokilaben Blood Bank, Mumbai', coords: [72.8278, 19.1315] },
  { name: 'Aditya Blood Bank, Nashik', coords: [73.7898, 19.9975] },
  { name: 'Unity Blood Bank, Aurangabad', coords: [75.3433, 19.8762] },
];

const INDIAN_NAMES = [
  'Rahul Sharma', 'Priya Patel', 'Amit Kumar', 'Sneha Desai', 'Vikram Singh',
  'Anjali Gupta', 'Rohan Joshi', 'Pooja Reddy', 'Karan Malhotra', 'Neha Verma',
  'Sanjay Kulkarni', 'Kavita Nair', 'Rajesh Chawla', 'Meera Iyer', 'Arun Menon',
  'Sunita Rao', 'Deepak Mehta', 'Anitha Pillai', 'Manoj Das', 'Divya Ahuja',
  'Suresh Patil', 'Swati Bhat', 'Vijay Soni', 'Shilpa Thakur', 'Nitin Jain',
  'Aarti Bansal', 'Rakesh Mishra', 'Rekha Chatterjee', 'Gaurav Dubey', 'Priyanka Kapoor'
];

function getRandomElement<T>(arr: T[] | readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'Seeding is not allowed in production unless DEMO_MODE is true.' }, { status: 403 });
  }

  try {
    await connectToDatabase();

    // Clear all collections
    await User.deleteMany({});
    await Hospital.deleteMany({});
    await BloodBank.deleteMany({});
    await Donor.deleteMany({});
    await EmergencyRequest.deleteMany({});
    await Match.deleteMany({});
    await Inventory.deleteMany({});
    await Notification.deleteMany({});
    await AuditLog.deleteMany({});
    await Escalation.deleteMany({});

    const hashedPasswords = {
      hospital: await hashPassword('Demo@Hospital1'),
      bloodbank: await hashPassword('Demo@BloodBank1'),
      donor: await hashPassword('Demo@Donor1'),
      admin: await hashPassword('Demo@Admin1'),
      generic: await hashPassword('Password123!'),
    };

    // 1. Create Users
    const adminUser = await User.create({
      email: 'admin@demo.rakthsetu.in',
      password: hashedPasswords.admin,
      name: 'Admin User',
      phone: '9876543210',
      role: 'ADMIN',
      verificationStatus: 'VERIFIED',
    });

    const demoHospitalUser = await User.create({
      email: 'hospital@demo.rakthsetu.in',
      password: hashedPasswords.hospital,
      name: 'Demo Hospital',
      phone: '9876543211',
      role: 'HOSPITAL',
      verificationStatus: 'VERIFIED',
    });

    const demoBloodBankUser = await User.create({
      email: 'bloodbank@demo.rakthsetu.in',
      password: hashedPasswords.bloodbank,
      name: 'Demo Blood Bank',
      phone: '9876543212',
      role: 'BLOOD_BANK',
      verificationStatus: 'VERIFIED',
    });

    const demoDonorUser = await User.create({
      email: 'donor@demo.rakthsetu.in',
      password: hashedPasswords.donor,
      name: 'Demo Donor',
      phone: '9876543213',
      role: 'DONOR',
      verificationStatus: 'VERIFIED',
    });

    let hospitalCount = 0;
    let bloodBankCount = 0;
    let donorCount = 0;
    let inventoryCount = 0;
    let requestCount = 0;
    let notificationCount = 0;
    let auditLogCount = 0;

    let firstHospitalId: mongoose.Types.ObjectId | null = null;
    let firstHospitalLocation: number[] = [];

    // Create Hospitals
    for (let i = 0; i < HOSPITALS.length; i++) {
      const isDemoUser = i === 0;
      let user = demoHospitalUser;
      if (!isDemoUser) {
        user = await User.create({
          email: `hospital${i}@demo.rakthsetu.in`,
          password: hashedPasswords.generic,
          name: HOSPITALS[i].name,
          phone: `900000010${i}`,
          role: 'HOSPITAL',
          verificationStatus: 'VERIFIED',
        });
      }

      const hospital = await Hospital.create({
        userId: user._id,
        name: HOSPITALS[i].name,
        registrationNumber: `REG-HOSP-${1000 + i}`,
        type: getRandomElement(['GOVERNMENT', 'PRIVATE']),
        address: '123 Main St',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        location: {
          type: 'Point',
          coordinates: HOSPITALS[i].coords,
        },
        contactPerson: 'Dr. Smith',
        contactPhone: user.phone,
        contactEmail: user.email,
      });

      if (isDemoUser) {
        user.profileId = hospital._id as mongoose.Types.ObjectId;
        await user.save();
        firstHospitalId = hospital._id as mongoose.Types.ObjectId;
        firstHospitalLocation = HOSPITALS[i].coords;
      }
      hospitalCount++;
    }

    // Create Blood Banks
    for (let i = 0; i < BLOOD_BANKS.length; i++) {
      const isDemoUser = i === 0;
      let user = demoBloodBankUser;
      if (!isDemoUser) {
        user = await User.create({
          email: `bloodbank${i}@demo.rakthsetu.in`,
          password: hashedPasswords.generic,
          name: BLOOD_BANKS[i].name,
          phone: `900000020${i}`,
          role: 'BLOOD_BANK',
          verificationStatus: 'VERIFIED',
        });
      }

      const bloodBank = await BloodBank.create({
        userId: user._id,
        name: BLOOD_BANKS[i].name,
        licenseNumber: `LIC-BB-${1000 + i}`,
        type: getRandomElement(['STANDALONE', 'HOSPITAL_ATTACHED', 'RED_CROSS']),
        address: '456 Blood Bank Rd',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400002',
        location: {
          type: 'Point',
          coordinates: BLOOD_BANKS[i].coords,
        },
        contactPerson: 'Manager',
        contactPhone: user.phone,
        contactEmail: user.email,
        operatingHours: '24/7',
        isOpen: true,
        componentCapabilities: ['WHOLE_BLOOD', 'PRBC', 'FFP', 'PLATELETS_SDP'],
      });

      if (isDemoUser) {
        user.profileId = bloodBank._id as mongoose.Types.ObjectId;
        await user.save();
      }

      // Create Inventory
      for (const bg of BLOOD_GROUPS) {
        await Inventory.create({
          bloodBankId: bloodBank._id,
          bloodGroup: bg,
          component: 'PRBC',
          availableUnits: Math.floor(Math.random() * 14) + 2, // 2-15
          reservedUnits: Math.floor(Math.random() * 4), // 0-3
          lastUpdated: new Date(),
        });
        inventoryCount++;

        if (Math.random() > 0.5) {
          await Inventory.create({
            bloodBankId: bloodBank._id,
            bloodGroup: bg,
            component: 'FFP',
            availableUnits: Math.floor(Math.random() * 10) + 1,
            reservedUnits: 0,
            lastUpdated: new Date(),
          });
          inventoryCount++;
        }
        if (Math.random() > 0.8) {
          await Inventory.create({
            bloodBankId: bloodBank._id,
            bloodGroup: bg,
            component: 'PLATELETS_SDP',
            availableUnits: Math.floor(Math.random() * 5) + 1,
            reservedUnits: 0,
            lastUpdated: new Date(),
          });
          inventoryCount++;
        }
      }
      bloodBankCount++;
    }

    // Create Donors (30)
    for (let i = 0; i < 30; i++) {
      const isDemoUser = i === 0;
      let user = demoDonorUser;
      const name = isDemoUser ? demoDonorUser.name : INDIAN_NAMES[i];
      if (!isDemoUser) {
        user = await User.create({
          email: `donor${i}@demo.rakthsetu.in`,
          password: hashedPasswords.generic,
          name: name,
          phone: `90000003${String(i).padStart(2, '0')}`,
          role: 'DONOR',
          verificationStatus: 'VERIFIED',
        });
      }

      // Mix coordinates around Mumbai/Pune
      const baseLat = Math.random() > 0.5 ? 19.0760 : 18.5204;
      const baseLng = Math.random() > 0.5 ? 72.8777 : 73.8567;
      const lat = baseLat + (Math.random() - 0.5) * 0.1;
      const lng = baseLng + (Math.random() - 0.5) * 0.1;

      const bg = isDemoUser ? 'O+' : BLOOD_GROUPS[i % BLOOD_GROUPS.length];

      const donor = await Donor.create({
        userId: user._id,
        bloodGroup: bg,
        address: '789 Donor Lane',
        city: baseLat > 19 ? 'Mumbai' : 'Pune',
        state: 'Maharashtra',
        pincode: '400003',
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        isAvailable: Math.random() > 0.3,
        availabilityRadius: Math.floor(Math.random() * 21) + 5, // 5-25
        emergencyNotificationsEnabled: true,
      });

      if (isDemoUser) {
        user.profileId = donor._id as mongoose.Types.ObjectId;
        await user.save();
      }
      donorCount++;
    }

    // Create Emergency Requests (15)
    if (firstHospitalId) {
      const statuses = [
        ...Array(2).fill('CREATED'),
        ...Array(3).fill('MATCHING'),
        ...Array(2).fill('RESOURCES_NOTIFIED'),
        ...Array(3).fill('FULFILLED'),
        ...Array(2).fill('CANCELLED'),
        ...Array(1).fill('ESCALATED'),
        ...Array(2).fill('RESPONSES_RECEIVED')
      ];

      const severities = [
        ...Array(3).fill('CRITICAL'),
        ...Array(5).fill('HIGH'),
        ...Array(7).fill('NORMAL')
      ];

      for (let i = 0; i < 15; i++) {
        const status = statuses[i];
        const severity = severities[i];
        
        const reqData: any = {
          requestId: `RS-2026-${String(i + 1).padStart(6, '0')}`,
          hospitalId: firstHospitalId,
          createdBy: demoHospitalUser._id,
          patientReference: `PAT-${2000 + i}`,
          bloodGroup: getRandomElement(BLOOD_GROUPS),
          component: getRandomElement(COMPONENT_TYPES),
          quantity: Math.floor(Math.random() * 6) + 1,
          severity: severity,
          requiredBy: new Date(Date.now() + (Math.random() * 48) * 60 * 60 * 1000), // Within 48 hours
          location: {
            type: 'Point',
            coordinates: firstHospitalLocation,
          },
          address: '123 Main St',
          city: 'Mumbai',
          status: status,
          contactPerson: 'Dr. Smith',
          contactPhone: demoHospitalUser.phone,
        };

        if (status === 'FULFILLED') {
          reqData.fulfilledAt = new Date();
          reqData.quantityFulfilled = reqData.quantity;
        } else if (status === 'CANCELLED') {
          reqData.cancelledAt = new Date();
          reqData.cancellationReason = 'Patient no longer needs it';
        }

        await EmergencyRequest.create(reqData);
        requestCount++;
      }
    }

    // Create Notifications
    const demoUserIds = [demoHospitalUser._id, demoBloodBankUser._id, demoDonorUser._id, adminUser._id];
    const notificationTypes = ['EMERGENCY_REQUEST', 'NEW_MATCH', 'SYSTEM', 'VERIFICATION_UPDATE'];
    const notificationSeverities = ['CRITICAL', 'HIGH', 'NORMAL', 'INFO'];
    
    for (let i = 0; i < 20; i++) {
      await Notification.create({
        userId: getRandomElement(demoUserIds),
        type: getRandomElement(notificationTypes),
        title: `Demo Notification ${i + 1}`,
        message: 'This is a demo notification for the RakthSetu system.',
        severity: getRandomElement(notificationSeverities),
        channel: 'IN_APP',
        deliveryStatus: 'DELIVERED',
        isRead: Math.random() > 0.5,
      });
      notificationCount++;
    }

    // Create Audit Logs
    for (let i = 0; i < 15; i++) {
      await AuditLog.create({
        userId: adminUser._id,
        userRole: 'ADMIN',
        userName: adminUser.name,
        action: getRandomElement(['CREATE', 'UPDATE', 'DELETE', 'VERIFY']),
        entityType: getRandomElement(['USER', 'HOSPITAL', 'BLOOD_BANK', 'EMERGENCY_REQUEST']),
        entityId: new mongoose.Types.ObjectId(),
        description: `Performed action ${i + 1} during demo seeding.`,
      });
      auditLogCount++;
    }

    return NextResponse.json({
      message: 'Database seeded successfully',
      counts: {
        hospitals: hospitalCount,
        bloodBanks: bloodBankCount,
        donors: donorCount,
        inventories: inventoryCount,
        requests: requestCount,
        notifications: notificationCount,
        auditLogs: auditLogCount,
      }
    });

  } catch (error) {
    console.error('Error seeding database:', error);
    return NextResponse.json({ error: 'Failed to seed database' }, { status: 500 });
  }
}
