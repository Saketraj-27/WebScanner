# XSS Guard - Enterprise Website Security Monitoring Platform

XSS Guard is a comprehensive enterprise-grade platform for monitoring website security vulnerabilities, with a focus on Cross-Site Scripting (XSS) detection. It provides real-time scanning, scheduled monitoring, team collaboration, and automated reporting capabilities.

## Features

- **Real-time XSS Detection**: Advanced scanning engine that identifies XSS vulnerabilities in web applications
- **Scheduled Scans**: Automated periodic security monitoring with customizable schedules
- **Team Collaboration**: Multi-user support with role-based access control and team management
- **Real-time Notifications**: Socket.IO-powered live updates on scan progress and results
- **Webhook Integration**: Automated notifications to external systems via webhooks
- **API Key Management**: Secure API access for integrations
- **Baseline Comparisons**: Track security changes over time with diff analysis
- **Comprehensive Reporting**: Detailed security reports with PDF generation
- **Rate Limiting**: Built-in protection against abuse with configurable limits
- **SSRF Protection**: Server-side request forgery prevention middleware

## Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (version 16 or higher)
- **MongoDB** (version 4.4 or higher)
- **Redis** (version 5 or higher)
- **npm** or **yarn** package manager

## Installation

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the backend directory with the following variables:
   ```
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/xss-guard
   JWT_SECRET=your-super-secret-jwt-key-here
   REDIS_URL=redis://localhost:6379
   FRONTEND_URL=http://localhost:5173
   ```

4. Start MongoDB and Redis services on your system.

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

## Running the Application

### Development Mode

1. **Start the Backend**:
   ```bash
   cd backend
   npm run dev
   ```
   The backend server will start on `http://localhost:5000`

2. **Start the Frontend**:
   ```bash
   cd frontend
   npm run dev
   ```
   The frontend will be available at `http://localhost:5173`

### Production Mode

1. **Build the Frontend**:
   ```bash
   cd frontend
   npm run build
   ```

2. **Start the Backend**:
   ```bash
   cd backend
   npm start
   ```

## How It Works

### Architecture Overview

XSS Guard consists of three main components:

1. **Frontend (React + Vite)**: User interface for managing scans, viewing results, and team administration
2. **Backend (Node.js + Express)**: RESTful API server handling authentication, scan orchestration, and data management
3. **Worker Process**: Background job processor using BullMQ for handling scan tasks asynchronously

### Security Scanning Process

1. **URL Submission**: Users submit website URLs through the frontend interface
2. **Queue Processing**: URLs are added to a Redis-backed job queue for asynchronous processing
3. **Vulnerability Detection**: The scanner service uses Puppeteer to render pages and Cheerio for DOM analysis to detect XSS vulnerabilities
4. **Result Storage**: Scan results are stored in MongoDB with detailed vulnerability information
5. **Real-time Updates**: Socket.IO provides live progress updates to connected clients
6. **Reporting**: Results can be exported as PDF reports or sent via webhooks

### Key Components

- **Authentication System**: JWT-based auth with bcrypt password hashing
- **Scan Engine**: Puppeteer-powered browser automation for comprehensive XSS detection
- **Queue System**: BullMQ for reliable background job processing
- **Database Models**: Mongoose schemas for Users, Teams, Scans, Webhooks, and API Keys
- **Middleware**: Rate limiting, CORS, SSRF protection, and authentication guards
- **Real-time Communication**: Socket.IO for live scan status updates

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile

### Scanning
- `POST /api/scan` - Initiate a new scan
- `GET /api/scan/:id` - Get scan results
- `GET /api/scan/history` - Get scan history

### Teams
- `POST /api/teams` - Create a team
- `GET /api/teams` - List user's teams
- `POST /api/teams/:id/members` - Add team member

### Scheduled Scans
- `POST /api/scheduled-scans` - Create scheduled scan
- `GET /api/scheduled-scans` - List scheduled scans
- `PUT /api/scheduled-scans/:id` - Update scheduled scan

### Webhooks
- `POST /api/webhooks` - Create webhook
- `GET /api/webhooks` - List webhooks
- `DELETE /api/webhooks/:id` - Delete webhook

## Testing

### Backend Tests
```bash
cd backend
npm test
```

### Integration Tests
```bash
cd backend
npm run test:integration
```

### Test Coverage
```bash
cd backend
npm run test:coverage
```

## Database Population

For development purposes, you can populate the database with test data:

```bash
node populate_db.js
```

Or create custom test data:

```bash
node create_test_data.js
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | development |
| `PORT` | Server port | 5000 |
| `MONGODB_URI` | MongoDB connection string | mongodb://localhost:27017/xss-guard |
| `JWT_SECRET` | JWT signing secret | (required) |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379 |
| `FRONTEND_URL` | Frontend application URL | http://localhost:5173 |

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the ISC License.
