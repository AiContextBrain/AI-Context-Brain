# ============================================
# Railway Deployment - .NET 9 Backend API
# Multi-stage build for production
# ============================================

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy csproj and restore dependencies
COPY AiContextBrain.csproj ./
RUN dotnet restore AiContextBrain.csproj

# Copy source code and build
COPY . ./
RUN dotnet publish AiContextBrain.csproj -c Release -o /app/publish --no-restore

# Stage 2: Runtime
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app

ARG PORT=5001
ENV PORT=${PORT}

# Install PostgreSQL client (for health checks)
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy published app
COPY --from=build /app/publish ./

# Railway provides PORT environment variable
# App will use $PORT if available, fallback to 5001
ENV ASPNETCORE_URLS=http://0.0.0.0:${PORT:-5001}
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD pg_isready -d $ConnectionStrings__DefaultConnection || exit 1

EXPOSE ${PORT:-5001}

ENTRYPOINT ["dotnet", "AiContextBrain.dll"]
