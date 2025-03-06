FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Set NODE_ENV to production
ENV NODE_ENV=production

# Build the Next.js application
RUN npm run build

# Expose the port
EXPOSE 3000

# Start the application in production mode
CMD ["npm", "run", "start"] 