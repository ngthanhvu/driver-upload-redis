# Drive App

A cloud storage/file drive application built with modern web technologies, allowing users to store, manage, and share files securely.

## 🚀 Features

- **File Upload & Storage**: Securely upload and store files in the cloud
- **File Management**: Organize files with folders and metadata
- **User Authentication**: Secure login and account management
- **Object Storage**: Powered by MinIO (S3 API) for temporary and permanent files
- **Responsive UI**: Mobile-friendly interface built with Vue.js

## 🛠️ Tech Stack

### Frontend
- **Vue.js 3**: Progressive JavaScript framework for building user interfaces
- **TypeScript**: Strong typing for improved code quality and maintainability
- **Vite**: Fast build tool and development server

### Backend
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework for Node.js
- **TypeScript**: Type-safe server-side development

### Database & Storage
- **MongoDB**: NoSQL document database for storing application data
- **MinIO / S3**: Object storage for files with TTL cleanup support

### Infrastructure
- **Docker**: Containerization platform for consistent deployments
- **Docker Compose**: Multi-container application management

## 📁 Project Structure

```
drive-app/
├── backend/              # Express.js server
│   ├── src/
│   │   ├── config/       # Configuration files
│   │   ├── controllers/  # Request handlers
│   │   ├── middleware/   # Custom middleware
│   │   ├── models/       # Database models
│   │   └── routes/       # API route definitions
│   └── ...
├── frontend/             # Vue.js application
│   ├── public/           # Static assets
│   ├── src/
│   │   ├── components/   # Reusable Vue components
│   │   ├── views/        # Page components
│   │   └── ...
│   └── ...
├── docker-compose.yml    # Development environment
├── docker-compose.prod.yml # Production environment
└── ...
```

## 🚀 Getting Started

### Prerequisites

- [Docker](https://www.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)

### Development Setup

1. Clone the repository:
```bash
git clone https://github.com/your-username/drive-app.git
cd drive-app
```

2. Start the development environment:
```bash
docker-compose up --build
```

3. Access the application:
   - Frontend: [http://localhost:5173](http://localhost:5173)
   - Backend API: [http://localhost:5000](http://localhost:5000)

### Production Setup

1. Deploy with Docker Compose:
```bash
docker-compose -f docker-compose.prod.yml up -d --build
```

2. The application will be available at [http://localhost](http://localhost)

## 🔧 Environment Variables

### Backend

Create a `.env` file in the `backend/` directory with the following variables:

```env
PORT=5000
MONGO_URI=mongodb://mongo:27017/driveapp
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=drive-documents
UPLOAD_AUTH_TOKEN=change-me
CORS_ORIGIN=http://localhost:5173
```

### Frontend

The frontend uses Vite environment variables. Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE=http://localhost:5000
```

## 🧪 Testing

### Backend Tests

Navigate to the backend directory and run:

```bash
cd backend
npm test
```

### Frontend Tests

Navigate to the frontend directory and run:

```bash
cd frontend
npm run test
```

## 🚢 Deployment

The application is designed for containerized deployment using Docker. Both development and production configurations are provided.

For production deployment:
1. Update environment variables in the production compose file
2. Run `docker-compose -f docker-compose.prod.yml up -d --build`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License.

## 🐳 Docker Services

The application consists of four services:

- **frontend**: Vue.js application served via Vite in development or Nginx in production
- **backend**: Express.js API server
- **mongo**: MongoDB database for persistent storage
- **minio/s3**: Object storage for temporary files (TTL) and permanent authenticated uploads

## 🔒 Security

- Passwords are hashed using bcrypt
- Upload token authentication for permanent storage route
- Input validation and sanitization
- CORS configured for secure cross-origin requests
- test