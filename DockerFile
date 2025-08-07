# Stage 1: Build stage - where we install dependencies
FROM node:18-alpine AS builder

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application source code
COPY . .

# ---

# Stage 2: Production stage - a smaller, cleaner image
FROM node:18-alpine

WORKDIR /app

# Copy dependencies from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application code from the builder stage
COPY --from=builder /app .

# Expose the port the app runs on
EXPOSE 3000

# The command to run the application
CMD ["node", "src/server.js"]
