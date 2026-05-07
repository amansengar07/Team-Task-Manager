# Team Task Manager

A full-stack collaborative task management application built with React, Vite, Node.js, Express, Prisma ORM, and PostgreSQL.

The application allows teams to create projects, manage members, assign tasks, track progress, and monitor project analytics through a modern dashboard interface.

---

# Live Demo

## Frontend
https://team-task-manager-client-3v6v.vercel.app

## Backend API
https://team-task-manager-niq1.onrender.com

---

# Features

- User authentication with JWT
- Secure signup and login
- Role-based project access
- Admin and member permissions
- Create and manage projects
- Add and remove project members
- Create, assign, update, and delete tasks
- Task status tracking
- Dashboard analytics
- Overdue task monitoring
- Responsive modern UI

---

# Tech Stack

## Frontend
- React
- Vite
- CSS
- Lucide React Icons

## Backend
- Node.js
- Express.js

## Database & ORM
- PostgreSQL (Production)
- Prisma ORM

## Authentication
- JWT Authentication
- bcrypt password hashing

## Deployment
- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL

---

# Project Structure

```text
team-task-manager/
│
├── client/          # React + Vite frontend
│
├── server/          # Express backend + Prisma
│   ├── prisma/
│   └── src/
│
└── README.md