# Use a Node.js slim image as the base image
FROM node:16-slim

# Install socat for port forwarding
RUN apt-get update && apt-get install -y socat

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install Node.js dependencies
RUN npm install

# Copy the entire application code to the container
COPY . .

# Expose the port that the application runs
EXPOSE 3000

# Start socat to forward localhost:8081 to keycloak:8080, then start the Node.js application
CMD socat TCP-LISTEN:8081,fork TCP:keycloak:8080 & node index.js

