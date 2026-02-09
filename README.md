# Apify Services

A modular, SOLID-compliant backend for web scraping using Apify actors. The architecture is designed to easily accommodate new scraping actors while maintaining code quality and maintainability.

## Features

- **Modular Architecture**: Easy to add new scraping actors
- **SOLID Principles**: Clean, maintainable code
- **Token Rotation**: Automatic token management for Apify API
- **Queue Management**: Concurrent job processing with configurable limits
- **Progress Tracking**: Real-time job progress updates
- **RESTful API**: Clean API endpoints for job management
- **Rate Limiting**: Built-in protection against abuse
- **Comprehensive Logging**: Winston-based logging system
- **Interactive API Docs**: Swagger/OpenAPI documentation

## Supported Platforms

- **X (Twitter)**: Search tweets by keywords with date range
- **Reddit**: Scrape posts from multiple subreddits

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configuration

Copy the example environment file and configure:

```bash
cp config/.env.example config/.env
```

Edit `config/.env` with your settings:

```env
PORT=3000
LOG_LEVEL=info
```

### 3. Add Apify Tokens

Add your Apify tokens to `config/apify-token.txt` (one per line):

```
apify_api_your_token_1
apify_api_your_token_2
```

### 4. Configure Subreddits (for Reddit scraping)

Edit `config/subreddit.txt`:

```
technology
programming
webdev
```

### 5. Start Server

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### 6. Access API Documentation

Once the server is running, open your browser and navigate to:

```
http://localhost:3000/api/docs
```

This will show the interactive Swagger UI where you can explore and test all API endpoints.

## API Documentation

### Interactive Documentation

- **Swagger UI**: `http://localhost:3000/api/docs`
- **OpenAPI Spec**: `http://localhost:3000/api/docs/json`

### Quick API Reference

#### Start Scraping Job

```http
POST /api/scrape
Content-Type: application/json

{
  "platform": "x",
  "config": {
    "keywords": "AI",
    "startDate": "2024-01-01",
    "endDate": "2024-02-01",
    "maxItems": 1000
  }
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "uuid",
  "status": "pending",
  "message": "Scraping job started successfully"
}
```

#### Get Job Status

```http
GET /api/scrape/:jobId
```

**Response:**

```json
{
  "success": true,
  "jobId": "uuid",
  "status": "running",
  "progress": 50,
  "currentStep": "Processing range 2/5"
}
```

#### Get Job Results

```http
GET /api/scrape/:jobId/results
```

**Response:**

```json
{
  "success": true,
  "jobId": "uuid",
  "metadata": {
    "platform": "x",
    "scrapedAt": "2024-01-15T10:00:00Z",
    "totalItems": 1000,
    "totalDuration": 45000
  },
  "data": {
    "posts": [...]
  },
  "statistics": {
    "totalItems": 1000,
    "duration": 45000,
    "successRate": 100
  }
}
```

For complete API documentation, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md) or visit the Swagger UI at `/api/docs`.

## Platform-Specific Configurations

### X (Twitter)

```json
{
  "platform": "x",
  "config": {
    "keywords": "machine learning",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "maxItems": 500
  }
}
```

### Reddit

```json
{
  "platform": "reddit",
  "config": {
    "keywords": "javascript",
    "dateLimit": "2024-01-01",
    "maxItems": 100,
    "totalLimit": 1000,
    "sortBy": "new"
  }
}
```

## Architecture

```
src/
├── actors/           # Actor implementations
│   ├── base/         # Base actor class
│   ├── x/            # X/Twitter actor
│   └── reddit/       # Reddit actor
├── clients/          # External service clients
├── config/           # Configuration
│   └── swagger.ts    # Swagger/OpenAPI config
├── controllers/      # API controllers
├── dto/              # Data Transfer Objects
├── middleware/       # Express middleware
├── repositories/     # Data access layer
├── routes/           # API routes
│   └── docs.routes.ts # Swagger documentation routes
├── services/         # Business logic
├── types/            # TypeScript types
└── utils/            # Utilities
```

## Adding a New Actor

1. Create actor folder: `src/actors/youtube/`
2. Define interfaces: `YoutubeInput.ts`
3. Implement actor: `YoutubeActor.ts`
4. Register in `ActorRegistry`

Example:

```typescript
export class YoutubeActor extends BaseActor<YoutubeInput, YoutubeOutput> {
  public getPlatform(): string {
    return 'youtube';
  }

  protected getActorId(): string {
    return 'your-youtube-actor-id';
  }

  protected async validateInput(input: YoutubeInput): Promise<void> {
    // Validation logic
  }

  protected async executeScraping(input: YoutubeInput): Promise<YoutubeOutput> {
    // Scraping logic
  }

  protected transformData(rawData: any): YoutubeOutput {
    // Transformation logic
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment | development |
| `LOG_LEVEL` | Logging level | info |
| `LOG_DIR` | Log directory | ./logs |
| `OUTPUT_DIR` | Output directory | ./output |
| `APIFY_TOKEN_FILE_PATH` | Path to token file | ./config/apify-token.txt |
| `MAX_CONCURRENT_JOBS` | Max concurrent jobs | 5 |
| `RATE_LIMIT_MAX_REQUESTS` | Rate limit max requests | 100 |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | 900000 |

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/docs` | Swagger UI documentation |
| GET | `/api/docs/json` | OpenAPI specification |
| GET | `/api/health` | Health check |
| GET | `/api/health/ready` | Readiness check |
| GET | `/api/health/live` | Liveness check |
| POST | `/api/scrape` | Start scraping job |
| GET | `/api/scrape/jobs` | List all jobs |
| GET | `/api/scrape/:jobId` | Get job status |
| GET | `/api/scrape/:jobId/results` | Get job results |
| DELETE | `/api/scrape/:jobId` | Cancel job |

## License

MIT
# apify-services
