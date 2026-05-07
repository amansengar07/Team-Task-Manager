import bcrypt from "bcryptjs";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import morgan from "morgan";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const port = process.env.PORT || 4000;
const jwtSecret = process.env.JWT_SECRET || "dev-secret-change-me";

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true, credentials: true }));
app.use(express.json());
app.use(morgan("dev"));

const signupSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const projectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional().default("")
});

const memberSchema = z.object({
  email: z.string().email()
});

const taskSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional().default(""),
  dueDate: z.string().datetime(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  assigneeId: z.string().min(1)
});

const taskUpdateSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  assigneeId: z.string().min(1).optional()
});

function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: "7d" });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email };
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Authentication required" });

  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) return res.status(401).json({ message: "Invalid session" });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token" });
  }
}

async function getMembership(projectId, userId) {
  return prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { user: true, project: true }
  });
}

async function requireProjectMember(req, res, next) {
  const membership = await getMembership(req.params.projectId, req.user.id);
  if (!membership) return res.status(403).json({ message: "Project access denied" });
  req.membership = membership;
  next();
}

async function requireProjectAdmin(req, res, next) {
  const membership = await getMembership(req.params.projectId, req.user.id);
  if (!membership || membership.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }
  req.membership = membership;
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/signup", asyncHandler(async (req, res) => {
  const data = signupSchema.parse(req.body);
  const existing = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (existing) return res.status(409).json({ message: "Email is already registered" });

  const passwordHash = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({
    data: { name: data.name, email: data.email.toLowerCase(), passwordHash }
  });

  res.status(201).json({ token: signToken(user), user: publicUser(user) });
}));

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({ token: signToken(user), user: publicUser(user) });
}));

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get("/api/users", requireAuth, asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });
  res.json({ users: users.map(publicUser) });
}));

app.get("/api/projects", requireAuth, asyncHandler(async (req, res) => {
  const memberships = await prisma.projectMembership.findMany({
    where: { userId: req.user.id },
    include: {
      project: {
        include: {
          memberships: { include: { user: true } },
          tasks: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  res.json({
    projects: memberships.map((membership) => ({
      ...membership.project,
      role: membership.role,
      members: membership.project.memberships.map((item) => ({
        role: item.role,
        user: publicUser(item.user)
      })),
      taskCount: membership.project.tasks.length
    }))
  });
}));

app.post("/api/projects", requireAuth, asyncHandler(async (req, res) => {
  const data = projectSchema.parse(req.body);
  const project = await prisma.project.create({
    data: {
      name: data.name,
      description: data.description,
      creatorId: req.user.id,
      memberships: { create: { userId: req.user.id, role: "ADMIN" } }
    },
    include: { memberships: { include: { user: true } }, tasks: true }
  });

  res.status(201).json({
    project: {
      ...project,
      role: "ADMIN",
      members: project.memberships.map((item) => ({ role: item.role, user: publicUser(item.user) })),
      taskCount: 0
    }
  });
}));

app.post("/api/projects/:projectId/members", requireAuth, requireProjectAdmin, asyncHandler(async (req, res) => {
  const data = memberSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });
  if (!user) return res.status(404).json({ message: "No user found with that email" });

  const membership = await prisma.projectMembership.upsert({
    where: { userId_projectId: { userId: user.id, projectId: req.params.projectId } },
    update: {},
    create: { userId: user.id, projectId: req.params.projectId, role: "MEMBER" },
    include: { user: true }
  });

  res.status(201).json({ member: { role: membership.role, user: publicUser(membership.user) } });
}));

app.delete("/api/projects/:projectId/members/:userId", requireAuth, requireProjectAdmin, asyncHandler(async (req, res) => {
  if (req.params.userId === req.user.id) {
    return res.status(400).json({ message: "Admins cannot remove themselves" });
  }

  await prisma.projectMembership.delete({
    where: { userId_projectId: { userId: req.params.userId, projectId: req.params.projectId } }
  });

  res.status(204).end();
}));

app.get("/api/projects/:projectId/tasks", requireAuth, requireProjectMember, asyncHandler(async (req, res) => {
  const where = req.membership.role === "ADMIN"
    ? { projectId: req.params.projectId }
    : { projectId: req.params.projectId, assigneeId: req.user.id };

  const tasks = await prisma.task.findMany({
    where,
    include: { assignee: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }]
  });

  res.json({ tasks: tasks.map((task) => ({ ...task, assignee: publicUser(task.assignee) })) });
}));

app.post("/api/projects/:projectId/tasks", requireAuth, requireProjectAdmin, asyncHandler(async (req, res) => {
  const data = taskSchema.parse(req.body);
  const assigneeMembership = await getMembership(req.params.projectId, data.assigneeId);
  if (!assigneeMembership) return res.status(400).json({ message: "Assignee must be a project member" });

  const task = await prisma.task.create({
    data: {
      ...data,
      dueDate: new Date(data.dueDate),
      projectId: req.params.projectId
    },
    include: { assignee: true }
  });

  res.status(201).json({ task: { ...task, assignee: publicUser(task.assignee) } });
}));

app.patch("/api/tasks/:taskId", requireAuth, asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ message: "Task not found" });

  const membership = await getMembership(task.projectId, req.user.id);
  if (!membership) return res.status(403).json({ message: "Project access denied" });

  const data = taskUpdateSchema.parse(req.body);
  const isAdmin = membership.role === "ADMIN";
  if (!isAdmin) {
    if (task.assigneeId !== req.user.id) return res.status(403).json({ message: "Only assigned tasks can be updated" });
    const forbidden = Object.keys(data).some((key) => key !== "status");
    if (forbidden) return res.status(403).json({ message: "Members can only update task status" });
  }

  if (data.assigneeId) {
    const assigneeMembership = await getMembership(task.projectId, data.assigneeId);
    if (!assigneeMembership) return res.status(400).json({ message: "Assignee must be a project member" });
  }

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : undefined },
    include: { assignee: true }
  });

  res.json({ task: { ...updated, assignee: publicUser(updated.assignee) } });
}));

app.delete("/api/tasks/:taskId", requireAuth, asyncHandler(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.taskId } });
  if (!task) return res.status(404).json({ message: "Task not found" });

  const membership = await getMembership(task.projectId, req.user.id);
  if (!membership || membership.role !== "ADMIN") {
    return res.status(403).json({ message: "Admin access required" });
  }

  await prisma.task.delete({ where: { id: task.id } });
  res.status(204).end();
}));

app.get("/api/dashboard", requireAuth, asyncHandler(async (req, res) => {
  const memberships = await prisma.projectMembership.findMany({ where: { userId: req.user.id } });
  const projectIds = memberships.map((membership) => membership.projectId);
  const adminProjectIds = memberships.filter((membership) => membership.role === "ADMIN").map((membership) => membership.projectId);
  const memberProjectIds = memberships.filter((membership) => membership.role !== "ADMIN").map((membership) => membership.projectId);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { projectId: { in: adminProjectIds } },
        { projectId: { in: memberProjectIds }, assigneeId: req.user.id }
      ]
    },
    include: { assignee: true, project: true }
  });

  const byStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  const perUser = {};
  const now = new Date();

  for (const task of tasks) {
    byStatus[task.status] += 1;
    perUser[task.assignee.name] = (perUser[task.assignee.name] || 0) + 1;
  }

  res.json({
    totalTasks: tasks.length,
    projectCount: projectIds.length,
    byStatus,
    perUser,
    overdueTasks: tasks
      .filter((task) => task.status !== "DONE" && task.dueDate < now)
      .map((task) => ({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate,
        project: task.project.name,
        assignee: publicUser(task.assignee)
      }))
  });
}));

app.get("/", (_req, res) => {
  res.json({ message: "Team Task Manager API running" });
});

app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    return res.status(400).json({ message: "Validation failed", errors: error.flatten() });
  }
  console.error(error);
  res.status(500).json({ message: "Something went wrong" });
});

app.listen(port, () => {
  console.log(`Team Task Manager running on port ${port}`);
});
