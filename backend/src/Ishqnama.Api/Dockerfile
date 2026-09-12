# Build context is backend/ (docker build -f src/Ishqnama.Api/Dockerfile .)

# ---- build -----------------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY global.json ./
COPY src/ src/

# The csproj switches to linux-x64 / self-contained / trimmed only under `dotnet publish`
# (via _IsPublishing), so the implicit restore here picks up the right runtime packs.
RUN dotnet publish src/Ishqnama.Api/Ishqnama.Api.csproj -c Release -o /app

# ---- runtime ---------------------------------------------------------------------------------
# Chiseled runtime-deps: glibc + CA certs only, no shell, non-root. The published output is
# self-contained so no .NET runtime image is needed.
FROM mcr.microsoft.com/dotnet/runtime-deps:9.0-noble-chiseled AS runtime
WORKDIR /app

COPY --from=build /app ./

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0

EXPOSE 8080
USER $APP_UID

ENTRYPOINT ["./Ishqnama.Api"]
