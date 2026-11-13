# Proxy sécurisé de l'API financière — zéro dépendance npm (voir server.mjs)
FROM node:20-alpine
WORKDIR /app
COPY server.mjs lib.mjs ./
EXPOSE 3100
CMD ["node", "server.mjs"]
