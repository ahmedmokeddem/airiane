FROM node:24.11.1-bookworm-slim AS dependencies
WORKDIR /app/portal
COPY portal/package.json portal/package-lock.json ./
RUN npm ci
FROM dependencies AS build
COPY portal ./
COPY contracts/generated/api.ts /app/contracts/generated/api.ts
RUN NEXT_TELEMETRY_DISABLED=1 npm run build
FROM node:24.11.1-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 PORTAL_DATA_MODE=api PORTAL_DEMO_AUTH=false
WORKDIR /app
COPY --from=build --chown=node:node /app/portal/.next/standalone ./
COPY --from=build --chown=node:node /app/portal/.next/static ./portal/.next/static
COPY --from=build --chown=node:node /app/portal/public ./portal/public
COPY --chown=node:node portal/scripts/start.mjs ./scripts/start.mjs
COPY --chown=node:node portal/lib/runtime-config.mjs ./lib/runtime-config.mjs
USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "scripts/start.mjs"]
