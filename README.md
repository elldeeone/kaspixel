# KasPixel

<p align="center">
  <img src="https://github.com/user-attachments/assets/f2d0ca44-b65c-4963-bf70-013eeadc4de7" alt="KasPixel Logo">
</p>

A real-time collaborative pixel art platform powered by Kaspa cryptocurrency. Users can place pixels on a 1000x1000 canvas, with each pixel placement requiring a payment through the KasWare Wallet integration.

## Features

- 1000x1000 pixel collaborative canvas
- Real-time updates using WebSocket
- KasWare Wallet integration for payments
- Default pricing: 0.2 KAS for 10 pixels (adjustable)
- Live balance display
- Color palette selection
- Transaction verification with real-time status updates

## Tech Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **State Management**: React Query & Zustand
- **Styling**: Tailwind CSS with shadcn/ui components
- **Real-time Updates**: WebSocket connection for canvas changes
- **Wallet Integration**: KasWare Wallet
- **API Communication**: Proxied requests to backend via Next.js API routes

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL for persistent storage
- **WebSocket**: FastAPI WebSocket support for real-time updates
- **Transaction Verification**: Integration with Kaspa public API
- **Containerization**: Docker and Docker Compose

## Architecture Overview

### Frontend Architecture
The frontend is built with Next.js and uses a component-based architecture:

- **Canvas Component**: Renders the pixel canvas with pan and zoom capabilities
- **Wallet Provider**: Manages wallet connection and transaction handling
- **Color Picker**: Allows users to select colors for pixel placement
- **Transaction Metrics**: Displays transaction verification times and statistics
- **API Proxy**: Next.js API routes proxy requests to the backend to avoid CORS issues

### Backend Architecture
The backend is built with FastAPI and provides:

- **REST API**: Endpoints for pixel placement, purchases, and wallet balance
- **WebSocket Server**: Real-time canvas updates to all connected clients
- **Transaction Verification**: Background tasks to verify Kaspa transactions
- **Database Integration**: PostgreSQL for storing pixels, transactions, and wallet balances

### Polling Mechanisms
The application uses two polling mechanisms for transaction verification:

1. **UX Timer Polling**: 
   - Starts immediately after a transaction is sent
   - Updates a visual timer to show the user how long verification is taking
   - Provides immediate feedback while waiting for blockchain confirmation

2. **Transaction Verification Polling**:
   - Polls the backend to check if a transaction has been verified on the blockchain
   - Once verified, initiates wallet balance polling to detect when pixels are added
   - Ensures pixels are only added for confirmed transactions
   - Automatically stops polling after verification or timeout

## Prerequisites

- Docker and Docker Compose
- Node.js 18+
- Python 3.10+
- PostgreSQL 14+
- KasWare Wallet

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/kaspixel.git
cd kaspixel
```

2. Install dependencies:
```bash
# Install root dependencies
npm install

# Install frontend dependencies
cd services/frontend
npm install
cd ../..
```

3. Configure environment:
```bash
# Copy the example environment file
cp .env.example .env

# Edit the .env file to set your Kaspa wallet address
# RECEIVER_ADDRESS=your-kaspa-wallet-address
```

4. Start the application:

### Production Mode with Local Build
```bash
docker-compose up -d
```

### Production Mode with Pre-built Images
```bash
# Use pre-built images from DockerHub
docker-compose -f docker-compose.prod.yml up -d
```

### Development Mode
```bash
docker-compose -f docker-compose.dev.yml up -d
```

5. Access the application:
- Frontend: http://localhost:3003
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## Docker Configuration

The project includes three Docker Compose configurations:

### Production with Local Build (docker-compose.yml)
- Builds the images locally from source code
- Optimized for production use
- Builds the Next.js application during Docker image creation
- No volume mounts for the frontend to preserve build artifacts
- Uses `npm run start` to serve the optimized build
- Configured for performance and reliability

### Production with Pre-built Images (docker-compose.prod.yml)
- Uses pre-built images from DockerHub (elldee/kaspixel-frontend:v1.0.0 and elldee/kaspixel-backend:v1.0.0)
- No local building required - faster startup
- Ideal for deployment or when you don't need to modify the code
- Includes restart policies for better reliability

### Development (docker-compose.dev.yml)
- Configured for development with hot reloading
- Mounts local directories as volumes for real-time code changes
- Uses `npm run dev` to enable Next.js development features
- Provides better debugging and development experience

## Development

### Frontend (Local Development)
```bash
cd services/frontend
npm install
npm run dev
```

The frontend will be available at http://localhost:3003 and will automatically proxy API requests to the backend.

### Backend (Local Development)
```bash
cd services/backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## API Proxy Configuration

The frontend uses Next.js API routes to proxy requests to the backend. This avoids CORS issues and simplifies deployment. The proxy configuration is defined in `next.config.mjs`:

```javascript
// Proxy configuration in next.config.mjs
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://backend:8000/api/:path*',
    },
    {
      source: '/ws',
      destination: 'http://backend:8000/ws',
    },
  ];
}
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 