# WCAG AA Compliance API Specifications

## Overview

This document defines the API contracts for the WCAG AA compliance system. The APIs provide programmatic access to accessibility test results, dashboard data, and configuration management.

## Base Configuration

**Base URL:** `/api/accessibility`
**Content Type:** `application/json`
**Authentication:** None (internal APIs)
**Rate Limiting:** None (internal usage)

## Endpoints

### 1. Accessibility Results API

#### GET /api/accessibility/results

Retrieves accessibility test results with pagination and filtering.

**Query Parameters:**

```typescript
interface ResultsQuery {
  page?: number; // Page number (default: 1)
  limit?: number; // Results per page (default: 20, max: 100)
  url?: string; // Filter by specific URL
  standard?: 'WCAG2AA' | 'WCAG2AAA'; // Filter by testing standard
  runner?: 'pa11y' | 'axe' | 'htmlcs'; // Filter by testing tool
  passed?: boolean; // Filter by pass/fail status
  since?: string; // ISO date - results after this date
  until?: string; // ISO date - results before this date
  sortBy?: 'timestamp' | 'score' | 'issues'; // Sort field
  sortOrder?: 'asc' | 'desc'; // Sort direction
}
```

**Response:**

```typescript
interface ResultsResponse {
  success: boolean;
  data: {
    results: AccessibilityResult[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
    filters: {
      appliedFilters: Partial<ResultsQuery>;
      availableFilters: {
        urls: string[];
        standards: string[];
        runners: string[];
      };
    };
  };
  meta: {
    timestamp: string;
    processingTime: number; // milliseconds
  };
}
```

**Example Request:**

```bash
GET /api/accessibility/results?page=1&limit=10&passed=false&sortBy=timestamp&sortOrder=desc
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "uuid-123",
        "url": "http://localhost:3000/CRUDkit/themes",
        "label": "Theme Switcher",
        "timestamp": "2025-09-14T10:30:00Z",
        "standard": "WCAG2AA",
        "runner": "pa11y",
        "passed": false,
        "score": 85,
        "issues": [
          /* AccessibilityIssue[] */
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3,
      "hasNext": true,
      "hasPrev": false
    }
  },
  "meta": {
    "timestamp": "2025-09-14T10:35:00Z",
    "processingTime": 45
  }
}
```

**Error Response:**

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}
```

#### GET /api/accessibility/results/:id

Retrieves a specific accessibility test result by ID.

**Path Parameters:**

- `id` (string): Unique result identifier

**Response:**

```typescript
interface SingleResultResponse {
  success: boolean;
  data: {
    result: AccessibilityResult;
    relatedResults?: AccessibilityResult[]; // Other tests for same URL
  };
  meta: {
    timestamp: string;
  };
}
```

### 2. Dashboard API

#### GET /api/accessibility/dashboard

Retrieves dashboard summary data and metrics.

**Query Parameters:**

```typescript
interface DashboardQuery {
  period?: 'day' | 'week' | 'month' | 'quarter'; // Time period (default: week)
  includeComponents?: boolean; // Include component-level data (default: false)
}
```

**Response:**

```typescript
interface DashboardResponse {
  success: boolean;
  data: {
    overview: {
      totalPages: number;
      pagesCompliant: number;
      compliancePercentage: number;
      totalIssues: number;
      criticalIssues: number;
      warningIssues: number;
      noticeIssues: number;
      averageScore: number;
      trendDirection: 'improving' | 'declining' | 'stable';
    };
    pageScores: {
      url: string;
      label: string;
      score: number;
      grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
      issues: {
        error: number;
        warning: number;
        notice: number;
      };
      lastTested: string;
      trend: 'up' | 'down' | 'same';
    }[];
    trendData: {
      date: string;
      overallScore: number;
      totalIssues: number;
      criticalIssues: number;
      pagesCompliant: number;
    }[];
    complianceStatus: {
      level: 'WCAG2A' | 'WCAG2AA' | 'WCAG2AAA' | 'non_compliant';
      achieved: boolean;
      requiredScore: number;
      currentScore: number;
      blockingIssues: number;
      progressPercentage: number;
    };
    lastUpdated: string;
  };
  meta: {
    timestamp: string;
    cacheAge: number; // seconds
  };
}
```

### 3. Issues API

#### GET /api/accessibility/issues

Retrieves accessibility issues with advanced filtering.

**Query Parameters:**

```typescript
interface IssuesQuery {
  page?: number;
  limit?: number;
  severity?: 'error' | 'warning' | 'notice';
  status?: IssueStatus;
  url?: string; // Filter by page URL
  ruleCode?: string; // Filter by specific rule
  wcagLevel?: 'A' | 'AA' | 'AAA';
  impact?: 'minor' | 'moderate' | 'serious' | 'critical';
  since?: string; // ISO date
  groupBy?: 'rule' | 'page' | 'severity'; // Group results
  includeIgnored?: boolean; // Include ignored issues (default: false)
}
```

**Response:**

```typescript
interface IssuesResponse {
  success: boolean;
  data: {
    issues: (AccessibilityIssue & {
      occurrences?: number; // If grouped
      affectedPages?: string[]; // If grouped
    })[];
    summary: {
      totalIssues: number;
      byType: {
        error: number;
        warning: number;
        notice: number;
      };
      byImpact: {
        critical: number;
        serious: number;
        moderate: number;
        minor: number;
      };
      topRules: {
        code: string;
        count: number;
        severity: string;
      }[];
    };
    filters: {
      availableRules: string[];
      affectedPages: string[];
      dateRange: {
        earliest: string;
        latest: string;
      };
    };
  };
}
```

### 4. Configuration APIs

#### GET /api/accessibility/config

Retrieves current accessibility testing configuration.

**Response:**

```typescript
interface ConfigResponse {
  success: boolean;
  data: {
    testConfig: {
      standard: string;
      runners: string[];
      timeout: number;
      viewport: { width: number; height: number };
      ignoreRules: string[];
    };
    ignoreRules: IgnoreRule[];
    customRules: CustomRule[];
    environment: {
      nodeVersion: string;
      platform: string;
      buildId?: string;
    };
  };
  meta: {
    configVersion: string;
    lastModified: string;
  };
}
```

#### POST /api/accessibility/ignore

Creates or updates ignore rules for accessibility issues.

**Request Body:**

```typescript
interface IgnoreRuleRequest {
  ruleCode: string;
  scope: 'global' | 'page' | 'component';
  target?: string; // Required if scope is not global
  selector?: string; // Optional CSS selector for precision
  reason: string;
  category: IgnoreCategory;
  expiresAt?: string; // Optional expiration date
}
```

**Response:**

```typescript
interface IgnoreRuleResponse {
  success: boolean;
  data: {
    rule: IgnoreRule;
    affectedIssues: number; // How many existing issues this will ignore
  };
  meta: {
    timestamp: string;
  };
}
```

#### DELETE /api/accessibility/ignore/:ruleId

Removes an ignore rule.

**Path Parameters:**

- `ruleId` (string): Ignore rule identifier

**Response:**

```typescript
interface DeleteIgnoreResponse {
  success: boolean;
  data: {
    deletedRule: IgnoreRule;
    reactivatedIssues: number; // Issues that will now be active
  };
}
```

### 5. Testing APIs

#### POST /api/accessibility/test

Triggers an on-demand accessibility test.

**Request Body:**

```typescript
interface TestRequest {
  urls?: string[]; // Specific URLs to test (default: all configured)
  runners?: ('pa11y' | 'axe' | 'htmlcs')[]; // Testing tools to use
  standard?: 'WCAG2AA' | 'WCAG2AAA'; // Standard to test against
  priority?: 'low' | 'normal' | 'high'; // Test priority
  webhook?: string; // Optional webhook for completion notification
}
```

**Response:**

```typescript
interface TestResponse {
  success: boolean;
  data: {
    testRunId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    estimatedDuration: number; // seconds
    testConfiguration: TestConfig;
    urls: string[];
  };
  meta: {
    timestamp: string;
  };
}
```

#### GET /api/accessibility/test/:runId

Gets the status of a test run.

**Response:**

```typescript
interface TestStatusResponse {
  success: boolean;
  data: {
    testRunId: string;
    status: 'queued' | 'running' | 'completed' | 'failed';
    progress: {
      completed: number;
      total: number;
      percentage: number;
      currentUrl?: string;
    };
    results?: AccessibilityResult[]; // Available when completed
    error?: string; // If failed
    startedAt: string;
    completedAt?: string;
    duration?: number; // seconds
  };
}
```

### 6. Reports API

#### GET /api/accessibility/reports

Lists available accessibility reports.

**Response:**

```typescript
interface ReportsListResponse {
  success: boolean;
  data: {
    reports: {
      id: string;
      name: string;
      type: 'summary' | 'detailed' | 'compliance';
      format: 'html' | 'json' | 'pdf';
      createdAt: string;
      url: string;
      size: number; // bytes
    }[];
  };
}
```

#### GET /api/accessibility/reports/:reportId

Downloads a specific report.

**Path Parameters:**

- `reportId` (string): Report identifier

**Response:**

- Content-Type varies based on report format
- Binary data for PDF reports
- JSON for structured reports
- HTML for web reports

#### POST /api/accessibility/reports/generate

Generates a new accessibility report.

**Request Body:**

```typescript
interface ReportRequest {
  type: 'summary' | 'detailed' | 'compliance';
  format: 'html' | 'json' | 'pdf';
  period?: {
    start: string; // ISO date
    end: string; // ISO date
  };
  includePages?: string[]; // Specific pages to include
  includeResolved?: boolean; // Include resolved issues
}
```

**Response:**

```typescript
interface GenerateReportResponse {
  success: boolean;
  data: {
    reportId: string;
    status: 'generating' | 'completed' | 'failed';
    url?: string; // Available when completed
    estimatedTime: number; // seconds
  };
}
```

## Error Handling

### Standard Error Codes

| Code                  | Description                              | HTTP Status |
| --------------------- | ---------------------------------------- | ----------- |
| `INVALID_PARAMETERS`  | Invalid query parameters or request body | 400         |
| `RESOURCE_NOT_FOUND`  | Requested resource doesn't exist         | 404         |
| `RATE_LIMIT_EXCEEDED` | Too many requests                        | 429         |
| `INTERNAL_ERROR`      | Server error                             | 500         |
| `SERVICE_UNAVAILABLE` | Testing service unavailable              | 503         |
| `VALIDATION_ERROR`    | Data validation failed                   | 422         |

### Error Response Format

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: {
      field?: string;
      value?: any;
      constraint?: string;
    };
    suggestions?: string[];
  };
  meta: {
    timestamp: string;
    requestId: string;
    path: string;
    method: string;
  };
}
```

## Response Caching

### Cache Headers

```http
Cache-Control: public, max-age=300, stale-while-revalidate=60
ETag: "accessibility-data-hash"
Last-Modified: Thu, 14 Sep 2025 10:30:00 GMT
```

### Cache Strategy

| Endpoint     | Cache Duration | Strategy      |
| ------------ | -------------- | ------------- |
| `/results`   | 5 minutes      | Browser + CDN |
| `/dashboard` | 2 minutes      | Browser only  |
| `/issues`    | 5 minutes      | Browser + CDN |
| `/config`    | 1 hour         | Browser + CDN |
| `/reports`   | 24 hours       | CDN only      |

## WebSocket API (Optional Future Enhancement)

### Connection

```typescript
// Connection to real-time accessibility updates
const socket = new WebSocket('/api/accessibility/ws');

// Subscribe to test run updates
socket.send(
  JSON.stringify({
    action: 'subscribe',
    channel: 'test-runs',
    testRunId: 'uuid-123',
  })
);

// Real-time issue updates
socket.send(
  JSON.stringify({
    action: 'subscribe',
    channel: 'issues',
    filters: { severity: 'error' },
  })
);
```

### Event Types

```typescript
interface WebSocketMessage {
  type: 'test-progress' | 'test-complete' | 'issue-detected' | 'issue-resolved';
  data: any;
  timestamp: string;
}
```

## Rate Limiting

### Development Environment

- **No limits** for local development
- **Warnings** for excessive requests

### CI/CD Environment

- **100 requests/minute** per workflow
- **Burst allowance** of 200 requests

### Production Environment

- **500 requests/minute** per client
- **Sliding window** rate limiting

## Authentication (Future Enhancement)

### API Key Authentication

```http
Authorization: Bearer your-api-key-here
X-API-Version: v1
```

### Scoped Permissions

```typescript
interface ApiKeyPermissions {
  read: boolean; // Read test results and dashboard
  write: boolean; // Create ignore rules, trigger tests
  admin: boolean; // Modify configuration, delete data
  reports: boolean; // Generate and access reports
}
```

## OpenAPI Specification

A complete OpenAPI 3.0 specification is available at `/api/accessibility/openapi.json` for automated client generation and API documentation.

This API specification provides comprehensive access to all accessibility testing data and functionality while maintaining consistency with the existing Next.js API route patterns.
