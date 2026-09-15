#!/bin/bash
echo "=================================================="
echo "PREPARAZIONE CONFIGURAZIONE CLOUD HOSTING GRATUITO"
echo "=================================================="

# 1. Creazione Dockerfile per Koyeb / Render
cat << 'DOCKER' > Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["node", "engine-server.mjs"]
DOCKER

# 2. Configurazione Render.com (render.yaml per deploy in 1 click)
cat << 'RENDER' > render.yaml
services:
  - type: web
    name: nexuspay-settlement-engine
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node engine-server.mjs
    envVars:
      - key: PORT
        value: 3000
RENDER

# 3. Aggiorna package.json per start automatico
npm pkg set scripts.start="node engine-server.mjs"

echo "✔ File Dockerfile e render.yaml generati con successo!"
echo "--------------------------------------------------"
echo "Per andare live su internet a 0 €:"
echo " 1. Fai il push di questa cartella su un repo GitHub pubblico o privato."
echo " 2. Vai su https://render.com o https://koyeb.com e importa il repo."
echo " 3. Seleziona il tier Free: il server e la dApp saranno online H24."
echo "=================================================="
