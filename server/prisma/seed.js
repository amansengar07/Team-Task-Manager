import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.task.deleteMany();
  await prisma.projectMembership.deleteMany();
  await prisma.project.deleteMany();

  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: { name: "Project Admin", email: "admin@example.com", passwordHash }
  });

  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: {},
    create: { name: "Team Member", email: "member@example.com", passwordHash }
  });

  const project = await prisma.project.create({
    data: {
      name: "Product Launch",
      description: "Coordinate launch tasks across design, engineering, and marketing.",
      creatorId: admin.id,
      memberships: {
        create: [
          { userId: admin.id, role: "ADMIN" },
          { userId: member.id, role: "MEMBER" }
        ]
      }
    }
  });

  await prisma.task.createMany({
    data: [
      {
        title: "Finalize onboarding flow",
        description: "Review signup, login, and first project creation screens.",
        dueDate: new Date(Date.now() + 86400000 * 3),
        priority: "HIGH",
        status: "IN_PROGRESS",
        projectId: project.id,
        assigneeId: member.id
      },
      {
        title: "Prepare demo script",
        description: "Write a concise walkthrough for the assignment video.",
        dueDate: new Date(Date.now() - 86400000),
        priority: "MEDIUM",
        status: "TODO",
        projectId: project.id,
        assigneeId: admin.id
      }
    ]
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
