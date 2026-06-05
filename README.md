# rtb-gis-schools-monitoring-system
RTB Schools GIS Monitoring &amp; Intelligence System

## Configuration

Copy `server/.env.example` to `server/.env` and fill in the values before starting the server.

### CORS (`APP_CORS_ORIGINS`)

Set `APP_CORS_ORIGINS` to a comma-separated list of allowed frontend origins:

```
# Development (default)
APP_CORS_ORIGINS=http://localhost:5173

# Production — replace with your actual frontend URL(s)
APP_CORS_ORIGINS=https://gis.rtb.gov.rw,https://admin.rtb.gov.rw
```

The server logs a warning at startup if `NODE_ENV=production` and any origin still points to `localhost`.
