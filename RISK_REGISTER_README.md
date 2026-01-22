# Risk Register Module

This module implements a production-ready Risk Register for QMS (Quality Management System) web applications using Google Sheets as the backend database.

## Overview

The Risk Register module provides functionality to manage risks in accordance with ISO 9001 standards. It uses Google Sheets as the single source of truth, with each QMS module represented as a separate sheet tab.

## Architecture

- **Server-side only**: No OAuth logic in the frontend
- **Google Sheets Integration**: Uses Google APIs with refresh token authentication
- **TypeScript**: Strict typing throughout
- **Clean Architecture**: One service per module with clear separation of concerns

## Files

- `src/lib/googleAuth.ts` - Google OAuth 2.0 authentication service
- `src/lib/googleSheetsService.ts` - Google Sheets API service
- `src/lib/riskRegisterService.ts` - Risk Register business logic
- `src/server/risks.ts` - Express API routes (optional)
- `src/server/index.ts` - Express server setup (optional)

## Google Sheets Structure

The "Risk Register" tab contains the following columns:

| Column | Description |
|--------|-------------|
| Risk ID | Unique identifier (auto-generated as R001, R002, etc.) |
| Process / Department | Process or department affected |
| Risk Description | Description of the risk |
| Cause | Root cause of the risk |
| Likelihood | Rating 1-5 |
| Impact | Rating 1-5 |
| Risk Score | Auto-calculated (Likelihood × Impact) |
| Action / Control | Mitigation actions |
| Owner | Person responsible |
| Status | Open, Under Review, Controlled, Closed |
| Review Date | Next review date |
| Linked CAPA | Optional link to Corrective Action |

## Environment Variables

Set the following environment variables:

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri
GOOGLE_REFRESH_TOKEN=your_refresh_token
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id
```

## API Endpoints (Optional)

If using the Express server:

- `GET /api/risks` - Fetch all risks
- `POST /api/risks` - Add new risk
- `PUT /api/risks/:id` - Update existing risk

## Usage

```typescript
import { RiskRegisterService } from './lib/riskRegisterService';

const riskService = RiskRegisterService.getInstance();

// Get all risks
const risks = await riskService.getAllRisks();

// Add new risk
const newRisk = await riskService.addRisk({
  processDepartment: 'IT Department',
  riskDescription: 'Server downtime',
  cause: 'Hardware failure',
  likelihood: 3,
  impact: 4,
  actionControl: 'Implement redundancy',
  owner: 'John Doe',
  status: 'Open',
  reviewDate: '2024-12-31'
});

// Update risk
const updatedRisk = await riskService.updateRisk('R001', {
  status: 'Under Review'
});
```

## Validation Rules

- **Likelihood & Impact**: Must be integers 1-5
- **Status**: Must be one of: Open, Under Review, Controlled, Closed
- **Review Date**: Must be current date or future
- **Risk ID**: Auto-generated, unique
- **Risk Score**: Auto-calculated, not user-editable

## ISO 9001 Compliance

- Risks are not treated as non-conformities
- Supports periodic review and traceability
- Optional linking to CAPA when risks materialize
- Maintains audit trail through Google Sheets history

## Error Handling

All methods throw descriptive errors for:
- Authentication failures
- Invalid input data
- Sheet access issues
- Risk not found scenarios

## Security

- Refresh tokens stored securely in environment variables
- Server-side authentication only
- No sensitive data exposed to frontend