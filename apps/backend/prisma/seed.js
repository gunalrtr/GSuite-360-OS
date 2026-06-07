const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const userId = 'mock-user-uuid-1234-5678';
  const email = 'gunalrtr@gmail.com';
  const name = 'Gunal';

  console.log('Cleaning up existing data...');
  // Clean up to prevent duplicate key errors
  await prisma.workSession.deleteMany({});
  await prisma.attendance.deleteMany({});
  await prisma.salaryConfig.deleteMany({});
  await prisma.salaryLog.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.budget.deleteMany({});
  await prisma.storeLog.deleteMany({});
  await prisma.user.deleteMany({ where: { email } });

  console.log('Creating mock user...');
  const user = await prisma.user.create({
    data: {
      id: userId,
      email,
      name,
      role: 'STORE_EXECUTIVE',
    }
  });

  console.log('Creating salary config...');
  await prisma.salaryConfig.create({
    data: {
      userId,
      baseSalary: 16640.0,
      workingDays: 26,
      dailySalary: 640.0,
      hourlyRate: 80.0,
      otRatePerHour: 100.0,
    }
  });

  // Seed 26 days of history starting May 26, 2026
  console.log('Seeding attendance history...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const periodStart = new Date(2026, 4, 26, 0, 0, 0, 0); // May is index 4

  const SHIFT_CONFIG = {
    MORNING:   { startHour: 6,  startMin: 0,  endHour: 14, endMin: 0,  standardHours: 8.0, salaryImpact: 0.5 },
    AFTERNOON: { startHour: 14, startMin: 0,  endHour: 22, endMin: 0,  standardHours: 8.0, salaryImpact: 0.5 },
    FULL_DAY:  { startHour: 9,  startMin: 0,  endHour: 18, endMin: 0,  standardHours: 8.0, salaryImpact: 1.0 },
  };

  const cursor = new Date(periodStart);
  let idx = 0;
  while (cursor < today) {
    const logDate = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);

    // Skip Sundays
    if (logDate.getDay() === 0) continue;
    idx++;

    let status = 'PRESENT';
    const rand = Math.random();
    if (rand > 0.92) status = 'HALF_DAY';
    else if (rand > 0.88) status = 'LEAVE';

    let shift = 'FULL_DAY';
    const shiftRand = Math.random();
    if (status === 'PRESENT') {
      if (shiftRand < 0.15) shift = 'MORNING';
      else if (shiftRand < 0.30) shift = 'AFTERNOON';
    }

    const shiftCfg = SHIFT_CONFIG[shift];

    if (status === 'LEAVE') {
      await prisma.attendance.create({
        data: {
          userId,
          date: logDate,
          status: 'LEAVE',
          shift: 'FULL_DAY',
          totalHours: 0.0,
          otHours: 0.0,
          breakMinutes: 0.0,
          salaryImpact: 0.0,
        }
      });
    } else {
      const checkedInAt = new Date(logDate);
      checkedInAt.setHours(shiftCfg.startHour, Math.floor(Math.random() * 15), 0, 0);

      const checkedOutAt = new Date(logDate);
      const otExtraMin = shift === 'FULL_DAY' ? Math.floor(Math.random() * 120) : 0;
      checkedOutAt.setHours(shiftCfg.endHour, shiftCfg.endMin + otExtraMin, 0, 0);

      const totalMs = checkedOutAt.getTime() - checkedInAt.getTime();
      const breakMin = shift === 'FULL_DAY' ? 45 : 15;
      const totalHours = Math.max(0, parseFloat(((totalMs / (1000 * 60 * 60)) - (breakMin / 60)).toFixed(2)));
      const otHours = Math.max(0, parseFloat((totalHours - shiftCfg.standardHours).toFixed(2)));
      const salaryImpact = status === 'HALF_DAY' ? 0.5 : shiftCfg.salaryImpact;

      const att = await prisma.attendance.create({
        data: {
          userId,
          date: logDate,
          status: status,
          shift: shift,
          checkedInAt,
          checkedOutAt,
          totalHours,
          otHours,
          breakMinutes: breakMin,
          salaryImpact,
        }
      });

      // Create work sessions
      await prisma.workSession.createMany({
        data: [
          {
            attendanceId: att.id,
            type: 'WORK',
            startTime: checkedInAt,
            endTime: new Date(checkedInAt.getTime() + (shiftCfg.standardHours / 2) * 60 * 60 * 1000),
          },
          {
            attendanceId: att.id,
            type: 'BREAK',
            startTime: new Date(checkedInAt.getTime() + (shiftCfg.standardHours / 2) * 60 * 60 * 1000),
            endTime: new Date(checkedInAt.getTime() + (shiftCfg.standardHours / 2) * 60 * 60 * 1000 + breakMin * 60 * 1000),
          },
          {
            attendanceId: att.id,
            type: 'WORK',
            startTime: new Date(checkedInAt.getTime() + (shiftCfg.standardHours / 2) * 60 * 60 * 1000 + breakMin * 60 * 1000),
            endTime: checkedOutAt,
          }
        ]
      });
    }
  }

  console.log('Seeding tasks...');
  await prisma.task.createMany({
    data: [
      { userId, title: 'Verify warehouse inventory stock audit', status: 'COMPLETED', priority: 'HIGH', tags: ['Store', 'Audit'] },
      { userId, title: 'Reconcile weekly GRN and PO differences', status: 'IN_PROGRESS', priority: 'HIGH', tags: ['Finance'] },
      { userId, title: 'Upload tax documents for May reimbursement', status: 'TODO', priority: 'MEDIUM', tags: ['Tax', 'Docs'] },
      { userId, title: 'Complete morning shift log reports', status: 'COMPLETED', priority: 'MEDIUM', tags: ['Store'] },
      { userId, title: 'Prepare presentation for quarterly performance', status: 'TODO', priority: 'LOW', tags: ['Admin'] },
    ]
  });

  console.log('Seeding financial budgets and expenses...');
  const expYear = today.getFullYear();
  const expMonth = today.getMonth() + 1;

  await prisma.budget.createMany({
    data: [
      { userId, category: 'Food', limit: 5000.0, month: expMonth, year: expYear },
      { userId, category: 'Fuel', limit: 4000.0, month: expMonth, year: expYear },
      { userId, category: 'Bills', limit: 10000.0, month: expMonth, year: expYear },
      { userId, category: 'Medical', limit: 2000.0, month: expMonth, year: expYear },
      { userId, category: 'Shopping', limit: 8000.0, month: expMonth, year: expYear },
    ]
  });

  await prisma.expense.createMany({
    data: [
      { userId, category: 'Food', amount: 450.0, description: 'Team lunch at restaurant', date: new Date(2026, 4, 28) },
      { userId, category: 'Food', amount: 120.0, description: 'Morning coffee & snacks', date: new Date(2026, 5, 2) },
      { userId, category: 'Fuel', amount: 1500.0, description: 'Petrol refill for vehicle logs', date: new Date(2026, 4, 27) },
      { userId, category: 'Bills', amount: 3200.0, description: 'Broadband internet bill payment', date: new Date(2026, 5, 1) },
      { userId, category: 'Shopping', amount: 4500.0, description: 'Purchase office chair for cockpit', date: new Date(2026, 5, 3) },
    ]
  });

  console.log('Seeding store operations logs...');
  const storeCursor = new Date(periodStart);
  let storeIdx = 0;
  while (storeCursor < today) {
    const logDate = new Date(storeCursor);
    storeCursor.setDate(storeCursor.getDate() + 1);

    if (logDate.getDay() === 0) continue;
    storeIdx++;

    await prisma.storeLog.create({
      data: {
        userId,
        date: logDate,
        grnCount: Math.floor(Math.random() * 8) + 4,
        poCount: Math.floor(Math.random() * 6) + 3,
        vehicleEntries: Math.floor(Math.random() * 12) + 8,
        materialReceipts: Math.floor(Math.random() * 10) + 5,
        stockVerifications: Math.floor(Math.random() * 3) + 1,
        notes: `Standard material logs reconciled successfully. Index #${storeIdx}`,
      }
    });
  }

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
