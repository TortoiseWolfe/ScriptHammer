# syntax=docker/dockerfile:1
# ASP.NET Core messaging API (#266/#265) — mirrors the KDG multi-stage shape.

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS base
WORKDIR /app
COPY MessagingApi.sln .
COPY src/MessagingApi/MessagingApi.csproj src/MessagingApi/
RUN dotnet restore

FROM base AS dev
COPY . .
WORKDIR /app/src/MessagingApi
ENV DOTNET_WATCH_SUPPRESS_MSBUILD_INCREMENTALISM=1
ENTRYPOINT ["dotnet", "watch", "run", "--urls", "http://+:8080"]

FROM base AS build
COPY . .
RUN dotnet publish src/MessagingApi/MessagingApi.csproj -c Release -o /out

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS prod
WORKDIR /app
COPY --from=build /out .
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "MessagingApi.dll"]
