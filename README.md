# CallSphere

CallSphere is an end-to-end logistics and last-mile delivery platform that empowers customers to interact with their shipments through both chat and voice interfaces, while providing operations teams with comprehensive monitoring, issue management, and escalation workflows.

## Overview

CallSphere combines traditional logistics management with modern AI-powered customer service. The platform features a customer dashboard that supports both text-based chat agents and browser-based voice agents, enabling customers to track shipments, report issues, and request delivery changes using their preferred communication method. On the operations side, dispatchers, managers, and administrators have access to real-time dashboards for monitoring shipments, managing routes, handling delivery issues, and configuring system metrics.

### Key Features

- **Multi-Modal Customer Interface**: Unified chat and voice agents powered by OpenAI, allowing customers to interact naturally with the system
- **Real-Time Monitoring**: WebSocket-based updates for shipment tracking, issue management, and escalation workflows
- **Role-Based Access Control**: Comprehensive RBAC system with five distinct roles (customer, driver, dispatcher, manager, admin)
- **Intelligent Escalation System**: Automated escalation workflows with acknowledgment tracking
- **Metrics Dashboard**: Configurable KPIs and performance metrics with snapshot history
- **Multi-Agent AI Architecture**: Specialized AI agents for tracking, issue reporting, delivery changes, escalations, and analytics

## Tech Stack

### Backend
- **Framework**: NestJS 11
- **Database**: PostgreSQL with Prisma 7 ORM
- **Real-Time**: WebSockets (Socket.IO)
- **Authentication**: JWT with Passport.js
- **AI/ML**: OpenAI Agents API and OpenAI Realtime API

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS with Radix UI components
- **State Management**: TanStack Query (React Query)
- **Real-Time**: Socket.IO Client
- **Charts**: Recharts

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher)
- **PostgreSQL** (v12 or higher)
- **npm** or **yarn**
- **OpenAI API Key** (for AI agents and voice functionality)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd CallSphere
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
# Using psql
createdb callsphere

# Or using SQL
psql -U postgres
CREATE DATABASE callsphere;
```

### 3. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/callsphere"
JWT_SECRET="your-secret-key-change-in-production"
OPENAI_API_KEY="sk-your-openai-api-key"
PORT=3000
FRONTEND_URL="http://localhost:5173"
```

Run database migrations:

```bash
npx prisma migrate deploy
```

Seed the database with sample data:

```bash
npx prisma db seed
```

The seed script creates:
- 30-50 sample shipments with scan history
- Routes and route stops
- Sample delivery issues
- Escalation contacts
- Metric definitions
- Default dashboard configurations
- Test users for all roles

Start the backend development server:

```bash
npm run start:dev
```

The backend API will be available at `http://localhost:3000`

### 4. Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

Create a `.env` file in the `frontend` directory (if needed for API URL):

```env
VITE_API_URL=http://localhost:3000
```

Start the frontend development server:

```bash
npm run dev
```

The frontend application will be available at `http://localhost:5173`

## Default User Accounts

The seed script creates the following test accounts (password for all: `password123`):

- **Admin**: `admin@callsphere.com` - Full system access
- **Manager**: `manager@callsphere.com` - Dispatcher capabilities + escalation management
- **Dispatcher**: `dispatch@callsphere.com` - Regional shipment and issue management
- **Customer**: `customer@callsphere.com` - Customer portal access
- **Driver**: `driver@callsphere.com` - Route and stop management

Additional users are created during seeding with various roles and assignments.

## Demo Flows

### Demo 1: Track Shipment and Create Issue (Chat)

1. Log in as a customer (`customer@callsphere.com`)
2. Navigate to the Customer Dashboard
3. Use the chat interface to ask: "Where is my package ABC123?"
4. The AI agent will retrieve and display shipment status, last scan location, and ETA
5. Follow up with: "I want to report that my package arrived damaged"
6. The agent will collect details and create a delivery issue
7. Check the Admin/Ops dashboard to see the issue appear in real-time

### Demo 2: Request Delivery Change (Voice)

1. Log in as a customer
2. Navigate to the Customer Dashboard
3. Click the microphone button to start a voice session
4. Say: "I need to reschedule my delivery for tomorrow afternoon"
5. The voice agent will process your request, validate availability, and confirm the change
6. View the updated delivery information in your shipment details

### Demo 3: SLA Risk Escalation and Acknowledgment

1. Log in as an admin or manager
2. Navigate to the Admin/Ops Dashboard
3. View the Metrics Overview to identify shipments with high SLA risk scores
4. Navigate to the Issues queue and filter by severity
5. When a high-severity issue is created, the escalation system automatically triggers
6. View the escalation in the Escalations section
7. As a manager, acknowledge the escalation with notes
8. Observe the escalation status update in real-time

## Project Structure

```
CallSphere/
├── backend/                 # NestJS backend application
│   ├── prisma/             # Database schema and migrations
│   │   ├── schema.prisma   # Prisma schema definition
│   │   ├── migrations/     # Database migration files
│   │   └── seed.ts         # Database seeding script
│   ├── src/
│   │   ├── agent-sessions/ # AI session management
│   │   ├── ai/             # OpenAI agents and orchestration
│   │   ├── auth/           # Authentication and authorization
│   │   ├── delivery-changes/ # Delivery change requests
│   │   ├── escalations/    # Escalation workflow management
│   │   ├── events/         # WebSocket gateway and events
│   │   ├── issues/         # Delivery issue management
│   │   ├── metrics/        # Metrics computation and snapshots
│   │   ├── routes/         # Route and stop management
│   │   ├── shipments/      # Shipment tracking and management
│   │   └── users/          # User management
│   └── package.json
├── frontend/               # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── contexts/       # React contexts
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Page components
│   │   ├── services/       # API service layer
│   │   └── types/          # TypeScript type definitions
│   └── package.json
└── README.md
```

## API Documentation

### Authentication

All API requests (except login/register) require a JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

### Key Endpoints

- `POST /auth/login` - User authentication
- `GET /shipments` - List shipments (filtered by role)
- `GET /shipments/:id` - Get shipment details
- `GET /routes` - List routes
- `GET /issues` - List delivery issues
- `POST /issues` - Create a delivery issue
- `GET /metrics/overview` - Get metrics overview
- `POST /ai/chat` - Send chat message to AI agent
- `POST /ai/voice/session` - Create voice session

## WebSocket Events

The application uses WebSocket connections for real-time updates. Connect to `ws://localhost:3000` with a valid JWT token.

Available channels:
- `shipment:<trackingNumber>` - Shipment updates
- `routes:<routeCode>` - Route updates
- `issues` - Delivery issue updates
- `escalations` - Escalation events
- `metrics:overview` - Metric snapshot updates

Event types:
- `shipment.scan.created`
- `shipment.status.updated`
- `issue.created`
- `issue.updated`
- `escalation.triggered`
- `escalation.advanced`
- `escalation.acknowledged`
- `metrics.snapshot.created`

## Role-Based Access Control

The system implements five roles with distinct permissions:

### Customer
- Track own shipments
- Create issues for own shipments
- Request delivery changes for own shipments

### Driver
- View assigned routes and stops
- Update stop status (completed/failed)

### Dispatcher
- View/update shipments and issues within assigned region
- Manage route adjustments (within policy)
- Read metrics

### Manager
- All dispatcher capabilities
- Escalation acknowledgments
- Read metrics and edit certain thresholds

### Admin
- Full system access
- Edit metric definitions, thresholds, dashboard layouts
- Manage escalation ladders
- System configuration

## AI Agents

CallSphere uses a multi-agent architecture powered by OpenAI:

- **LogisticsRouterAgent**: Classifies user intent and routes to specialist agents
- **ShipmentTrackingAgent**: Retrieves shipment status, scans, and ETA information
- **DeliveryIssueAgent**: Collects issue details, classifies severity, and creates issues
- **DeliveryChangeAgent**: Validates and applies delivery change requests
- **LogisticsEscalationAgent**: Triggers and manages escalation workflows
- **LogisticsAnalyticsAgent**: Answers operational questions using metrics data

All agents use backend API tools to ensure data accuracy and consistency.

## Development

### Running Tests

Backend tests:

```bash
cd backend
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:cov      # Test coverage
```

### Database Migrations

Create a new migration:

```bash
cd backend
npx prisma migrate dev --name your-migration-name
```

Apply migrations in production:

```bash
npx prisma migrate deploy
```

### Code Formatting

Backend:

```bash
cd backend
npm run format
npm run lint
```

## Production Deployment

### Environment Variables

Ensure all environment variables are properly configured for production:

- Use a strong `JWT_SECRET`
- Set `DATABASE_URL` to your production database
- Configure `OPENAI_API_KEY` with your production API key
- Set appropriate `FRONTEND_URL` for CORS

### Build Commands

Backend:

```bash
cd backend
npm run build
npm run start:prod
```

Frontend:

```bash
cd frontend
npm run build
# Serve the dist/ directory with your web server
```

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running
- Check `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Ensure database exists and user has proper permissions

### OpenAI API Errors

- Verify `OPENAI_API_KEY` is set correctly
- Check API key has sufficient credits
- Ensure API key has access to Agents API and Realtime API

### WebSocket Connection Issues

- Verify backend is running on the expected port
- Check CORS configuration in `main.ts`
- Ensure JWT token is valid and not expired

## License

This project is private and proprietary.

## Support

For issues and questions, please contact the development team.
