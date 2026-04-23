# SafeHer: Anonymous Incident Reporting & Safety Mapping System - TODO

## Database & Backend Infrastructure
- [x] Design and implement database schema (incidents, users for admin, media attachments)
- [x] Create tRPC procedures for anonymous incident submission
- [x] Implement LLM-powered auto-classification for incident type and severity
- [x] Set up rate limiting and spam protection on reporting endpoint
- [x] Implement S3 file storage integration for media uploads
- [x] Create admin notification system for high-severity incidents
- [x] Write vitest tests for backend procedures and LLM classification

## Public-Facing UI
- [x] Design and build landing page with mission statement and CTA
- [x] Create anonymous incident reporting form with validation
- [x] Integrate Google Maps for geo-tagging incident locations
- [x] Build incident marker visualization on map with popups
- [x] Implement heatmap layer showing unsafe zone density
- [x] Create real-time incident feed panel alongside map
- [x] Build safety legend and map controls (toggle heatmap, filter by type/date)
- [x] Add media upload UI with S3 integration
- [x] Implement responsive design for mobile and desktop

## Admin Dashboard
- [x] Create login-protected admin dashboard layout
- [x] Build incident statistics and overview cards
- [x] Implement charts for incidents by type, date, and area
- [x] Create full incident list with filtering and search
- [x] Add incident detail view with full information
- [x] Implement admin controls for incident management

## Styling & Design
- [x] Define color palette and typography (trustworthy, accessible, community-focused)
- [x] Create consistent component library with Tailwind CSS
- [x] Ensure accessibility standards (WCAG 2.1 AA)
- [x] Implement responsive design across all pages

## Testing & Optimization
- [x] Write vitest tests for all tRPC procedures
- [x] Test anonymous reporting flow end-to-end
- [x] Test LLM classification accuracy
- [x] Test rate limiting and spam protection
- [x] Test media upload and S3 storage
- [x] Test admin dashboard with sample data
- [x] Performance optimization and load testing
- [x] Cross-browser and mobile testing

## Deployment & Final Delivery
- [x] Create checkpoint before final delivery
- [x] Document API endpoints and database schema
- [x] Prepare deployment instructions
