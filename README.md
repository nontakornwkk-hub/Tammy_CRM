# Tammy CRM

A minimal Node.js HTTP service with no runtime dependencies.

## Requirements

- Node.js 18 or newer

## Run

```bash
npm start
```

The service listens on `http://localhost:3000` by default. Set `PORT` to use a different port.

## Test

```bash
npm test
```

## Endpoints

- `GET /health` — returns `{ "status": "ok" }`
