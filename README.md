# Prastha Backend

Express + MongoDB API powering Prastha’s small thread hub. It exposes only the endpoints actually used today: thread CRUD, join requests, chat messages, alerts, and a bare-bones admin summary. No scheduled jobs or push notifications exist yet.

This service is co-maintained by **asmith0713** and **Niteesh206** and is based on [Niteesh206/event-thread-backend](https://github.com/Niteesh206/event-thread-backend).

> Frontend pairing: [`client/event-thread-next`](../../client/event-thread-next/README.md)

## Features

- REST API for threads, join requests, chat messages, alerts, and gossips with comments
- Socket.io broadcast hooks (`refresh-threads`) for instant client updates
- MongoDB models for Users, Threads, and Messages
- Role aware deletes (creator or admin) and protected admin dashboard endpoints
- JWT-based auth helpers (see `routes/auth.js`)

## Stack

- Node.js 18+
- Express 4
- Mongoose 8 (MongoDB Atlas or local instance)
- Socket.io 4
- bcrypt / jsonwebtoken / cors / dotenv

## Prerequisites

- MongoDB connection string (local or Atlas)
- Node.js 18+

## Environment Variables

Copy `.env.example` to `.env` (create if missing) and supply:

```
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/event-threads
JWT_SECRET=super-secret-string
CLIENT_ORIGIN=http://localhost:3000
```

Adjust values per deployment (Atlas URI, production origin, etc.).

## Installation & Scripts

```bash
npm install          # install dependencies
npm run dev          # nodemon + hot reload (requires .env)
npm start            # production mode
```

## API Overview

| Route | Method | Description |
| --- | --- | --- |
| `/api/threads` | GET | List active threads |
| `/api/threads` | POST | Create new thread |
| `/api/threads/:id/join` | POST | Submit join request |
| `/api/threads/:id/requests` | POST | Approve/deny join request |
| `/api/threads/:id/messages` | POST | Append chat message |
| `/api/threads/:id` | DELETE | Delete thread (creator/admin) |
| `/api/gossips` | GET/POST | List or create gossips |
| `/api/gossips/:id/vote` | POST | Upvote/downvote gossip |
| `/api/gossips/:id/comments` | POST | Add comment to gossip |
| `/api/gossips/:id` | DELETE | Delete gossip (creator/admin) |
| `/api/gossips/:gossipId/comments/:commentId` | DELETE | Delete gossip comment (author/admin) |
| `/api/gossips/:gossipId/comments/:commentId/report` | POST | Flag a comment for review |
| `/api/auth/login` | POST | Authenticate user |
| `/api/auth/register` | POST | Register user |
| `/api/admin/dashboard/:userId` | GET | Admin stats (requires admin user) |

Refer to `routes/*.js` for full payload requirements and responses.

## Development Notes

- Socket.io server instance is attached in `server.js`; any route can emit via `req.app.get('io')`.
- Deletion currently checks creator ownership by comparing `thread.creator` with the supplied `userId`, and falls back to an `isAdmin` flag pulled from MongoDB.
- When coordinating with the frontend repo, keep shared type shapes in sync (`threads`, `messages`, `alerts`).

## Credits & Collaboration

- Upstream inspiration: [Niteesh206/event-thread-backend](https://github.com/Niteesh206/event-thread-backend)
- Current maintainers: **asmith0713** & **Niteesh206**

Open issues/PRs are welcome—just note whether changes affect the paired frontend so we can stage deployments together.