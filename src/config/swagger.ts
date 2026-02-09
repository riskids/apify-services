/**
 * Swagger/OpenAPI Configuration
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Apify Services API',
      version: '1.0.0',
      description: 'A modular, SOLID-compliant backend for web scraping using Apify actors',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server',
      },
      {
        url: 'https://api.example.com/api',
        description: 'Production server',
      },
    ],
    tags: [
      {
        name: 'Scraping',
        description: 'Web scraping operations',
      },
      {
        name: 'Jobs',
        description: 'Job management operations',
      },
      {
        name: 'Health',
        description: 'Health and status checks',
      },
    ],
    components: {
      schemas: {
        // Common Schemas
        ScrapingRequest: {
          type: 'object',
          required: ['platform', 'config'],
          properties: {
            platform: {
              type: 'string',
              enum: ['x', 'reddit'],
              description: 'Target platform for scraping',
              example: 'x',
            },
            config: {
              type: 'object',
              description: 'Platform-specific configuration',
              oneOf: [
                { $ref: '#/components/schemas/XConfig' },
                { $ref: '#/components/schemas/RedditConfig' },
              ],
            },
            options: {
              type: 'object',
              properties: {
                priority: {
                  type: 'string',
                  enum: ['low', 'normal', 'high'],
                  default: 'normal',
                  description: 'Job priority',
                },
                callbackUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'Callback URL for job completion',
                },
                webhookUrl: {
                  type: 'string',
                  format: 'uri',
                  description: 'Webhook URL for job updates',
                },
              },
            },
          },
        },

        XConfig: {
          type: 'object',
          required: ['keywords', 'startDate', 'endDate', 'maxItems'],
          properties: {
            keywords: {
              type: 'string',
              description: 'Search keywords',
              example: 'machine learning',
            },
            startDate: {
              type: 'string',
              format: 'date',
              description: 'Start date (YYYY-MM-DD)',
              example: '2024-01-01',
            },
            endDate: {
              type: 'string',
              format: 'date',
              description: 'End date (YYYY-MM-DD)',
              example: '2024-01-31',
            },
            maxItems: {
              type: 'integer',
              minimum: 1,
              maximum: 10000,
              description: 'Maximum number of items to scrape',
              example: 1000,
            },
          },
        },

        RedditConfig: {
          type: 'object',
          required: ['keywords', 'dateLimit', 'maxItems', 'sortBy'],
          properties: {
            keywords: {
              type: 'string',
              description: 'Search keywords (empty for all posts)',
              example: 'javascript',
            },
            dateLimit: {
              type: 'string',
              format: 'date',
              description: 'Date limit for posts (YYYY-MM-DD)',
              example: '2024-01-01',
            },
            maxItems: {
              type: 'integer',
              minimum: 1,
              description: 'Maximum items per subreddit',
              example: 100,
            },
            totalLimit: {
              type: 'integer',
              minimum: 0,
              default: 0,
              description: 'Total limit across all subreddits (0 = unlimited)',
              example: 1000,
            },
            sortBy: {
              type: 'string',
              enum: ['new', 'hot', 'top'],
              default: 'new',
              description: 'Sort order for posts',
              example: 'new',
            },
          },
        },

        ScrapingResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            jobId: {
              type: 'string',
              format: 'uuid',
              example: '550e8400-e29b-41d4-a716-446655440000',
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
              example: 'pending',
            },
            message: {
              type: 'string',
              example: 'Scraping job started successfully',
            },
          },
        },

        JobStatus: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            jobId: {
              type: 'string',
              format: 'uuid',
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
            },
            progress: {
              type: 'integer',
              minimum: 0,
              maximum: 100,
              description: 'Progress percentage',
              example: 50,
            },
            currentStep: {
              type: 'string',
              description: 'Current processing step',
              example: 'Processing range 2/5',
            },
            totalSteps: {
              type: 'integer',
              description: 'Total number of steps',
              example: 100,
            },
            errorMessage: {
              type: 'string',
              description: 'Error message if job failed',
              nullable: true,
            },
          },
        },

        JobResults: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            jobId: {
              type: 'string',
              format: 'uuid',
            },
            metadata: {
              type: 'object',
              properties: {
                platform: {
                  type: 'string',
                  example: 'x',
                },
                scrapedAt: {
                  type: 'string',
                  format: 'date-time',
                },
                completedAt: {
                  type: 'string',
                  format: 'date-time',
                },
                totalItems: {
                  type: 'integer',
                  example: 1000,
                },
                totalDuration: {
                  type: 'integer',
                  description: 'Duration in milliseconds',
                  example: 45000,
                },
              },
            },
            data: {
              oneOf: [
                { $ref: '#/components/schemas/XOutput' },
                { $ref: '#/components/schemas/RedditOutput' },
              ],
            },
            statistics: {
              type: 'object',
              properties: {
                totalItems: {
                  type: 'integer',
                  example: 1000,
                },
                duration: {
                  type: 'integer',
                  description: 'Duration in milliseconds',
                  example: 45000,
                },
                successRate: {
                  type: 'number',
                  example: 100,
                },
              },
            },
          },
        },

        XOutput: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/XPost',
              },
            },
            metadata: {
              type: 'object',
              properties: {
                keywords: {
                  type: 'string',
                },
                startDate: {
                  type: 'string',
                  format: 'date',
                },
                endDate: {
                  type: 'string',
                  format: 'date',
                },
                totalRanges: {
                  type: 'integer',
                },
                collectedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },

        XPost: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
            },
            text: {
              type: 'string',
            },
            url: {
              type: 'string',
              format: 'uri',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            author: {
              type: 'object',
              properties: {
                userName: {
                  type: 'string',
                },
                name: {
                  type: 'string',
                },
              },
            },
          },
        },

        RedditOutput: {
          type: 'object',
          properties: {
            posts: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/RedditPost',
              },
            },
            metadata: {
              type: 'object',
              properties: {
                keywords: {
                  type: 'string',
                },
                subreddits: {
                  type: 'array',
                  items: {
                    type: 'string',
                  },
                },
                dateLimit: {
                  type: 'string',
                  format: 'date',
                },
                maxItems: {
                  type: 'integer',
                },
                totalLimit: {
                  type: 'integer',
                },
                sortBy: {
                  type: 'string',
                },
                scrapedAt: {
                  type: 'string',
                  format: 'date-time',
                },
              },
            },
          },
        },

        RedditPost: {
          type: 'object',
          properties: {
            entityType: {
              type: 'string',
              example: 'post',
            },
            entityId: {
              type: 'string',
            },
            redditId: {
              type: 'string',
            },
            permalink: {
              type: 'string',
              format: 'uri',
            },
            headline: {
              type: 'string',
            },
            textBody: {
              type: 'string',
            },
            mediaBundle: {
              type: 'object',
              properties: {
                primaryUrl: {
                  type: 'string',
                  format: 'uri',
                },
                thumbnailUrl: {
                  type: 'string',
                  format: 'uri',
                },
                isVideo: {
                  type: 'boolean',
                },
              },
            },
            authorHandle: {
              type: 'string',
            },
            communityTag: {
              type: 'string',
            },
            voteScore: {
              type: 'integer',
            },
            commentTotal: {
              type: 'integer',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            collectedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        JobList: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            jobs: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/JobSummary',
              },
            },
            count: {
              type: 'integer',
            },
          },
        },

        JobSummary: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
            },
            platform: {
              type: 'string',
            },
            status: {
              type: 'string',
              enum: ['pending', 'running', 'completed', 'failed', 'cancelled'],
            },
            progress: {
              type: 'object',
              properties: {
                percentage: {
                  type: 'integer',
                },
                currentStep: {
                  type: 'string',
                },
                totalSteps: {
                  type: 'integer',
                },
              },
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },

        HealthStatus: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
            },
            status: {
              type: 'string',
              enum: ['healthy', 'unhealthy', 'degraded'],
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
            },
            services: {
              type: 'object',
              properties: {
                api: {
                  type: 'boolean',
                },
                apify: {
                  type: 'boolean',
                },
              },
            },
            details: {
              type: 'object',
              properties: {
                availableTokens: {
                  type: 'integer',
                },
              },
            },
          },
        },

        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'object',
              properties: {
                message: {
                  type: 'string',
                },
                code: {
                  type: 'string',
                },
                details: {
                  type: 'object',
                },
              },
            },
          },
        },
      },

      responses: {
        BadRequest: {
          description: 'Bad request - validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'Validation failed: Platform is required',
                  code: 'VALIDATION_ERROR',
                },
              },
            },
          },
        },

        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'Job 550e8400-e29b-41d4-a716-446655440000 not found',
                  code: 'NOT_FOUND',
                },
              },
            },
          },
        },

        TooManyRequests: {
          description: 'Rate limit exceeded',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'Too many requests, please try again later',
                  code: 'RATE_LIMIT',
                },
              },
            },
          },
        },

        InternalError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error',
              },
              example: {
                success: false,
                error: {
                  message: 'An unexpected error occurred',
                  code: 'INTERNAL_ERROR',
                },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts', './src/controllers/*.ts'], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);
