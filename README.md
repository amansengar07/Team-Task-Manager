# Team Task Manager

A full-stack collaborative task management app with authentication, role-based project membership, task assignment, status tracking, and dashboard analytics.

## Tech Stack

- Frontend: React, Vite
- Backend: Node.js, Express
- Database: Prisma ORM with SQLite locally
- Auth: JWT with bcrypt password hashing

## Features

- Signup and login
- Create projects as an Admin
- Add and remove project members
- Create, assign, and update tasks
- Admins can manage all project tasks and users
- Members can view and update only their assigned tasks
- Dashboard totals for task count, status, per-user workload, and overdue tasks

## Local Setup

```bash
npm install
cp server/.env
npm run db:push
npm run db:seed
npm run build
npm run dev
```

The app runs at `http://localhost:4000`. The Express server serves the built frontend in production and proxies Vite during development.

Seeded accounts:

- `admin@example.com` / `password123`
- `member@example.com` / `password123`


## Set the start command:

```bash
npm start
```

## API Overview

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/projects`
- `POST /api/projects`
- `POST /api/projects/:projectId/members`
- `DELETE /api/projects/:projectId/members/:userId`
- `GET /api/projects/:projectId/tasks`
- `POST /api/projects/:projectId/tasks`
- `PATCH /api/tasks/:taskId`
- `DELETE /api/tasks/:taskId`
- `GET /api/dashboard`
