# Apify Services API Documentation

Complete API documentation for the Apify Services web scraping backend.

## Overview

- **Base URL**: `http://localhost:3000/api`
- **Documentation URL**: `http://localhost:3000/api/docs`
- **OpenAPI Spec**: `http://localhost:3000/api/docs/json`

## Authentication

Currently, the API does not require authentication. Rate limiting is applied to prevent abuse.

## Rate Limiting

- **General endpoints**: 100 requests per 15 minutes
- **Scraping endpoints**: 10 requests per hour

## Endpoints

### Health Check

#### GET /health

Returns the overall health status of the API.

**Response:**

```json
{
  "success": true,
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "api": true,
    "apify": true
  },
  "details": {
    "availableTokens": 3
  }
}
```

#### GET /health/ready

Checks if the service is ready to accept requests.

**Response:**

```json
{
  "success": true,
  "ready": true,
  "tokensAvailable": 3
}
```

#### GET /health/live

Basic liveness check.

**Response:**

```json
{
  "success": true,
  "alive": true,
  "timestamp": "2024-01-15T10:00:00Z"
}
```

---

### Scraping

#### POST /scrape

Start a new scraping job.

**Request Body:**

**For X (Twitter):**

```json
{
  "platform": "x",
  "config": {
    "keywords": "machine learning",
    "startDate": "2024-01-01",
    "endDate": "2024-01-31",
    "maxItems": 1000
  },
  "options": {
    "priority": "normal"
  }
}
```

**For Reddit:**

```json
{
  "platform": "reddit",
  "config": {
    "keywords": "javascript",
    "dateLimit": "2024-01-01",
    "maxItems": 100,
    "totalLimit": 1000,
    "sortBy": "new"
  },
  "options": {
    "priority": "high"
  }
}
```

**Response:**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Scraping job started successfully"
}
```

**Status Codes:**

- `201` - Job created successfully
- `400` - Validation error
- `429` - Rate limit exceeded
- `500` - Internal server error

---

#### GET /scrape/jobs

List all scraping jobs with optional filtering.

**Query Parameters:**

| Parameter | Type   | Description                              |
|-----------|--------|------------------------------------------|
| platform  | string | Filter by platform (`x`, `reddit`)       |
| status    | string | Filter by status                         |
| limit     | int    | Maximum number of jobs (1-100)           |

**Example:**

```
GET /scrape/jobs?platform=x&status=completed&limit=10
```

**Response:**

```json
{
  "success": true,
  "jobs": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "platform": "x",
      "status": "completed",
      "progress": {
        "percentage": 100,
        "currentStep": "Completed",
        "totalSteps": 100
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "count": 1
}
```

---

#### GET /scrape/:jobId

Get the status of a specific job.

**Parameters:**

| Parameter | Type   | Description       |
|-----------|--------|-------------------|
| jobId     | string | UUID of the job   |

**Response:**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "progress": 50,
  "currentStep": "Processing range 2/5",
  "totalSteps": 100
}
```

**Status Codes:**

- `200` - Success
- `404` - Job not found
- `500` - Internal server error

---

#### GET /scrape/:jobId/results

Get the results of a completed job.

**Parameters:**

| Parameter | Type   | Description       |
|-----------|--------|-------------------|
| jobId     | string | UUID of the job   |

**Response (X Platform):**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "platform": "x",
    "scrapedAt": "2024-01-15T10:00:00Z",
    "completedAt": "2024-01-15T10:01:00Z",
    "totalItems": 1000,
    "totalDuration": 60000
  },
  "data": {
    "posts": [
      {
        "id": "1234567890",
        "text": "Tweet content here...",
        "url": "https://twitter.com/user/status/1234567890",
        "createdAt": "2024-01-15T09:00:00Z",
        "author": {
          "userName": "username",
          "name": "Display Name"
        }
      }
    ],
    "metadata": {
      "keywords": "machine learning",
      "startDate": "2024-01-01",
      "endDate": "2024-01-31",
      "totalRanges": 10,
      "collectedAt": "2024-01-15T10:01:00Z"
    }
  },
  "statistics": {
    "totalItems": 1000,
    "duration": 60000,
    "successRate": 100
  }
}
```

**Response (Reddit Platform):**

```json
{
  "success": true,
  "jobId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "platform": "reddit",
    "scrapedAt": "2024-01-15T10:00:00Z",
    "completedAt": "2024-01-15T10:02:00Z",
    "totalItems": 500,
    "totalDuration": 120000
  },
  "data": {
    "posts": [
      {
        "entityType": "post",
        "entityId": "t3_abc123",
        "redditId": "abc123",
        "permalink": "https://reddit.com/r/javascript/comments/abc123/title",
        "headline": "Post Title",
        "textBody": "Post content...",
        "mediaBundle": {
          "primaryUrl": "https://example.com/image.jpg",
          "thumbnailUrl": "https://example.com/thumb.jpg",
          "isVideo": false
        },
        "authorHandle": "username",
        "communityTag": "r/javascript",
        "voteScore": 150,
        "commentTotal": 25,
        "createdAt": "2024-01-15T08:00:00Z",
        "collectedAt": "2024-01-15T10:02:00Z"
      }
    ],
    "metadata": {
      "keywords": "javascript",
      "subreddits": ["javascript", "webdev", "programming"],
      "dateLimit": "2024-01-01",
      "maxItems": 100,
      "totalLimit": 1000,
      "sortBy": "new",
      "scrapedAt": "2024-01-15T10:02:00Z"
    }
  },
  "statistics": {
    "totalItems": 500,
    "duration": 120000,
    "successRate": 100
  }
}
```

**Status Codes:**

- `200` - Success
- `400` - Job not completed yet
- `404` - Job or results not found
- `500` - Internal server error

---

#### DELETE /scrape/:jobId

Cancel a pending or running job.

**Parameters:**

| Parameter | Type   | Description       |
|-----------|--------|-------------------|
| jobId     | string | UUID of the job   |

**Response:**

```json
{
  "success": true,
  "message": "Job cancelled successfully"
}
```

**Status Codes:**

- `200` - Job cancelled
- `400` - Job cannot be cancelled (already completed/failed)
- `404` - Job not found
- `500` - Internal server error

---

## Data Models

### ScrapingRequest

| Field    | Type   | Required | Description                      |
|----------|--------|----------|----------------------------------|
| platform | string | Yes      | Target platform (`x`, `reddit`)  |
| config   | object | Yes      | Platform-specific configuration  |
| options  | object | No       | Optional scraping options        |

### XConfig

| Field     | Type    | Required | Description                    |
|-----------|---------|----------|--------------------------------|
| keywords  | string  | Yes      | Search keywords                |
| startDate | string  | Yes      | Start date (YYYY-MM-DD)        |
| endDate   | string  | Yes      | End date (YYYY-MM-DD)          |
| maxItems  | integer | Yes      | Maximum items to scrape        |

### RedditConfig

| Field      | Type    | Required | Description                          |
|------------|---------|----------|--------------------------------------|
| keywords   | string  | Yes      | Search keywords                      |
| dateLimit  | string  | Yes      | Date limit (YYYY-MM-DD)              |
| maxItems   | integer | Yes      | Max items per subreddit              |
| totalLimit | integer | No       | Total limit (0 = unlimited)          |
| sortBy     | string  | Yes      | Sort order (`new`, `hot`, `top`)     |

### ScrapingOptions

| Field       | Type   | Required | Description                    |
|-------------|--------|----------|--------------------------------|
| priority    | string | No       | Job priority (`low`, `normal`, `high`) |
| callbackUrl | string | No       | Callback URL for completion    |
| webhookUrl  | string | No       | Webhook URL for updates        |

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Error Codes

| Code              | Description                    | HTTP Status |
|-------------------|--------------------------------|-------------|
| VALIDATION_ERROR  | Request validation failed      | 400         |
| NOT_FOUND         | Resource not found             | 404         |
| RATE_LIMIT        | Rate limit exceeded            | 429         |
| TOKENS_EXHAUSTED  | All Apify tokens exhausted     | 503         |
| INTERNAL_ERROR    | Internal server error          | 500         |

---

## Job Status Lifecycle

```
pending → running → completed
   ↓         ↓
   └─────→ failed
   ↓
   └─────→ cancelled
```

| Status    | Description                              |
|-----------|------------------------------------------|
| pending   | Job is queued and waiting to start       |
| running   | Job is currently being processed         |
| completed | Job finished successfully                |
| failed    | Job failed due to an error               |
| cancelled | Job was cancelled by user                |

---

## Examples

### cURL Examples

**Start X Scraping:**

```bash
curl -X POST http://localhost:3000/api/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "x",
    "config": {
      "keywords": "artificial intelligence",
      "startDate": "2024-01-01",
      "endDate": "2024-01-31",
      "maxItems": 500
    }
  }'
```

**Check Job Status:**

```bash
curl http://localhost:3000/api/scrape/550e8400-e29b-41d4-a716-446655440000
```

**Get Job Results:**

```bash
curl http://localhost:3000/api/scrape/550e8400-e29b-41d4-a716-446655440000/results
```

**Cancel Job:**

```bash
curl -X DELETE http://localhost:3000/api/scrape/550e8400-e29b-41d4-a716-446655440000
```

---

## Swagger UI

Interactive API documentation is available at:

```
http://localhost:3000/api/docs
```

You can test all endpoints directly from the Swagger UI interface.
