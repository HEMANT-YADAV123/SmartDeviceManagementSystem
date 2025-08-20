# Smart Device Management System

A backend service to register users, authenticate, and manage IoT/smart devices with analytics support.  
Built with **Node.js (Express)**, **MongoDB (Atlas)**, and secured with **JWT authentication**.

---

## 🚀 Features

### 👤 User Management
- Signup, Login, Profile (view & update)

### 📱 Device Management
- CRUD operations on devices
- Heartbeat updates
- Statistics and filtering

### 📊 Analytics
- Device usage aggregation
- Event logs per device
- Top events

### 🔐 Security & Reliability
- JWT-based authentication
- Request validation using **Zod**
- Rate limiting (100 req/min per user)
- Centralized error handling
- Helmet, CORS, compression

### ⚙️ Background Jobs
- Auto-detect inactive devices (> 24h)

### 🛠 Developer Extras
- Jest unit tests for services
- Test coverage reports
- Dockerized setup with Compose
- Organized clean architecture

---

## 📂 Project Structure

```bash
smartdevicemangementsystem/
├── src/
│   ├── __tests__/           # Jest tests (setup + service tests)
│   ├── config/              # Database config
│   ├── controllers/         # Business logic
│   ├── middlewares/         # Auth, validation, rate limiting, error handling
│   ├── models/              # Mongoose models
│   ├── routes/              # API route definitions
│   ├── services/            # Core services
│   ├── utils/               # Helpers (JWT, password, constants)
│   ├── validators/          # Zod validation schemas
│   ├── app.js               # Express app initialization
│   └── server.js            # Server startup
├── logs/                    # App & Docker logs
├── mongo-init/              # Mongo init scripts (if needed locally)
├── coverage/                # Auto-created Jest coverage reports
├── .dockerignore
├── .gitignore
├── .env                     # Local environment config
├── .env.example             # Example env file (no secrets)
├── docker-compose.yml
├── Dockerfile
├── jest.config.js
├── package.json
└── README.md
```
---

## ⚙️ Setup Instructions

### 1. Clone & Install
```bash
git clone <repo-url>
cd smartdevicemangementsystem
npm install
```

### 2. Environment Variables

- Copy .env.example → .env and set values:
```bash
PORT=3000
NODE_ENV=development
MONGODB_URI=<your-mongodb-atlas-uri>
JWT_SECRET=<your-secret-key>
JWT_EXPIRES_IN=7d
DEVICE_INACTIVE_THRESHOLD_HOURS=24
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

```

### 3. Run Locally
```bash
npm run dev
```

- Runs on: http://localhost:3000

### 4. Run Tests

```bash 
npm test            # run all tests
npm run test:watch  # watch mode
npm run test:coverage
```

### 5. Run with Docker

```bash
Build and start:
docker compose up -d --build
```

- Stop:
```bash
docker compose down
```

### 📖 API Documentation


#### 🔑 Auth Routes

- POST /api/auth/signup → Register new user

- POST /api/auth/login → Login and get JWT

- GET /api/auth/profile → Get profile (auth required)

- PATCH /api/auth/profile → Update profile



## 📱 Device Routes (auth required)

- POST /api/devices → Register device

- GET /api/devices → List devices (filters supported)

- GET /api/devices/stats → Device statistics

- GET /api/devices/by-type → Group devices by type

- GET /api/devices/:id → Get device by ID

- PATCH /api/devices/:id → Update device

- DELETE /api/devices/:id → Delete device

- POST /api/devices/:id/heartbeat → Record heartbeat




### 📊 Analytics Routes (auth required)

- GET /api/analytics/usage → Aggregated usage

- GET /api/analytics/events/top → Top events

- POST /api/analytics/devices/:id/logs → Create device log

- GET /api/analytics/devices/:id/logs → Fetch logs

- GET /api/analytics/devices/:id/usage → Device usage



### ✅ Assumptions Made

#### MongoDB Atlas is used as the primary database.

- JWT is the only authentication method.

- Rate limiting applied per user (100 req/min).

- Background jobs (inactive device detection) run hourly in the same service (no external scheduler).

- Jest + Supertest used for unit/service-level testing.

- Dockerized setup runs only the app (Atlas is external, not containerized here).



### 🛠 Tech Stack

- Runtime: Node.js (Express)
  
- Database: MongoDB Atlas (Mongoose ODM)

- Auth: JWT

- Validation: Zod

- Testing: Jest, Supertest

- Security: Helmet, CORS, bcryptjs

- Deployment: Docker, Docker Compose



### 👨‍💻 Run Commands (Quick Reference)
```bash
# Development
npm run dev            # Start with Nodemon
npm start              # Start normally

# Testing
npm test               # Run Jest tests
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report

# Docker
docker compose up -d --build  # Run in Docker
docker compose down           # Stop containers
```
