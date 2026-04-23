# SafeHer: Technical Architecture & Database Design

## Overview

SafeHer is an anonymous incident reporting and safety mapping platform that enables community members to report unsafe situations without authentication while providing administrators with real-time insights through data visualization and analytics.

## Database Schema

### Core Tables

#### `incidents` Table
Stores all reported incidents with anonymized data and classification information.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Unique incident identifier |
| `latitude` | DECIMAL(10, 8) | NOT NULL | Incident location latitude |
| `longitude` | DECIMAL(11, 8) | NOT NULL | Incident location longitude |
| `incidentType` | ENUM | NOT NULL | Category: harassment, assault, stalking, theft, unsafe_area, other |
| `severity` | ENUM | NOT NULL | Level: low, medium, high, critical |
| `description` | TEXT | NOT NULL | Free-text incident description (anonymized) |
| `mediaUrls` | JSON | NULLABLE | Array of S3 URLs for uploaded media |
| `reportedAt` | TIMESTAMP | NOT NULL | When incident occurred (user-provided) |
| `submittedAt` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | When report was submitted |
| `ipHash` | VARCHAR(64) | NOT NULL | Hashed IP for rate limiting (no PII) |
| `status` | ENUM | DEFAULT 'pending' | pending, verified, resolved, dismissed |
| `adminNotes` | TEXT | NULLABLE | Internal notes from admin review |
| `llmClassification` | JSON | NULLABLE | LLM-generated type/severity suggestions |

#### `users` Table (Existing)
Stores admin users for dashboard access.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | User identifier |
| `openId` | VARCHAR(64) | UNIQUE, NOT NULL | Manus OAuth identifier |
| `name` | TEXT | NULLABLE | User display name |
| `email` | VARCHAR(320) | NULLABLE | User email |
| `role` | ENUM | DEFAULT 'user' | user or admin |
| `createdAt` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Account creation time |
| `updatedAt` | TIMESTAMP | ON UPDATE CURRENT_TIMESTAMP | Last update time |
| `lastSignedIn` | TIMESTAMP | NOT NULL | Last login time |

#### `media_attachments` Table
Tracks uploaded media files for incidents.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Attachment identifier |
| `incidentId` | INT | FOREIGN KEY | Reference to incident |
| `s3Key` | VARCHAR(255) | NOT NULL | S3 object key for retrieval |
| `s3Url` | VARCHAR(512) | NOT NULL | Public S3 URL |
| `mimeType` | VARCHAR(50) | NOT NULL | File MIME type |
| `fileSize` | INT | NOT NULL | File size in bytes |
| `uploadedAt` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Upload timestamp |

#### `rate_limit_log` Table
Tracks submission attempts for rate limiting enforcement.

| Column | Type | Constraints | Purpose |
|--------|------|-----------|---------|
| `id` | INT | PRIMARY KEY, AUTO_INCREMENT | Log entry identifier |
| `ipHash` | VARCHAR(64) | NOT NULL | Hashed IP address |
| `attemptedAt` | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | Attempt timestamp |
| `endpoint` | VARCHAR(100) | NOT NULL | API endpoint attempted |

## API Architecture (tRPC Procedures)

### Public Procedures (No Authentication)

#### `incidents.submit`
Submit a new anonymous incident report.

**Input:**
```typescript
{
  latitude: number;
  longitude: number;
  description: string;
  incidentType?: string; // User-selected or from LLM suggestion
  severity?: string; // User-selected or from LLM suggestion
  reportedAt: Date;
  mediaUrls?: string[]; // S3 URLs after upload
}
```

**Process:**
1. Validate input and rate limit by IP hash
2. Call LLM to auto-classify description (if not provided)
3. Store incident with anonymized data
4. If severity is high/critical, trigger admin notification
5. Return incident ID for confirmation

**Output:**
```typescript
{
  success: boolean;
  incidentId: string;
  message: string;
}
```

#### `incidents.list`
Retrieve incidents for map visualization (public, anonymized data only).

**Input:**
```typescript
{
  bounds?: { north: number; south: number; east: number; west: number };
  types?: string[];
  dateRange?: { start: Date; end: Date };
  limit?: number;
}
```

**Output:**
```typescript
{
  incidents: Array<{
    id: string;
    latitude: number;
    longitude: number;
    incidentType: string;
    severity: string;
    reportedAt: Date;
  }>;
}
```

#### `incidents.heatmapData`
Retrieve aggregated heatmap data for density visualization.

**Input:**
```typescript
{
  bounds?: { north: number; south: number; east: number; west: number };
  granularity?: 'day' | 'week' | 'month'; // Time aggregation
}
```

**Output:**
```typescript
{
  heatmapPoints: Array<{
    latitude: number;
    longitude: number;
    weight: number; // Incident count or severity weight
  }>;
}
```

#### `media.uploadUrl`
Generate presigned S3 URL for direct client upload.

**Input:**
```typescript
{
  fileName: string;
  mimeType: string;
  fileSize: number;
}
```

**Output:**
```typescript
{
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}
```

### Protected Procedures (Admin Only)

#### `admin.incidents.list`
Retrieve all incidents with full details for admin dashboard.

**Input:**
```typescript
{
  page?: number;
  limit?: number;
  filters?: {
    types?: string[];
    severity?: string[];
    status?: string[];
    dateRange?: { start: Date; end: Date };
  };
  search?: string;
  sortBy?: 'submitted' | 'severity' | 'type';
}
```

**Output:**
```typescript
{
  incidents: Array<IncidentDetail>;
  total: number;
  page: number;
}
```

#### `admin.incidents.statistics`
Retrieve aggregated statistics for dashboard cards and charts.

**Output:**
```typescript
{
  totalIncidents: number;
  incidentsByType: Record<string, number>;
  incidentsBySeverity: Record<string, number>;
  incidentsByDate: Array<{ date: string; count: number }>;
  highSeverityCount: number;
  pendingCount: number;
}
```

#### `admin.incidents.updateStatus`
Update incident status and add admin notes.

**Input:**
```typescript
{
  incidentId: string;
  status: 'verified' | 'resolved' | 'dismissed';
  notes?: string;
}
```

**Output:**
```typescript
{
  success: boolean;
}
```

## LLM Classification Pipeline

The system uses Claude to automatically classify incident descriptions into predefined categories and severity levels.

**Prompt Template:**
```
Analyze the following incident report and classify it:

Description: {description}

Classify into ONE of these types:
- harassment: Unwanted verbal or physical conduct
- assault: Physical attack or violence
- stalking: Persistent unwanted contact or surveillance
- theft: Theft or robbery
- unsafe_area: General safety concern about location
- other: Doesn't fit above categories

Classify severity as ONE of:
- low: Minor concern, no immediate danger
- medium: Moderate concern, potential risk
- high: Serious concern, significant risk
- critical: Immediate danger, urgent response needed

Respond with JSON: {"type": "...", "severity": "...", "confidence": 0-1}
```

**Process:**
1. User submits description
2. LLM analyzes and returns suggested classification
3. UI pre-fills form fields with suggestions
4. User can override before submission
5. Final classification stored with incident

## Rate Limiting & Spam Protection

**Strategy:** IP-based rate limiting with exponential backoff

**Rules:**
- Maximum 5 submissions per IP per hour
- Maximum 20 submissions per IP per day
- Temporary ban after 10 failed attempts in 1 hour
- Hash IP addresses to prevent PII storage

**Implementation:**
- Check `rate_limit_log` before accepting submission
- Log attempt regardless of success/failure
- Return 429 Too Many Requests when limit exceeded

## Admin Notifications

**Trigger:** When incident severity is "high" or "critical"

**Delivery:**
- Use `notifyOwner()` helper from `server/_core/notification.ts`
- Include: incident type, severity, location (general area), timestamp
- No PII included in notification

**Format:**
```
Title: 🚨 High-Severity Incident Reported
Content: 
- Type: [Assault]
- Severity: [Critical]
- Location: [City/Area]
- Time: [Timestamp]
- Dashboard: [Link to admin dashboard]
```

## File Storage Strategy

**S3 Integration:**
- Use `storagePut()` from `server/storage.ts` for uploads
- Store with non-enumerable keys: `incidents/{incidentId}/{timestamp}-{randomSuffix}.{ext}`
- Media URLs stored in `media_attachments` table
- Presigned URLs generated for direct client uploads

**Security:**
- Validate file types (images/videos only)
- Enforce file size limits (10MB per file, 50MB total per incident)
- Scan for malware/NSFW content (optional, via external service)

## Frontend Architecture

### Public Pages
- **Landing Page:** Mission statement, how-it-works, CTA to report
- **Report Page:** Anonymous form with map geo-tagging, media upload, LLM suggestions
- **Map Viewer:** Interactive map with incident markers, heatmap layer, incident feed

### Admin Pages
- **Dashboard:** Statistics cards, charts, recent incidents
- **Incident List:** Full incident table with filtering, search, sorting
- **Incident Detail:** Full incident information with admin actions

## Security & Privacy Considerations

1. **Anonymity:** No user accounts required; IP addresses hashed; no PII stored
2. **Rate Limiting:** Prevent spam and abuse
3. **Data Validation:** Strict input validation on all endpoints
4. **CORS:** Restrict API access to same origin
5. **Admin Access:** Protected by Manus OAuth
6. **Media Storage:** Secure S3 bucket with presigned URLs

## Performance Optimizations

1. **Heatmap Data:** Pre-aggregate at database level
2. **Pagination:** Implement for incident lists
3. **Caching:** Cache statistics and heatmap data (5-minute TTL)
4. **Indexes:** Add indexes on latitude/longitude, incidentType, severity, submittedAt
5. **Lazy Loading:** Load incident details on demand
