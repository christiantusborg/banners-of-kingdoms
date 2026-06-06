# .NET 10 API build + runtime
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY Game.WebApi.csproj ./
RUN dotnet restore Game.WebApi.csproj
COPY . .
RUN dotnet publish Game.WebApi.csproj -c Release -o /app /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
COPY --from=build /app ./
# game.db lives in /data so a docker volume can persist it across container rebuilds.
ENV ASPNETCORE_URLS=http://+:5118
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ConnectionStrings__DefaultConnection="Data Source=/data/game.db"
EXPOSE 5118
ENTRYPOINT ["dotnet", "Game.WebApi.dll"]
