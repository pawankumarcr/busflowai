# Stage 1: Build the application using Gradle & Java 21 JDK
FROM eclipse-temurin:21-jdk-alpine AS builder

WORKDIR /app

# Copy gradle wrapper and project definition files
COPY gradlew gradlew.bat ./
COPY gradle gradle
COPY build.gradle settings.gradle ./

# Copy source code and resources
COPY src src

# Make Gradle wrapper executable and build bootJar
RUN chmod +x ./gradlew && ./gradlew bootJar --no-daemon -x test

# Stage 2: Create lightweight runtime container
FROM eclipse-temurin:21-jre-alpine AS runner

WORKDIR /app

# Create a non-root system user and group for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built JAR from stage 1
COPY --from=builder /app/build/libs/*.jar app.jar

# Set file ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose default application port
EXPOSE 8080

# Environment variables
ENV PORT=8080 \
    JAVA_OPTS="-XX:+UseG1GC -XX:MaxRAMPercentage=75.0"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/ || exit 1

# Entrypoint
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
