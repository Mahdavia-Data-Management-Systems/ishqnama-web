# ---------- build stage ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Restore dependencies (cached unless .csproj changes)
COPY src/Ishqnama.Api/Ishqnama.Api.csproj src/Ishqnama.Api/
RUN dotnet restore src/Ishqnama.Api/Ishqnama.Api.csproj

# Publish app
COPY src/ src/
RUN dotnet publish src/Ishqnama.Api -c Release -o /app/publish

# ---------- runtime stage ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

# curl is needed for the container health check
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/publish .

EXPOSE 8000
ENV ASPNETCORE_URLS=http://+:8000
ENV ConnectionStrings__QuranDb="Host=ishqnama-db;Port=5432;Database=ishqnama;Username=postgres;Password=postgres"
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8000/healthz || exit 1

# Run as non-root
USER $APP_UID
ENTRYPOINT ["dotnet", "Ishqnama.Api.dll"]
