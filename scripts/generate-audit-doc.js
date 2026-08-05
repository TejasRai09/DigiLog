const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  HeadingLevel,
  BorderStyle,
  ShadingType,
  TableOfContents,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} = require('docx');
const fs = require('fs');
const path = require('path');

const BLUE = '1A5276';
const LIGHT_BLUE = 'D6EAF8';
const HEADER_BG = '2C3E50';
const HEADER_TEXT = 'FFFFFF';
const ALT_ROW = 'F8F9FA';
const BORDER_COLOR = 'BDC3C7';

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  left: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
  right: { style: BorderStyle.SINGLE, size: 1, color: BORDER_COLOR },
};

function headerCell(text, widthPct) {
  return new TableCell({
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: true, color: HEADER_TEXT, size: 20, font: 'Calibri' })],
        spacing: { before: 40, after: 40 },
      }),
    ],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.SOLID, color: HEADER_BG },
    borders: thinBorder,
  });
}

function bodyCell(text, widthPct, opts = {}) {
  const runs = [];
  if (opts.bold) {
    runs.push(new TextRun({ text: text || '', bold: true, size: 19, font: 'Calibri' }));
  } else {
    runs.push(new TextRun({ text: text || '', size: 19, font: 'Calibri' }));
  }
  return new TableCell({
    children: [
      new Paragraph({
        children: runs,
        spacing: { before: 30, after: 30 },
      }),
    ],
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: opts.shaded ? { type: ShadingType.SOLID, color: ALT_ROW } : undefined,
    borders: thinBorder,
  });
}

function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    text,
    heading: level,
    spacing: { before: 300, after: 120 },
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, size: 21, font: 'Calibri', ...opts })],
    spacing: { before: 80, after: 80 },
  });
}

function bullet(text) {
  return new Paragraph({
    children: [new TextRun({ text, size: 21, font: 'Calibri' })],
    bullet: { level: 0 },
    spacing: { before: 30, after: 30 },
  });
}

function bulletBold(label, desc) {
  return new Paragraph({
    children: [
      new TextRun({ text: `${label}: `, size: 21, font: 'Calibri', bold: true }),
      new TextRun({ text: desc, size: 21, font: 'Calibri' }),
    ],
    bullet: { level: 0 },
    spacing: { before: 30, after: 30 },
  });
}

const DB_COLUMNS = [
  ['id', 'BIGINT AUTO_INCREMENT PK', 'Unique immutable identifier for every audit entry. Required for pagination, referencing individual entries, and join operations in future analytics.'],
  ['created_at', 'TIMESTAMP DEFAULT NOW()', 'Exact server-side timestamp of the action. Critical for chronological ordering, date-range filtering, and compliance retention policies (ISO 27001 requires timestamped audit trails).'],
  ['user_id', 'INT NULL', 'Foreign-key reference to the users table. Enables joining with employee records, filtering all actions by a specific user, and surviving name/email changes (names can change, IDs do not).'],
  ['user_name', 'VARCHAR(200) NULL', 'Denormalised copy of the user\'s display name at the time of the action. Avoids a JOIN on every audit-log read and preserves the name exactly as it was when the action occurred (employee may be renamed or deleted later).'],
  ['user_email', 'VARCHAR(200) NULL', 'Denormalised copy of the user\'s email at the time of the action. Enables quick human identification in the UI and text search without joining the users table. Also acts as an immutable correlation key across systems.'],
  ['user_role', 'VARCHAR(20) NULL', 'Role of the user (admin, editor, viewer, etc.) at the time of the action. Crucial for security auditing: proves whether the user had the necessary privileges, detects privilege-escalation anomalies, and supports role-based activity reports.'],
  ['user_department', 'VARCHAR(255) NULL', 'Department or team the user belongs to. Helps filter actions by organisational unit (e.g. "show all changes made by the Instrument department"), supports multi-department compliance reviews, and provides context on who owns the data.'],
  ['method', 'VARCHAR(10) NOT NULL', 'Raw HTTP method (POST, PUT, PATCH, DELETE). Retained for technical debugging even though action_type provides the human-readable equivalent. Useful for correlating with web-server access logs and investigating edge cases where the same action_type maps to different methods.'],
  ['path', 'VARCHAR(500) NOT NULL', 'Full API path with query parameters stripped. Serves as the technical fingerprint of the request: identifies the exact endpoint called, enables regex-based filtering, and is essential for debugging API-level issues or replay investigations.'],
  ['status_code', 'INT NULL', 'HTTP response status code (200, 201, 400, 500, etc.). Enables filtering by success/failure, helps identify patterns of errors or unauthorized attempts (401/403), and is required for SLA compliance monitoring.'],
  ['success', 'TINYINT(1) NULL', 'Boolean flag derived from status_code (1 = 2xx, 0 = 4xx/5xx). Provides a simple, index-friendly column for success/failure filtering without evaluating status_code ranges in every query. Dramatically simplifies reporting SQL.'],
  ['action_type', 'VARCHAR(20) NULL', 'Human-readable action label: Create, Update, or Delete. Derived from the HTTP method but stored separately so the UI can filter and display without mapping logic. Non-technical stakeholders understand "Create" immediately; "POST" they do not.'],
  ['action_summary', 'VARCHAR(255) NULL', 'Auto-generated plain-English description of what the user did (e.g. \'Added category "160 tph" under Power Plant\'). This is the single most important column for readability — it converts a raw API call into a sentence that any plant manager can understand. Powers the Description column in the UI.'],
  ['module', 'VARCHAR(100) NULL', 'Human-readable module name (Power Plant Equipment, Sugar House Equipment, Admin Config, etc.). Enables module-level activity dashboards and access-control audits (e.g. "who touched Sugar House data this month?").'],
  ['module_key', 'VARCHAR(64) NULL', 'Short machine-readable module identifier (power-new, sugar-new, admin, forms). Used for programmatic filtering, API queries, and dashboard aggregations without parsing the display path.'],
  ['resource_type', 'VARCHAR(64) NULL', 'Category of the affected resource (equipment, hierarchy_node, specs, schedule, history, user, form, etc.). Enables resource-level analytics — e.g. "how many spec updates happened this season?" — and supports future resource-specific audit pages.'],
  ['resource_id', 'VARCHAR(64) NULL', 'Primary key of the affected resource (equipment ID, node ID, user ID, form key, etc.). Enables filtering all audit entries for a single entity, building per-resource change timelines, and linking back to the actual record in the database.'],
  ['resource_name', 'VARCHAR(255) NULL', 'Human-readable name of the affected resource at the time of the action (equipment name, employee name, form name). Stored denormalised because the resource may be renamed or deleted later; this column preserves the exact context of what was changed.'],
  ['display_path', 'VARCHAR(500) NULL', 'Breadcrumb-style navigation path mirroring the frontend UI (e.g. "Power Plant Equipment > 160 tph > subcategory 1 > equipment 1 > Specs"). Lets administrators instantly understand where in the application hierarchy the change occurred without decoding raw API paths.'],
  ['screen', 'VARCHAR(100) NULL', 'The UI screen or section where the action logically belongs (Specs, OEM Schedule, Life History, Hierarchy, Employees, etc.). Supports screen-level activity reports and helps developers trace UI actions to backend calls.'],
  ['duration_ms', 'INT NULL', 'Server-side processing time of the request in milliseconds. Useful for performance monitoring, identifying slow operations, and investigating timeout-related failures.'],
  ['request_body', 'MEDIUMTEXT NULL', 'Sanitised, human-readable JSON representation of the full request payload. Sensitive fields (passwords, tokens, images) are redacted or omitted. Stored so that administrators can expand any audit entry and see every single input field — grouped by section — exactly as it was submitted. Essential for debugging and dispute resolution.'],
  ['ip', 'VARCHAR(64) NULL', 'IP address of the client that made the request. Required for security investigations (detecting unauthorized access from unusual locations), geo-based compliance, and correlating actions across multiple user accounts from the same terminal.'],
  ['user_agent', 'VARCHAR(500) NULL', 'Browser / client user-agent string. Helps identify the client application (Chrome, mobile app, API script) and its version. Useful for debugging client-specific issues and detecting automated/scripted access to the system.'],
];

// ── User Activity Tracking (proposed) ────────────────────
const ACTIVITY_LOG_COLUMNS = [
  ['id', 'BIGINT AUTO_INCREMENT PK', 'Unique identifier for every activity event. Required for ordering and pagination.'],
  ['session_id', 'VARCHAR(64) NOT NULL', 'Links every activity event to a login session. Enables grouping all actions within one login window, computing per-session dwell times, and detecting unusual multi-session patterns.'],
  ['user_id', 'INT NOT NULL', 'Foreign key to the users table. Enables per-user analytics: which sections a specific employee visits most, how long they spend on each form, and their overall engagement pattern.'],
  ['user_name', 'VARCHAR(200) NULL', 'Denormalised name at the time of the event. Enables direct querying without a join and preserves the identity even if the user is later renamed or deactivated.'],
  ['user_email', 'VARCHAR(200) NULL', 'Denormalised email for quick identification and text search in the UI.'],
  ['user_role', 'VARCHAR(20) NULL', 'Role at the time of the event. Useful for answering questions like "how often do editors use the BI dashboards vs. admins?"'],
  ['user_department', 'VARCHAR(255) NULL', 'Department at the time of the event. Enables department-level usage reports (e.g. "Instrument team spends 70% of their time on Power Plant Equipment").'],
  ['event_type', 'VARCHAR(30) NOT NULL', 'Type of activity: page_view, click, section_open, form_open, dashboard_open, form_submit, logout. Enables filtering by interaction type and computing type-specific metrics.'],
  ['section', 'VARCHAR(100) NULL', 'Top-level section the user is in (Forms Hub, BI Control Tower, Power Plant Equipment, Sugar House Equipment, Admin Config, Data Upload, Dashboard). Enables section-level usage heatmaps and the first level of cascading filters.'],
  ['card', 'VARCHAR(200) NULL', 'The card/app within a section (e.g. "Mill Logbook", "Lab Logbook", "Power Logbook", "Distillery Operations", "Milling Division Cockpit"). Enables the second level of cascading filters.'],
  ['form_or_dashboard', 'VARCHAR(200) NULL', 'The specific form or dashboard name (e.g. "Equipment Temperature", "Shredder and OTG", "Brix Sampling Analytics"). Enables the third level of cascading filters and per-form usage analytics.'],
  ['page_path', 'VARCHAR(500) NULL', 'The frontend route/URL the user navigated to (e.g. /forms/mill_logbook1, /bi/milling-operations, /power-plant-equipment-new/42/instrument). Full path for developer-level analysis.'],
  ['display_path', 'VARCHAR(500) NULL', 'Human-readable breadcrumb path (e.g. "Dashboard > Forms Hub > Mill Logbook > Equipment Temperature"). Mirrors the frontend breadcrumb for easy readability.'],
  ['element_id', 'VARCHAR(200) NULL', 'For click events: the DOM element ID or data-track attribute that was clicked (e.g. "save-specs-btn", "add-equipment-btn"). Enables button-level click analytics.'],
  ['element_label', 'VARCHAR(200) NULL', 'For click events: the visible text label of the clicked element (e.g. "Save", "Add Equipment", "Export PDF"). Human-readable alternative to element_id.'],
  ['metadata', 'TEXT NULL', 'JSON blob for additional context (e.g. equipment ID being viewed, form_key, dashboard tab name, filter values applied). Keeps the schema flexible for future tracking needs.'],
  ['entered_at', 'TIMESTAMP NOT NULL DEFAULT NOW()', 'Timestamp when the user entered this page/section. Combined with exited_at, computes dwell time.'],
  ['exited_at', 'TIMESTAMP NULL', 'Timestamp when the user left this page/section (updated via a beacon/heartbeat). NULL while the user is still on the page.'],
  ['dwell_seconds', 'INT NULL', 'Computed seconds spent on this page/section (exited_at - entered_at). Pre-computed for fast aggregation queries — avoids TIMESTAMPDIFF in every report SQL.'],
  ['ip', 'VARCHAR(64) NULL', 'Client IP for security correlation and geo-analysis.'],
  ['user_agent', 'VARCHAR(500) NULL', 'Browser/client info for device-type analytics (desktop vs. mobile usage patterns).'],
];

const SESSION_LOG_COLUMNS = [
  ['id', 'BIGINT AUTO_INCREMENT PK', 'Unique session identifier.'],
  ['session_id', 'VARCHAR(64) NOT NULL UNIQUE', 'Application-level session token (UUID generated at login). Links all activity events and audit logs within one session.'],
  ['user_id', 'INT NOT NULL', 'Foreign key to the users table. Enables per-user session history.'],
  ['user_name', 'VARCHAR(200) NULL', 'Denormalised name at login time. Preserves the identity even if the user is renamed later.'],
  ['user_email', 'VARCHAR(200) NULL', 'Denormalised email at login time.'],
  ['user_role', 'VARCHAR(20) NULL', 'Role at login time. Detects if a user\'s role changed between sessions.'],
  ['user_department', 'VARCHAR(255) NULL', 'Department at login time.'],
  ['login_at', 'TIMESTAMP NOT NULL DEFAULT NOW()', 'Exact timestamp when the user logged in. Enables login frequency reports and peak-hour analysis.'],
  ['logout_at', 'TIMESTAMP NULL', 'Timestamp when the session ended (explicit logout or timeout). NULL while the session is active.'],
  ['duration_minutes', 'INT NULL', 'Total session duration in minutes (logout_at - login_at). Pre-computed for fast "average session length" and "total hours logged in this month" reports.'],
  ['is_active', 'TINYINT(1) DEFAULT 1', 'Whether the session is currently active. Enables a "who is online right now?" live dashboard.'],
  ['last_heartbeat', 'TIMESTAMP NULL', 'Last time the frontend sent a keep-alive ping. Used to detect stale sessions (user closed browser without logging out) and auto-set logout_at.'],
  ['ip', 'VARCHAR(64) NULL', 'Login IP address. Detects logins from new/unusual locations.'],
  ['user_agent', 'VARCHAR(500) NULL', 'Login device/browser. Identifies device types and detects automated access.'],
  ['pages_visited', 'INT DEFAULT 0', 'Counter of distinct pages visited during this session. Quick engagement metric without querying activity_logs.'],
  ['actions_performed', 'INT DEFAULT 0', 'Counter of data-modifying actions (from audit_logs) during this session. Quick productivity metric.'],
];

const CASCADE_FILTER_LEVELS = [
  ['Level 1: Section', 'section', 'Forms Hub, BI Control Tower, Power Plant Equipment, Sugar House Equipment, Mill House Equipment, Admin Config, Data Upload, Dashboard', 'Top-level application module. All other filters are reset when this changes.'],
  ['Level 2: Card / App', 'card', 'Mill Logbook, Lab Logbook, Power Logbook, Distillery Operations, EHS, Production, Brix Sampling, Milling Division Cockpit, Distillery Analytics, etc.', 'The app or card within the selected section. Only shows cards that belong to the selected section. For Power Plant / Sugar House, this level shows the top-level hierarchy categories.'],
  ['Level 3: Form / Dashboard / Equipment', 'form_or_dashboard', 'Equipment Temperature, Shredder and OTG, Lube Pressure, Mill Stoppages, Brix Sampling Analytics, Cane Performance Dashboard, etc.', 'The specific form, dashboard, or equipment within the selected card. Only populated after Level 2 is selected. For equipment hubs, this shows individual equipment names.'],
];

const FORMS_HUB_TREE = [
  ['Mill Logbook', 'Equipment Temperature, Shredder and OTG, Lube Pressure and Roller Temp, Mill Stoppages'],
  ['Lab Logbook', 'DS Logbook, RS Logbook, Operations Logbook, Special Analysis Logbook, Syrup Logbook, Stoppage Logbook'],
  ['Power Logbook', 'Power Details, Steam Details, Stoppage Details'],
  ['Distillery Operations', 'Distillery Operations Form'],
  ['EHS (Environment Health & Safety)', 'Accident Report, Water Dashboard (GWA / ETP / CPU), Daily Safety Toolbox Talk'],
  ['Production', 'Shift Chemist Job Log Book, A-Centrifugal Machine Stoppage, Pan Log Book, Decanter Log Book, Clarification Log Book'],
  ['Brix Sampling Forms', 'GSMA Yard Brix Sampling, GSMA Field Brix Sampling'],
  ['Mill House Equipment History', '(Opens equipment list directly — individual equipment entries)'],
  ['Power Plant Equipment History', '(Opens hierarchy — Category > Subcategory > Equipment)'],
  ['Sugar House Equipment History', '(Opens hierarchy — Section > Location > Main Equipment > Sub Equipment)'],
];

const BI_DASHBOARDS = [
  ['Distillery Operations — Analytics', 'bi_distillery_operations'],
  ['Milling Division Cockpit', 'bi_milling_operations'],
  ['Purchy Analysis', 'bi_purchy_analysis'],
  ['Brix Sampling Analytics', 'bi_brix_sampling'],
  ['Centre Maturity Dashboard', 'bi_centre_maturity'],
  ['Cane Performance Dashboard', 'bi_cane_performance'],
];

const SKIPPED_PATHS = [
  ['GET requests', 'Read-only operations do not modify data and would create excessive noise without adding audit value.'],
  ['GET /admin/audit-logs', 'Reading the audit log itself should not create recursive audit entries.'],
  ['/api/health', 'Health-check endpoint called by load balancers and monitoring tools every few seconds — logging these would flood the table.'],
  ['Hierarchy /link and /sync-name', 'Internal bookkeeping calls that happen automatically when a user saves equipment. The parent hierarchy save is already logged; recording these internal sub-calls would create duplicate, confusing entries.'],
];

const ENRICHMENT_STEPS = [
  ['1. shouldSkipAudit()', 'Checks HTTP method and path against the skip list. If the request is a GET, a health check, or an internal bookkeeping call, auditing is skipped entirely.'],
  ['2. captureSpecsBefore()', 'For equipment specification saves (PUT …/specs), loads the previous __subsections__ JSON from the database before the route handler overwrites it. This enables a before/after diff so the log shows only what was added or removed, not the entire equipment list.'],
  ['3. sanitizeRequestBody()', 'Converts the raw API payload into a structured, human-readable JSON with field/value rows grouped by section (Specifications, OEM Schedule, Maintenance History, etc.). Sensitive data (passwords, tokens, images) is redacted. Output is capped at 100 KB.'],
  ['4. enrichAuditContext()', 'Resolves numeric IDs in the API path to human-readable names by querying the database (hierarchy nodes, equipment records, user records, forms). Builds the breadcrumb display path and extracts module, resource type, and screen metadata.'],
  ['5. buildChangeDescription()', 'Generates the plain-English action_summary sentence. Uses context-aware rules for each resource type: hierarchy operations describe the item kind (category, subcategory, equipment) and parent; specs operations describe which disciplines and equipment were added or removed; maintenance records describe the section and sub-group.'],
  ['6. INSERT into audit_logs', 'All enriched fields are persisted in a single INSERT. The insert happens inside setImmediate() so it never blocks or delays the original API response.'],
];

const FRONTEND_COLUMNS = [
  ['Time', 'Formatted timestamp of the action in DD Mon YYYY HH:MM:SS format.'],
  ['Name', 'Full name of the user who performed the action.'],
  ['Email', 'Email address of the user.'],
  ['Role', 'Role of the user at the time of the action (admin, editor, viewer).'],
  ['Action', 'Colour-coded badge — green for Create, blue for Update, red for Delete.'],
  ['Description', 'Auto-generated plain-English sentence summarising what changed.'],
  ['Location', 'Breadcrumb navigation path showing where in the app the action occurred.'],
  ['API Path', 'Raw API endpoint path (useful for developers and technical debugging).'],
  ['Status', 'HTTP status code with colour coding (green for 2xx, red for 4xx/5xx).'],
  ['Result', 'Simple OK / Fail badge derived from the status code.'],
  ['Expand', 'Toggle button to reveal the full request payload in grouped detail tables.'],
];

const BODY_SECTIONS = [
  ['Changes', 'Shows only what was added or removed (e.g. "Added under Instrument discipline: equipment 3"). Computed by diffing the before and after states of the __subsections__ field.'],
  ['Equipment lists (full input)', 'Complete list of equipment under each discipline as submitted in this save. Provides the full context even when only one item changed.'],
  ['Discipline > Equipment', 'Specification fields for a specific equipment under a discipline (e.g. "Instrument > equipment 3"). Shows every input field (Capacity, Pressure, etc.) with its submitted value.'],
  ['OEM Schedule > Row N', 'Each row of the OEM schedule with all columns (equipment, section, frequency, etc.).'],
  ['Maintenance History', 'All fields from a maintenance record: season, dates, observation, action, cost, provider, equipment mappings, and photo counts.'],
  ['System', 'Internal metadata like sub-group layout — binary content is replaced with "[Updated — binary layout omitted]" for clarity.'],
  ['Details', 'Generic fallback group for any other key/value fields not covered by the above sections (admin settings, form submissions, etc.).'],
];

async function main() {
  const doc = new Document({
    creator: 'DigiLog System',
    title: 'Admin Audit Log — Technical Documentation',
    description: 'Complete documentation of the DigiLog Admin Audit Log feature',
    styles: {
      default: {
        document: {
          run: { size: 22, font: 'Calibri' },
        },
        heading1: {
          run: { size: 32, bold: true, color: BLUE, font: 'Calibri' },
          paragraph: { spacing: { before: 400, after: 160 } },
        },
        heading2: {
          run: { size: 26, bold: true, color: BLUE, font: 'Calibri' },
          paragraph: { spacing: { before: 300, after: 120 } },
        },
        heading3: {
          run: { size: 23, bold: true, color: '2E4053', font: 'Calibri' },
          paragraph: { spacing: { before: 240, after: 100 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: { pageNumbers: { start: 1 } },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'DigiLog — Admin Audit Log Documentation', size: 16, color: '808080', font: 'Calibri', italics: true }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Confidential — ', size: 16, color: '808080', font: 'Calibri' }),
                  new TextRun({ text: 'Page ', size: 16, color: '808080', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '808080', font: 'Calibri' }),
                  new TextRun({ text: ' of ', size: 16, color: '808080', font: 'Calibri' }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 16, color: '808080', font: 'Calibri' }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // ── Title Page ──────────────────────────────────────
          new Paragraph({ spacing: { before: 2400 } }),
          new Paragraph({
            children: [new TextRun({ text: 'Admin Audit Log', size: 56, bold: true, color: BLUE, font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [new TextRun({ text: 'Technical Documentation', size: 32, color: '5D6D7E', font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 80 },
          }),
          new Paragraph({
            children: [new TextRun({ text: 'DigiLog — Industrial Equipment Management System', size: 22, color: '808080', font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 240 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Version 1.0 — ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`, size: 20, color: '808080', font: 'Calibri' })],
            alignment: AlignmentType.CENTER,
            spacing: { before: 120 },
          }),

          new Paragraph({ spacing: { before: 1600 } }),
          new Paragraph({
            children: [new TextRun({ text: 'Document Purpose', size: 22, bold: true, color: BLUE, font: 'Calibri' })],
            spacing: { before: 120 },
          }),
          para('This document provides a comprehensive technical specification of the Admin Audit Log feature implemented in the DigiLog application. It covers the database schema design (with justification for every column), the backend middleware architecture, the data enrichment pipeline, the frontend user interface, and operational guidelines.'),

          // ── 1. Executive Summary ────────────────────────────
          heading('1. Executive Summary'),
          para('The Admin Audit Log is a system-wide activity trail that automatically records every data-modifying action (Create, Update, Delete) performed by any authenticated user in the DigiLog application. It is designed with three primary objectives:'),
          bullet('Accountability — Every change is attributed to a specific user with their name, email, role, and department recorded at the time of the action.'),
          bullet('Readability — Raw API calls are transformed into human-readable descriptions with breadcrumb navigation paths so that non-technical plant managers can understand what happened.'),
          bullet('Debuggability — Full request payloads are preserved (with sensitive data redacted) so that engineers can investigate issues, compare data states, and reproduce problems.'),
          para('The audit log captures actions across all application modules: Power Plant Equipment, Sugar House Equipment, Mill House Equipment, Admin Configuration, Forms, BI Control Tower, and Data Upload.'),

          // ── 2. Architecture Overview ────────────────────────
          heading('2. Architecture Overview'),
          para('The audit logging system consists of four layers:'),
          bulletBold('Database Layer', 'A MySQL audit_logs table with 23 columns and 7 indexes for efficient querying.'),
          bulletBold('Middleware Layer', 'An Express.js middleware (auditMiddleware.js) that intercepts every HTTP response and asynchronously writes an audit record.'),
          bulletBold('Enrichment Layer', 'A utility module (auditLog.js) that resolves IDs to names, builds breadcrumb paths, diffs specification changes, and generates human-readable descriptions.'),
          bulletBold('Presentation Layer', 'A React UI component (AuditLogSection.jsx) in the Admin Config section with filtering, pagination, and expandable detail views.'),

          heading('2.1 Data Flow', HeadingLevel.HEADING_2),
          para('1. User performs an action in the frontend (e.g. saves equipment specifications).'),
          para('2. Frontend sends an API request (e.g. PUT /api/power-new/42/specs).'),
          para('3. auditMiddleware intercepts the request before it reaches the route handler.'),
          para('4. For specification saves, captureSpecsBefore() loads the previous equipment list from the database (so we can diff later).'),
          para('5. The route handler processes the request and sends a response.'),
          para('6. On the response "finish" event, the middleware begins asynchronous audit processing (via setImmediate so it never delays the user\'s response).'),
          para('7. The request body is sanitised and transformed into human-readable field/value rows grouped by section.'),
          para('8. enrichAuditContext() resolves IDs in the API path to names (equipment names, hierarchy node names, user names) by querying the database.'),
          para('9. buildChangeDescription() generates a plain-English sentence describing the action.'),
          para('10. All enriched data is inserted into the audit_logs table.'),

          // ── 3. Database Schema ──────────────────────────────
          heading('3. Database Schema — audit_logs Table'),
          para('The audit_logs table stores every logged action as a single row. The schema is designed to balance query performance (via denormalisation and indexes), human readability (via precomputed display fields), and forensic completeness (via the full request body).'),

          heading('3.1 Column Definitions and Justifications', HeadingLevel.HEADING_2),
          para('The following table documents every column, its data type, and the strong rationale for its inclusion.'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Column', 18),
                  headerCell('Type', 22),
                  headerCell('Reason for Inclusion', 60),
                ],
                tableHeader: true,
              }),
              ...DB_COLUMNS.map(([col, type, reason], idx) =>
                new TableRow({
                  children: [
                    bodyCell(col, 18, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(type, 22, { shaded: idx % 2 === 1 }),
                    bodyCell(reason, 60, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          heading('3.2 Indexes', HeadingLevel.HEADING_2),
          para('Seven indexes are defined on the table to support the most common query patterns:'),
          bulletBold('created_at', 'Primary sort/filter axis — all queries order by timestamp. Date-range filtering is the most common filter in the UI.'),
          bulletBold('user_id', 'Filter all actions by a specific employee. Supports the "who did what" investigation pattern.'),
          bulletBold('method', 'Filter by HTTP method for technical debugging (e.g. show all DELETE requests).'),
          bulletBold('action_type', 'Filter by human-readable action (Create / Update / Delete) — the primary UI filter.'),
          bulletBold('module_key', 'Filter by application module (power-new, sugar-new, admin, forms).'),
          bulletBold('status_code', 'Filter by HTTP status to find failed requests or specific error patterns.'),
          bulletBold('success', 'Boolean index for the simple success/failure filter in the UI. Much faster than evaluating status_code ranges.'),

          // ── 4. Backend Middleware ───────────────────────────
          heading('4. Backend Middleware — auditMiddleware.js'),
          para('The middleware is registered globally in server.js after express.json() and before all route definitions. This ensures every API request is intercepted.'),

          heading('4.1 Key Design Decisions', HeadingLevel.HEADING_2),
          bulletBold('Non-blocking', 'Audit processing happens in setImmediate() after the response is sent. The user\'s API response is never delayed by audit logging.'),
          bulletBold('Fail-safe', 'All audit operations are wrapped in try/catch. If audit logging fails, the original request is unaffected — errors are logged to the console but never bubble up to the user.'),
          bulletBold('Pre-capture for diffs', 'For specification saves, the middleware loads the previous __subsections__ state before the route handler runs. This is the only synchronous database call in the audit pipeline, and it only executes for PUT requests ending in /specs.'),
          bulletBold('Skip list', 'GET requests, health checks, audit-log reads, and internal hierarchy bookkeeping (/link, /sync-name) are skipped to avoid noise and recursion.'),

          heading('4.2 Enrichment Pipeline', HeadingLevel.HEADING_2),
          para('Each audit entry goes through a 6-step enrichment pipeline:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Step', 24),
                  headerCell('Purpose', 76),
                ],
                tableHeader: true,
              }),
              ...ENRICHMENT_STEPS.map(([step, purpose], idx) =>
                new TableRow({
                  children: [
                    bodyCell(step, 24, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(purpose, 76, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          // ── 5. Skipped Requests ─────────────────────────────
          heading('5. Requests Excluded from Audit Logging'),
          para('Not all API calls are logged. The following types of requests are intentionally excluded to maintain a clean, meaningful audit trail:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Request Type', 30),
                  headerCell('Reason for Exclusion', 70),
                ],
                tableHeader: true,
              }),
              ...SKIPPED_PATHS.map(([type, reason], idx) =>
                new TableRow({
                  children: [
                    bodyCell(type, 30, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(reason, 70, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          // ── 6. Data Enrichment ──────────────────────────────
          heading('6. Data Enrichment — auditLog.js'),

          heading('6.1 Action Type Derivation', HeadingLevel.HEADING_2),
          para('HTTP methods are mapped to human-readable action types:'),
          bullet('POST → Create'),
          bullet('PUT, PATCH → Update'),
          bullet('DELETE → Delete'),

          heading('6.2 Breadcrumb Path Resolution', HeadingLevel.HEADING_2),
          para('Raw API paths like /api/power-new/42/specs are converted to breadcrumb trails like "Power Plant Equipment > 160 tph > subcategory 1 > equipment 1 > Specs" by:'),
          bullet('Mapping the first path segment to a module label (power-new → "Power Plant Equipment").'),
          bullet('Walking up the hierarchy tree in the database to resolve node IDs to names.'),
          bullet('Mapping resource segments to screen labels (specs → "Specs", schedule → "OEM Schedule").'),
          bullet('Removing redundant consecutive segments for cleaner display.'),

          heading('6.3 Change Description Generation', HeadingLevel.HEADING_2),
          para('The buildChangeDescription() function generates context-aware sentences based on the resource type:'),
          bulletBold('Hierarchy', 'Identifies the item kind dynamically (category, subcategory, equipment for Power Plant; section, location, main equipment, sub equipment for Sugar House) based on tree depth and module.'),
          bulletBold('Specifications', 'Diffs the before/after equipment lists to describe only what was added or removed under which discipline (e.g. \'Added "equipment 3" under Instrument discipline on "eq1"\').'),
          bulletBold('OEM Schedule', 'Generates "Saved OEM schedule for [equipment name]".'),
          bulletBold('Maintenance History', 'Describes the record type and the discipline/sub-section context.'),
          bulletBold('Admin (Users)', 'Uses verbs matching the action (Created/Updated/Deleted employee "Name").'),
          bulletBold('Forms', 'Identifies the form by name and whether it was a batch submission or single record.'),

          heading('6.4 Request Body Transformation', HeadingLevel.HEADING_2),
          para('The raw API payload is transformed into a structured, human-readable format with field/value rows. Each row includes a group assignment for sectioned display in the UI:'),
          bulletBold('Specifications payloads', 'Each spec row is grouped by its discipline and sub-section (e.g. "Instrument > equipment 3"). The __subsections__ field is expanded into per-discipline equipment lists. Binary metadata (__subgroup_meta__) is replaced with a placeholder.'),
          bulletBold('OEM Schedule payloads', 'Each schedule row is grouped as "OEM Schedule > [Discipline] > [Equipment] > Row N".'),
          bulletBold('Maintenance History payloads', 'Fields are labelled using display names (Season, Observation, Action Taken, Repair Cost, etc.). Images show photo counts instead of base64 data.'),
          bulletBold('Generic payloads', 'All keys are converted to Title Case and grouped under "Details". Sensitive keys (password, token, authorization) are redacted.'),

          heading('6.5 Specification Diff Logic', HeadingLevel.HEADING_2),
          para('When a user saves equipment specifications, the system computes a diff to show only what changed:'),
          para('1. Before the route handler executes, captureSpecsBefore() loads the current __subsections__ JSON from the database (the "before" state).'),
          para('2. After the route handler completes, the middleware compares the "before" state with the new __subsections__ value in the request body (the "after" state).'),
          para('3. For each discipline (Mechanical, Civil, Instrument, Electrical, Instrument II), the diff identifies:'),
          bullet('Items present in "after" but not in "before" → marked as Added.'),
          bullet('Items present in "before" but not in "after" → marked as Removed.'),
          bullet('Items present in both → not mentioned (reduces noise).'),
          para('4. The diff results are stored in the "Changes" group of the request body, while the full submitted lists are stored in the "Equipment lists (full input)" group for reference.'),

          // ── 7. Frontend UI ──────────────────────────────────
          heading('7. Frontend User Interface'),
          para('The audit log is accessible under Admin Config > Audit Log. It presents a filterable, paginated table with expandable detail rows.'),

          heading('7.1 Table Columns', HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Column', 20),
                  headerCell('Description', 80),
                ],
                tableHeader: true,
              }),
              ...FRONTEND_COLUMNS.map(([col, desc], idx) =>
                new TableRow({
                  children: [
                    bodyCell(col, 20, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(desc, 80, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          heading('7.2 Filters', HeadingLevel.HEADING_2),
          para('The UI provides five filter controls:'),
          bulletBold('Search', 'Free-text search across name, email, description, display path, resource name, and department.'),
          bulletBold('Action', 'Dropdown: All, Create, Update, Delete.'),
          bulletBold('Result', 'Dropdown: All results, Success, Failed.'),
          bulletBold('From / To', 'Date range pickers for filtering by time period.'),
          para('Filters are applied on form submit (Apply button) and reset pagination to page 1.'),

          heading('7.3 Expandable Detail View', HeadingLevel.HEADING_2),
          para('When a user clicks the expand button on any row, the full request payload is displayed in grouped tables. The groups correspond to logical sections of the submitted data:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Group', 28),
                  headerCell('Contents', 72),
                ],
                tableHeader: true,
              }),
              ...BODY_SECTIONS.map(([group, content], idx) =>
                new TableRow({
                  children: [
                    bodyCell(group, 28, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(content, 72, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          heading('7.4 Pagination', HeadingLevel.HEADING_2),
          para('Results are paginated with 25 entries per page. The UI shows the total entry count, current page, total pages, and Previous/Next navigation buttons.'),

          // ── 8. API Endpoint ─────────────────────────────────
          heading('8. API Endpoint — GET /admin/audit-logs'),
          para('The audit log data is served by a single read-only endpoint:'),
          bulletBold('URL', 'GET /api/admin/audit-logs'),
          bulletBold('Authentication', 'Requires a valid session token (admin role recommended).'),
          bulletBold('Query Parameters', 'page (default 1), limit (default 25, max 100), q (search text), action (Create/Update/Delete), success (1 or 0), from (date), to (date).'),

          heading('8.1 Response Enrichment on Read', HeadingLevel.HEADING_2),
          para('For backward compatibility with older audit entries that were created before enrichment columns were added, the API endpoint re-enriches each row at read time:'),
          bullet('If action_type is missing, it is derived from the HTTP method.'),
          bullet('If display_path is missing, it is rebuilt by querying the database for current names.'),
          bullet('If resource_name is missing, it is extracted from the stored request body.'),
          bullet('The description (action_summary) is always regenerated from current context to ensure consistency.'),
          para('This means that even old audit entries display meaningful descriptions and breadcrumb paths in the UI.'),

          // ── 9. Security Considerations ──────────────────────
          heading('9. Security and Privacy Considerations'),
          bulletBold('Sensitive Data Redaction', 'Fields matching patterns (password, token, secret, authorization, cookie) are automatically redacted to "[Redacted]" in the stored request body.'),
          bulletBold('Image/Binary Omission', 'Base64-encoded images and strings longer than 500 characters are replaced with "[Image / long text omitted]" to keep audit records manageable.'),
          bulletBold('Body Size Cap', 'The stored request body is capped at 100,000 characters (approximately 100 KB) to prevent oversized payloads from consuming excessive storage.'),
          bulletBold('Non-destructive', 'Audit records are append-only. There is no API endpoint to delete or modify audit entries.'),
          bulletBold('IP Logging', 'Client IP is recorded for forensic investigations but not displayed in the main UI table to avoid cluttering the view for non-security users.'),

          // ── 10. Module Label Mapping ────────────────────────
          heading('10. Module and Resource Label Mappings'),
          para('The system maps internal API prefixes to user-friendly module names:'),
          bullet('power-new → Power Plant Equipment'),
          bullet('power → Power Plant Equipment (Legacy)'),
          bullet('sugar-new → Sugar House Equipment'),
          bullet('equipment → Mill House Equipment'),
          bullet('forms → Forms'),
          bullet('admin → Admin Config'),
          bullet('auth → Account'),
          bullet('bi → BI Control Tower'),
          bullet('data-upload → Data Upload'),
          bullet('homepage-cards → Homepage Cards'),
          bullet('apps → Apps'),

          para('Resource segments are also mapped to screen-level labels:'),
          bullet('specs → Specs'),
          bullet('schedule → OEM Schedule'),
          bullet('history → Life History'),
          bullet('hierarchy → Hierarchy'),
          bullet('image → Image'),
          bullet('records → Record'),
          bullet('batch → Batch Submit'),
          bullet('manager → Assign Manager'),
          bullet('rename → Rename'),

          // ── 11. Example Descriptions ────────────────────────
          heading('11. Example Auto-Generated Descriptions'),
          para('Below are representative examples of the action_summary text generated for different user actions:'),
          bullet('Added category "160 tph" under "Power Plant"'),
          bullet('Added subcategory "subcategory 1" under "160 tph"'),
          bullet('Added equipment "equipment 1" under "subcategory 1"'),
          bullet('Updated specifications for "equipment 1" under Instrument discipline — Capacity, Pressure'),
          bullet('Added "equipment 3" under Instrument discipline on "equipment 1"'),
          bullet('Removed "equipment 2" under Mechanical discipline on "equipment 1"'),
          bullet('Saved OEM schedule for "equipment 1"'),
          bullet('Added maintenance history record on "equipment 1" (Instrument > motor)'),
          bullet('Renamed equipment sub-group "old motor" to "new motor" on "equipment 1"'),
          bullet('Created employee "John Doe"'),
          bullet('Assigned manager for "Jane Smith"'),
          bullet('Sent activation email to "John Doe"'),
          bullet('Submitted form "Daily Log Sheet"'),
          bullet('Submitted batch rows on form "Lab Analysis"'),
          bullet('Deleted maintenance history record on "equipment 1"'),

          // ── 12. Noise Reduction ─────────────────────────────
          heading('12. Noise Reduction Strategies'),
          para('Several strategies are employed to keep the audit trail clean and meaningful:'),
          bulletBold('Conditional API calls', 'The frontend hierarchy management panel (HierarchyManagePanel.jsx) was modified to only send PUT requests for items that actually changed (name, sort order, or sugar-specific fields). This prevents duplicate audit entries when saving a modal that contains both modified and unmodified items.'),
          bulletBold('Internal operation filtering', 'Hierarchy /link and /sync-name operations are excluded from logging because they are automatic side-effects of equipment saves, not direct user actions.'),
          bulletBold('GET exclusion', 'Read-only requests are never logged, keeping the audit trail focused on state changes.'),
          bulletBold('Diff-based descriptions', 'For specification saves, only the actual changes (added/removed equipment) are described, not the entire list.'),

          // ── 13. Files Reference ─────────────────────────────
          heading('13. Source Files Reference'),
          para('The audit log feature spans the following source files:'),
          bulletBold('DigiLog/mysql/init.sql', 'Database table definition with all columns and indexes.'),
          bulletBold('DigiLog/backend/middleware/auditMiddleware.js', 'Express middleware — request interception and async audit record creation.'),
          bulletBold('DigiLog/backend/utils/auditLog.js', 'Core enrichment utilities — sanitisation, path resolution, description generation, spec diffing.'),
          bulletBold('DigiLog/backend/controllers/auditLog.controller.js', 'API endpoint handler — query building, read-time enrichment, pagination.'),
          bulletBold('DigiLog/backend/routes/admin.routes.js', 'Route registration for GET /admin/audit-logs.'),
          bulletBold('DigiLog/frontend/src/components/admin/config/AuditLogSection.jsx', 'React UI — table, filters, expandable detail view.'),
          bulletBold('DigiLog/frontend/src/components/admin/config/adminConfigSections.js', 'Tab registration in Admin Config.'),
          bulletBold('DigiLog/frontend/src/components/power/HierarchyManagePanel.jsx', 'Optimised conditional API calls for hierarchy saves.'),

          // ── 14. User Activity & Navigation Tracking ─────────
          heading('14. User Activity & Navigation Tracking'),
          para('Beyond data-modifying actions, the system tracks how users navigate and interact with the application. This includes which sections they visit, which forms or dashboards they open, which buttons they click, and how long they spend on each page. This data is essential for understanding user engagement, identifying underutilised features, and optimising the user experience.'),

          heading('14.1 What to Track', HeadingLevel.HEADING_2),
          para('The following user interactions should be captured:'),
          bulletBold('Page Views', 'Every time a user navigates to a new page or section. Records the page path, display breadcrumb, section, card, and form/dashboard name.'),
          bulletBold('Section Opens', 'When a user opens a top-level hub (Forms Hub, BI Control Tower, Power Plant Equipment, Sugar House Equipment, Admin Config, Data Upload).'),
          bulletBold('Card / App Clicks', 'When a user clicks on a card within a hub (e.g. "Mill Logbook" in Forms Hub, "Milling Division Cockpit" in BI Control Tower).'),
          bulletBold('Form Opens', 'When a user opens a specific form for data entry (e.g. "Equipment Temperature" under Mill Logbook).'),
          bulletBold('Dashboard Opens', 'When a user opens a specific BI dashboard.'),
          bulletBold('Button Clicks', 'When a user clicks key action buttons (Save, Delete, Add Equipment, Export, etc.). Tracked via data-track attributes on DOM elements.'),
          bulletBold('Form Submissions', 'When a user submits a form (captured both here for navigation analytics and in audit_logs for the data change itself).'),

          heading('14.2 Database Table — user_activity_logs', HeadingLevel.HEADING_2),
          para('A dedicated table stores all navigation and interaction events. Designed for high-volume inserts with efficient querying by user, section, and time range.'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Column', 18),
                  headerCell('Type', 22),
                  headerCell('Reason for Inclusion', 60),
                ],
                tableHeader: true,
              }),
              ...ACTIVITY_LOG_COLUMNS.map(([col, type, reason], idx) =>
                new TableRow({
                  children: [
                    bodyCell(col, 18, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(type, 22, { shaded: idx % 2 === 1 }),
                    bodyCell(reason, 60, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          // ── 15. Session Tracking ────────────────────────────
          heading('15. Session & Login Duration Tracking (Proposed)'),
          para('To answer questions like "how long was this user logged in?" and "who is online right now?", a separate session tracking table is required. Each login creates a session record; logouts, timeouts, and heartbeat misses close it.'),

          heading('15.1 Proposed Database Table — user_sessions', HeadingLevel.HEADING_2),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Column', 18),
                  headerCell('Type', 22),
                  headerCell('Reason for Inclusion', 60),
                ],
                tableHeader: true,
              }),
              ...SESSION_LOG_COLUMNS.map(([col, type, reason], idx) =>
                new TableRow({
                  children: [
                    bodyCell(col, 18, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(type, 22, { shaded: idx % 2 === 1 }),
                    bodyCell(reason, 60, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          heading('15.2 Session Lifecycle', HeadingLevel.HEADING_2),
          para('1. Login: When a user authenticates successfully, a new row is inserted into user_sessions with a unique session_id (UUID). The session_id is stored in the frontend (e.g. in memory or sessionStorage) and sent as a header (X-Session-Id) with every subsequent API call.'),
          para('2. Heartbeat: The frontend sends a lightweight ping (POST /api/auth/heartbeat) every 60 seconds. The backend updates last_heartbeat on the session row. This keeps the "is_active" status accurate.'),
          para('3. Logout: On explicit logout, the backend sets logout_at = NOW(), duration_minutes = TIMESTAMPDIFF(MINUTE, login_at, NOW()), and is_active = 0.'),
          para('4. Timeout Detection: A scheduled job (cron or setInterval) runs every 5 minutes. Any session where is_active = 1 AND last_heartbeat < NOW() - INTERVAL 5 MINUTE is marked as expired: logout_at = last_heartbeat, is_active = 0, and duration_minutes is computed.'),
          para('5. Browser Close: The frontend uses the navigator.sendBeacon() API on the beforeunload event to send a final heartbeat. If the beacon fails (e.g. user kills the browser), the timeout detection mechanism catches it within 5 minutes.'),

          heading('15.3 Dwell Time Tracking per Page', HeadingLevel.HEADING_2),
          para('When a user navigates to a new page, the frontend:'),
          para('1. Sends a POST /api/activity/page-view event with the page details (section, card, form, page_path, display_path).'),
          para('2. Starts a timer for the current page.'),
          para('3. When the user navigates away (via React Router\'s useEffect cleanup), sends a PATCH /api/activity/:id/exit with the dwell_seconds computed on the client side.'),
          para('4. As a fallback, the heartbeat mechanism also updates the exited_at of the most recent activity event for the session, so dwell time is captured even if the user closes the tab.'),

          heading('15.4 Reports Enabled by Session Tracking', HeadingLevel.HEADING_2),
          bulletBold('Average session duration', 'AVG(duration_minutes) grouped by user, department, or role.'),
          bulletBold('Daily/weekly active users', 'COUNT(DISTINCT user_id) grouped by DATE(login_at).'),
          bulletBold('Peak usage hours', 'COUNT(*) grouped by HOUR(login_at) to identify busy periods.'),
          bulletBold('Who is online now?', 'SELECT * FROM user_sessions WHERE is_active = 1.'),
          bulletBold('Time spent per section', 'SUM(dwell_seconds) from user_activity_logs grouped by section.'),
          bulletBold('Most used forms', 'COUNT(*) from user_activity_logs WHERE event_type = "form_open" grouped by form_or_dashboard.'),
          bulletBold('Least used dashboards', 'Identify BI dashboards with low page_view counts for potential removal or promotion.'),
          bulletBold('User engagement score', 'Composite of session frequency, duration, and action count per user per month.'),

          // ── 16. Cascading Filters ───────────────────────────
          heading('16. Cascading (Hierarchical) Filters for Audit & Activity Logs'),
          para('To enable precise filtering of both audit logs and activity logs, the UI should implement a cascading filter system. Each filter level narrows down the options in the next level, mirroring the application\'s navigation hierarchy.'),

          heading('16.1 Filter Levels', HeadingLevel.HEADING_2),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Filter Level', 18),
                  headerCell('Column', 12),
                  headerCell('Example Values', 40),
                  headerCell('Behaviour', 30),
                ],
                tableHeader: true,
              }),
              ...CASCADE_FILTER_LEVELS.map(([level, col, examples, behaviour], idx) =>
                new TableRow({
                  children: [
                    bodyCell(level, 18, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(col, 12, { shaded: idx % 2 === 1 }),
                    bodyCell(examples, 40, { shaded: idx % 2 === 1 }),
                    bodyCell(behaviour, 30, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          heading('16.2 Cascade Logic — Forms Hub', HeadingLevel.HEADING_2),
          para('When the user selects "Forms Hub" as the Section filter, the Card dropdown is populated with all Forms Hub apps. When a specific card is selected, the Form dropdown is populated with forms belonging to that card:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Card (Level 2)', 35),
                  headerCell('Forms / Items (Level 3)', 65),
                ],
                tableHeader: true,
              }),
              ...FORMS_HUB_TREE.map(([card, forms], idx) =>
                new TableRow({
                  children: [
                    bodyCell(card, 35, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(forms, 65, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          heading('16.3 Cascade Logic — BI Control Tower', HeadingLevel.HEADING_2),
          para('When the user selects "BI Control Tower" as the Section filter, the Card/Dashboard dropdown is populated with all BI dashboards:'),

          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  headerCell('Dashboard Name', 60),
                  headerCell('Form Key', 40),
                ],
                tableHeader: true,
              }),
              ...BI_DASHBOARDS.map(([name, key], idx) =>
                new TableRow({
                  children: [
                    bodyCell(name, 60, { bold: true, shaded: idx % 2 === 1 }),
                    bodyCell(key, 40, { shaded: idx % 2 === 1 }),
                  ],
                }),
              ),
            ],
          }),

          para('For BI Control Tower, the Cane Performance Dashboard has internal tabs (Procurement Summary, Gate 1, Gate 2, Center Purchase, Vehicle Handling, Vehicle Holding, Vehicle Holding 2, Truck Transit, Truck Holding, Database). These can optionally be tracked as a Level 4 filter or included in the metadata JSON field.'),

          heading('16.4 Cascade Logic — Power Plant Equipment', HeadingLevel.HEADING_2),
          para('When the user selects "Power Plant Equipment" as the Section filter:'),
          bulletBold('Level 2 (Card)', 'Shows top-level categories from the hierarchy: 150TPH BLR, 70TPH BLR, 30.85MW STG, WTP, etc.'),
          bulletBold('Level 3 (Form/Equipment)', 'Shows subcategories under the selected category (e.g. Auxiliary Equipment, Pressure Parts under 150TPH BLR). A further drill-down could show individual equipment names.'),
          para('The options are dynamically fetched from the ppn_hierarchy_node table using the parent_id relationship.'),

          heading('16.5 Cascade Logic — Sugar House Equipment', HeadingLevel.HEADING_2),
          para('When the user selects "Sugar House Equipment" as the Section filter:'),
          bulletBold('Level 2 (Card)', 'Shows top-level sections from the hierarchy (dynamic, DB-driven from shn_hierarchy_node).'),
          bulletBold('Level 3 (Form/Equipment)', 'Shows locations or main equipment under the selected section.'),
          para('The Sugar House hierarchy has one additional depth level (Section > Location > Main Equipment > Sub Equipment), so the Level 3 filter may show locations, with an optional Level 4 for equipment.'),

          heading('16.6 Cascade Logic — Admin Config', HeadingLevel.HEADING_2),
          para('When the user selects "Admin Config" as the Section filter:'),
          bulletBold('Level 2 (Card)', 'Shows admin sub-sections: Employees, Employee Categories, Season Mapping, BI Dashboards, Audit Log.'),
          bulletBold('Level 3', 'Not applicable for most admin sections (single-level). For Employees, could optionally show individual employee names.'),

          heading('16.7 Frontend Implementation Approach', HeadingLevel.HEADING_2),
          para('The cascading filter should be implemented as a set of controlled React select components:'),
          para('1. Section dropdown: Static list of all top-level sections. When changed, resets Card and Form to "All".'),
          para('2. Card dropdown: Fetches options from an API endpoint (e.g. GET /api/admin/audit-filters?section=forms_hub) that returns the valid Level 2 values for the selected section. Disabled until Section is selected.'),
          para('3. Form/Dashboard dropdown: Fetches Level 3 options based on the selected Card (e.g. GET /api/admin/audit-filters?section=forms_hub&card=mill_logbook). Disabled until Card is selected.'),
          para('4. The API queries the appropriate tables (apps, forms, hierarchy nodes, BI dashboard settings) to build the filter options dynamically. This ensures the filter always reflects the current state of the data.'),
          para('5. When filters are applied, the audit_logs or user_activity_logs query adds WHERE clauses on module_key, section, card, and form_or_dashboard columns as appropriate.'),

          // ── 17. Complete Application Navigation Map ─────────
          heading('17. Complete Application Navigation Map'),
          para('For reference, the following is the complete navigation hierarchy of the DigiLog application. The audit and activity logging systems should be able to track actions and navigation at every level of this hierarchy.'),

          heading('17.1 Dashboard (Home)', HeadingLevel.HEADING_2),
          para('The landing page after login. Shows homepage cards assigned to the user. Cards may include:'),
          bullet('Forms Hub — Opens /forms-hub with assigned app cards.'),
          bullet('BI Control Tower — Opens /bi with assigned BI dashboards.'),

          heading('17.2 Forms Hub — Complete Card & Form Tree', HeadingLevel.HEADING_2),
          para('Forms Hub displays cards for each app assigned to the user. Each card opens either a multi-form app page or a direct equipment hub.'),

          para('Operational Logbook Apps:', { bold: true }),
          bulletBold('Mill Logbook', 'Equipment Temperature, Shredder and OTG, Lube Pressure and Roller Temp, Mill Stoppages'),
          bulletBold('Lab Logbook', 'DS Logbook, RS Logbook, Operations Logbook, Special Analysis Logbook, Syrup Logbook, Stoppage Logbook'),
          bulletBold('Power Logbook', 'Power Details, Steam Details, Stoppage Details'),
          bulletBold('Distillery Operations', 'Distillery Operations Form'),
          bulletBold('EHS (Environment Health & Safety)', 'Accident Report, Water Dashboard (GWA / ETP / CPU), Daily Safety Toolbox Talk'),
          bulletBold('Production', 'Shift Chemist Job Log Book, A-Centrifugal Machine Stoppage, Pan Log Book, Decanter Log Book, Clarification Log Book'),
          bulletBold('Brix Sampling Forms', 'GSMA Yard Brix Sampling, GSMA Field Brix Sampling'),

          para('Equipment History Hubs:', { bold: true }),
          bulletBold('Mill House Equipment History', 'Flat equipment list > Equipment Detail (Specs, OEM Schedule, Maintenance History)'),
          bulletBold('Power Plant Equipment History', 'Category > Subcategory > Equipment > Discipline (Specs, OEM Schedule, Maintenance History)'),
          bulletBold('Sugar House Equipment History', 'Section > Location > Main Equipment > Sub Equipment > Discipline (Specs, OEM Schedule, Maintenance History)'),

          heading('17.3 BI Control Tower — Dashboard List', HeadingLevel.HEADING_2),
          bulletBold('Distillery Operations — Analytics', 'Analytics dashboard for distillery operations data'),
          bulletBold('Milling Division Cockpit', 'Milling operations overview and KPIs'),
          bulletBold('Purchy Analysis', 'Purchase analysis dashboard'),
          bulletBold('Brix Sampling Analytics', 'Brix sampling data analytics and trends'),
          bulletBold('Centre Maturity Dashboard', 'Centre maturity tracking and metrics'),
          bulletBold('Cane Performance Dashboard', 'Cane performance with sub-tabs: Procurement Summary, Gate 1, Gate 2, Center Purchase, Vehicle Handling, Vehicle Holding, Vehicle Holding 2, Truck Transit, Truck Holding, Database'),

          heading('17.4 Power Plant Equipment Hierarchy', HeadingLevel.HEADING_2),
          para('Four-level hierarchy (Category > Subcategory > Equipment > Discipline):'),
          bulletBold('150TPH BLR', 'Auxiliary Equipment, Pressure Parts, Fuel Handling (Phase 1 & 2), Fuel Feeding, Ash Handling'),
          bulletBold('70TPH BLR', 'Auxiliary Equipment, Pressure Parts, Fuel Handling, Fuel Feeding, Ash Handling'),
          bulletBold('30.85MW STG', 'Condenser, Turbine'),
          bulletBold('WTP', 'DM Plant, RO Plant, Reject Water Pit, Chemical Storage, Chemical Unloading, Laboratory, Water Storage, CPU'),
          para('Each equipment has four engineering disciplines: Mechanical, Civil, Electrical, Instrument.'),
          para('Each discipline has three sections: Specifications, OEM Maintenance Schedule, Maintenance History (Life History).'),

          heading('17.5 Sugar House Equipment Hierarchy', HeadingLevel.HEADING_2),
          para('Five-level hierarchy (Section > Location > Main Equipment > Sub Equipment > Discipline):'),
          para('The hierarchy is DB-driven and imported from Excel. Section names, locations, and equipment are dynamic per plant. The structure mirrors Power Plant but with one additional depth level (Location between Section and Main Equipment).'),
          para('Equipment detail sections are identical to Power Plant: Specs, OEM Schedule, Maintenance History, across the same four disciplines.'),

          heading('17.6 Other Sections', HeadingLevel.HEADING_2),
          bulletBold('Data Upload', 'General file uploads, Purchy Analysis workbook upload. Accessible from the navbar (role-gated).'),
          bulletBold('Admin Config', 'Employees, Employee Categories, Season Mapping, BI Dashboards, Audit Log. Accessible from the navbar (admin only).'),

          // ── 18. Future Enhancements ─────────────────────────
          heading('18. Recommended Future Enhancements'),
          bullet('Export to Excel/CSV — Allow administrators to download filtered audit logs and activity logs for offline analysis.'),
          bullet('Retention policy — Implement automatic archival or deletion of records older than a configurable period (e.g. 2 years for audit_logs, 6 months for activity_logs) to manage table growth.'),
          bullet('Per-equipment audit tab — Show a filtered audit trail directly on the equipment Life History Card.'),
          bullet('Webhook/email alerts — Notify administrators of specific high-risk actions (e.g. bulk deletes, admin role changes) in real time.'),
          bullet('Before/after value comparison — Store both the old and new values for each changed field to enable true field-level diffing beyond equipment lists.'),
          bullet('Batch action grouping — Group multiple related audit entries (e.g. a bulk form submission) under a single parent transaction ID for cleaner display.'),
          bullet('Usage analytics dashboard — Build a dedicated admin dashboard showing user engagement metrics: most active users, most used forms, peak hours, average session length.'),
          bullet('Heatmap visualisation — Display a visual heatmap of which sections and forms receive the most traffic, helping product decisions.'),
          bullet('Idle timeout configuration — Allow admins to configure the idle timeout duration from the Admin Config UI.'),
          bullet('Activity-based access review — Flag users who have not logged in for N days or have never accessed certain sections they have permissions for.'),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.resolve(__dirname, '..', 'Admin_Audit_Log_Documentation.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`Document generated: ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
