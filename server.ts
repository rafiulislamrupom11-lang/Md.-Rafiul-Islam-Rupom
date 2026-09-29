import express from 'express';
import { createServer as createViteServer } from 'vite';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const OWNER_EMAIL = process.env.OWNER_EMAIL || 'rafiulislamrupom11@gmail.com';

interface ServerConfig {
  adminPassword: string;
  clientUploadPassword: string;
  googleSheetId: string;
  googleDriveFolderId: string;
  clientUploadsFolderId: string;
  appsScriptUrl: string;
  maxUploadSizeMb: number;
  allowedFileTypes: string[];
  ownerAccessToken: string | null;
  ownerEmail: string;
}

const serverConfig: ServerConfig = {
  adminPassword: process.env.ADMIN_PASSWORD || 'RupamAdmin2026!',
  clientUploadPassword: process.env.CLIENT_UPLOAD_PASSWORD || 'RupamClient2026!',
  googleSheetId: process.env.GOOGLE_SHEET_ID || '',
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
  clientUploadsFolderId: process.env.CLIENT_UPLOADS_FOLDER_ID || '',
  appsScriptUrl: process.env.APPS_SCRIPT_WEB_APP_URL || '',
  maxUploadSizeMb: 500,
  allowedFileTypes: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska', '.mp4', '.mov', '.webm', '.mkv'],
  ownerAccessToken: null,
  ownerEmail: OWNER_EMAIL,
};

// Active tokens stored strictly in server memory
const adminSessions = new Map<string, { email: string; createdAt: number }>();
const clientUploadSessions = new Map<string, { createdAt: number }>();

// Analytics & Activity Store
interface VisitorSession {
  sessionId: string;
  firstSeen: string;
  lastSeen: string;
  lastSeenMs: number;
  visitCount: number;
  pagesVisited: string[];
  isReturning: boolean;
}

interface SignedInVisitorRecord {
  timestamp: string;
  name: string;
  email: string;
  loginMethod: string;
  pageVisited: string;
  firstVisit: string;
  lastActivity: string;
  status: 'Active' | 'Returning Visitor';
}

interface ContactMessageRecord {
  id: string;
  timestamp: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  replyStatus: string;
}

interface VideoUploadRecord {
  id: string;
  timestamp: string;
  uploaderName: string;
  uploaderEmail: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  driveFileId: string;
  driveFolderId?: string;
  driveUrl: string;
  status: string;
  isClientUpload?: boolean;
}

interface ActivityLogItem {
  id: string;
  time: string;
  timestampIso: string;
  activity: string;
  user: string;
  page?: string;
  status: string;
}

const anonymousSessions = new Map<string, VisitorSession>();
let totalPageVisits = 0;
const pageVisitCounts: Record<string, number> = {
  Home: 0,
  About: 0,
  Work: 0,
  'Video Showcase': 0,
  Services: 0,
  Socials: 0,
  'Client Upload': 0,
  Contact: 0,
};

const signedInVisitors = new Map<string, SignedInVisitorRecord>();
const contactMessages: ContactMessageRecord[] = [];
const videoUploads: VideoUploadRecord[] = [];
const activityLog: ActivityLogItem[] = [];

function formatNow(): { display: string; timeOnly: string; iso: string } {
  const now = new Date();
  const iso = now.toISOString();
  const display = now.toLocaleString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const timeOnly = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  return { display, timeOnly, iso };
}

function addActivity(activity: string, user: string, status: string, page?: string) {
  const { timeOnly, iso } = formatNow();
  activityLog.unshift({
    id: crypto.randomUUID(),
    time: timeOnly,
    timestampIso: iso,
    activity,
    user,
    page,
    status,
  });
  if (activityLog.length > 100) {
    activityLog.pop();
  }
}

// Helper: Ensure a tab exists in Google Sheets and append or update row
async function ensureSheetTabAndAppend(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
  headers: string[],
  rowValues: string[]
): Promise<boolean> {
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return false;
    const meta = await metaRes.json();
    const existingTabs: string[] = (meta.sheets || []).map((s: any) => s.properties?.title);

    if (!existingTabs.includes(tabName)) {
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [{ addSheet: { properties: { title: tabName } } }],
        }),
      });

      // Write header row
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:append?valueInputOption=USER_ENTERED`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ values: [headers] }),
        }
      );
    }

    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowValues] }),
      }
    );
    return appendRes.ok;
  } catch (err) {
    console.error(`Error writing to Google Sheet tab ${tabName}:`, err);
    return false;
  }
}

// Helper: Update or insert visitor row in Website Visitors tab without duplicating on refresh
async function upsertVisitorInSheet(
  accessToken: string,
  spreadsheetId: string,
  visitor: SignedInVisitorRecord
): Promise<boolean> {
  const tabName = 'Website Visitors';
  const headers = ['Date & Time', 'Name', 'Email', 'Login Method', 'Page Visited', 'Last Activity', 'Status'];
  try {
    const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!metaRes.ok) return false;
    const meta = await metaRes.json();
    const existingTabs: string[] = (meta.sheets || []).map((s: any) => s.properties?.title);

    if (!existingTabs.includes(tabName)) {
      return ensureSheetTabAndAppend(accessToken, spreadsheetId, tabName, headers, [
        visitor.timestamp,
        visitor.name,
        visitor.email,
        visitor.loginMethod,
        visitor.pageVisited,
        visitor.lastActivity,
        visitor.status,
      ]);
    }

    // Read existing rows to see if visitor email already exists
    const readRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:G500`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    if (readRes.ok) {
      const data = await readRes.json();
      const rows: string[][] = data.values || [];
      const rowIndex = rows.findIndex((r, idx) => idx > 0 && r[2]?.toLowerCase() === visitor.email.toLowerCase());
      if (rowIndex !== -1) {
        const sheetRowNumber = rowIndex + 1;
        const updateRes = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A${sheetRowNumber}:G${sheetRowNumber}?valueInputOption=USER_ENTERED`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              values: [[
                rows[rowIndex][0] || visitor.timestamp,
                visitor.name,
                visitor.email,
                visitor.loginMethod,
                visitor.pageVisited,
                visitor.lastActivity,
                'Returning Visitor',
              ]],
            }),
          }
        );
        return updateRes.ok;
      }
    }

    return ensureSheetTabAndAppend(accessToken, spreadsheetId, tabName, headers, [
      visitor.timestamp,
      visitor.name,
      visitor.email,
      visitor.loginMethod,
      visitor.pageVisited,
      visitor.lastActivity,
      visitor.status,
    ]);
  } catch (err) {
    console.error('Error upserting visitor in sheet:', err);
    return false;
  }
}

// Helper: Find or create a Google Drive folder by exact name inside an optional parent folder
async function findOrCreateDriveFolder(
  accessToken: string,
  folderName: string,
  parentFolderId?: string
): Promise<{ id: string; webViewLink?: string } | null> {
  try {
    const escapedName = folderName.replace(/'/g, "\\'");
    let query = `mimeType='application/vnd.google-apps.folder' and name='${escapedName}' and trashed=false`;
    if (parentFolderId) {
      query += ` and '${parentFolderId}' in parents`;
    }

    const searchRes = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,webViewLink)&pageSize=5`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.files && searchData.files.length > 0) {
        return { id: searchData.files[0].id, webViewLink: searchData.files[0].webViewLink };
      }
    }

    // Create folder if not found
    const createBody: any = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    };
    if (parentFolderId) {
      createBody.parents = [parentFolderId];
    }

    const createRes = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
    });

    if (!createRes.ok) return null;
    const created = await createRes.json();
    return { id: created.id, webViewLink: created.webViewLink };
  } catch (err) {
    console.error('Error finding/creating Drive folder:', err);
    return null;
  }
}

// Helper: Send Gmail notification
async function sendGmailNotification(
  accessToken: string,
  contact: { name: string; email: string; subject: string; message: string; timestamp: string }
): Promise<boolean> {
  try {
    const emailLines = [
      `To: ${OWNER_EMAIL}`,
      `Reply-To: "${contact.name.replace(/"/g, '')}" <${contact.email}>`,
      `Subject: New Portfolio Contact: ${contact.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'MIME-Version: 1.0',
      '',
      'New Portfolio Contact',
      '',
      `Visitor Name:\n${contact.name}`,
      '',
      `Visitor Email:\n${contact.email}`,
      '',
      `Subject:\n${contact.subject}`,
      '',
      `Message:\n${contact.message}`,
      '',
      `Date & Time:\n${contact.timestamp}`,
    ];

    const rawMessage = Buffer.from(emailLines.join('\r\n'))
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: rawMessage }),
    });
    return res.ok;
  } catch (err) {
    console.error('Error sending Gmail notification:', err);
    return false;
  }
}

// Middleware to require Admin Session
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = req.headers['x-admin-token'] as string;
  if (!token || !adminSessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized admin session. Please log in.' });
    return;
  }
  next();
}

// 1. YouTube oEmbed Metadata Endpoint
const ytMetadataCache = new Map<string, { title: string; author_name: string; thumbnail_url: string }>();

app.get('/api/youtube/oembed', async (req, res) => {
  const videoUrl = req.query.url as string;
  if (!videoUrl) {
    res.status(400).json({ error: 'Missing url parameter' });
    return;
  }

  if (ytMetadataCache.has(videoUrl)) {
    res.json(ytMetadataCache.get(videoUrl));
    return;
  }

  try {
    // Normalize Shorts URLs to standard watch URLs for oEmbed compatibility
    let normalizedUrl = videoUrl;
    const shortsMatch = videoUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    const shortLinkMatch = videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      normalizedUrl = `https://www.youtube.com/watch?v=${shortsMatch[1]}`;
    } else if (shortLinkMatch) {
      normalizedUrl = `https://www.youtube.com/watch?v=${shortLinkMatch[1]}`;
    }

    const oembedRes = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`
    );
    if (!oembedRes.ok) {
      res.status(404).json({ error: 'Metadata unavailable' });
      return;
    }
    const data = await oembedRes.json();
    const result = {
      title: data.title || '',
      author_name: data.author_name || '',
      thumbnail_url: data.thumbnail_url || '',
    };
    ytMetadataCache.set(videoUrl, result);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to fetch YouTube metadata' });
  }
});

// 2. Privacy-Conscious Visitor Analytics Endpoint
app.post('/api/analytics/visit', (req, res) => {
  const { sessionId, page = 'Home' } = req.body || {};
  if (!sessionId || typeof sessionId !== 'string') {
    res.status(400).json({ error: 'Invalid session identifier' });
    return;
  }

  const { display } = formatNow();
  const nowMs = Date.now();
  totalPageVisits += 1;

  if (pageVisitCounts[page] !== undefined) {
    pageVisitCounts[page] += 1;
  } else {
    pageVisitCounts[page] = 1;
  }

  const existing = anonymousSessions.get(sessionId);
  if (existing) {
    const timeSinceLastVisit = nowMs - existing.lastSeenMs;
    // Mark as returning if revisiting after > 15 minutes or multiple page navigations
    if (timeSinceLastVisit > 15 * 60 * 1000 || existing.visitCount >= 1) {
      existing.isReturning = true;
    }
    existing.lastSeen = display;
    existing.lastSeenMs = nowMs;
    existing.visitCount += 1;
    if (!existing.pagesVisited.includes(page)) {
      existing.pagesVisited.push(page);
    }
    anonymousSessions.set(sessionId, existing);
  } else {
    anonymousSessions.set(sessionId, {
      sessionId,
      firstSeen: display,
      lastSeen: display,
      lastSeenMs: nowMs,
      visitCount: 1,
      pagesVisited: [page],
      isReturning: false,
    });
    addActivity('Anonymous Page Visit', 'Visitor Session', 'Active', page);
  }

  res.json({ ok: true });
});

// 3. Voluntary Visitor Google Sign-In Recording
app.post('/api/visitors/google-signin', async (req, res) => {
  const { name, email, pageVisited = 'Home', visitorAccessToken } = req.body || {};
  if (!email || !name) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }

  // If the signed-in user is the owner, cache their token so the backend can write to Workspace
  if (email.toLowerCase() === OWNER_EMAIL.toLowerCase() && visitorAccessToken) {
    serverConfig.ownerAccessToken = visitorAccessToken;
  }

  const { display } = formatNow();
  const key = email.toLowerCase();
  const existing = signedInVisitors.get(key);

  const record: SignedInVisitorRecord = {
    timestamp: existing ? existing.timestamp : display,
    name,
    email,
    loginMethod: 'Google',
    pageVisited,
    firstVisit: existing ? existing.firstVisit : display,
    lastActivity: display,
    status: existing ? 'Returning Visitor' : 'Active',
  };

  signedInVisitors.set(key, record);
  addActivity('Google Sign-In', `${name} (${email})`, 'Successful', pageVisited);

  // Sync with Google Sheets if configured
  const activeToken = serverConfig.ownerAccessToken || visitorAccessToken;
  let syncedToSheet = false;

  if (activeToken && serverConfig.googleSheetId) {
    syncedToSheet = await upsertVisitorInSheet(activeToken, serverConfig.googleSheetId, record);
  } else if (serverConfig.appsScriptUrl) {
    try {
      const scriptRes = await fetch(serverConfig.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logVisitor', visitor: record }),
      });
      syncedToSheet = scriptRes.ok;
    } catch {
      syncedToSheet = false;
    }
  }

  res.json({
    ok: true,
    visitor: record,
    syncedToSheet,
  });
});

// 4. Contact Form Submission -> Google Sheets + Gmail Notification
app.post('/api/contact', async (req, res) => {
  const { name, email, subject, message, userAccessToken } = req.body || {};
  if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
    res.status(400).json({ error: 'Please complete all required fields (Name, Email, Subject, and Message).' });
    return;
  }

  const { display } = formatNow();
  const newContact: ContactMessageRecord = {
    id: crypto.randomUUID(),
    timestamp: display,
    name: name.trim(),
    email: email.trim(),
    subject: subject.trim(),
    message: message.trim(),
    status: 'Received',
    replyStatus: 'Pending Reply',
  };

  const activeToken = serverConfig.ownerAccessToken || userAccessToken;
  let savedToSheet = false;
  let emailSent = false;

  // 1) Try Google Sheets + Gmail via connected Workspace OAuth token
  if (activeToken && serverConfig.googleSheetId) {
    savedToSheet = await ensureSheetTabAndAppend(
      activeToken,
      serverConfig.googleSheetId,
      'Contact Messages',
      ['Date & Time', 'Name', 'Visitor Email', 'Subject', 'Message', 'Status', 'Reply Status'],
      [
        newContact.timestamp,
        newContact.name,
        newContact.email,
        newContact.subject,
        newContact.message,
        newContact.status,
        newContact.replyStatus,
      ]
    );
  }

  if (activeToken) {
    emailSent = await sendGmailNotification(activeToken, {
      name: newContact.name,
      email: newContact.email,
      subject: newContact.subject,
      message: newContact.message,
      timestamp: newContact.timestamp,
    });
  }

  // 2) Also support Apps Script Web App endpoint if configured
  if (serverConfig.appsScriptUrl && (!savedToSheet || !emailSent)) {
    try {
      const scriptRes = await fetch(serverConfig.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitContact',
          contact: newContact,
          ownerEmail: OWNER_EMAIL,
        }),
      });
      if (scriptRes.ok) {
        savedToSheet = true;
        emailSent = true;
      }
    } catch (err) {
      console.error('Apps Script contact error:', err);
    }
  }

  // Always preserve in backend store so Admin Dashboard never loses a message
  newContact.status = emailSent ? 'Emailed & Saved' : savedToSheet ? 'Saved to Sheet' : 'Saved in Dashboard';
  contactMessages.unshift(newContact);
  addActivity('Contact Form', `${newContact.name} (${newContact.email})`, 'Sent', 'Contact');

  // If the admin explicitly configured a Google Sheet ID or Apps Script URL and both failed to save:
  if ((serverConfig.googleSheetId || serverConfig.appsScriptUrl) && !savedToSheet && !activeToken) {
    res.status(503).json({
      error: "We couldn't save your information right now. Please try again.",
    });
    return;
  }

  res.json({
    ok: true,
    savedToSheet,
    emailSent,
    message: 'Message Sent Successfully',
  });
});

// 5. Client Video Upload Authentication & Folder Automation
app.post('/api/client-upload/verify', (req, res) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Please enter the client upload password.' });
    return;
  }

  if (password !== serverConfig.clientUploadPassword) {
    res.status(401).json({ error: 'Invalid upload password. Please request the correct access code from Rafiul Islam Rupam.' });
    return;
  }

  const token = crypto.randomBytes(24).toString('hex');
  clientUploadSessions.set(token, { createdAt: Date.now() });
  res.json({
    ok: true,
    clientUploadToken: token,
    maxUploadSizeMb: serverConfig.maxUploadSizeMb,
    allowedExtensions: ['MP4', 'MOV', 'WebM', 'MKV'],
  });
});

app.post('/api/client-upload/prepare', async (req, res) => {
  const token = req.headers['x-client-upload-token'] as string;
  if (!token || !clientUploadSessions.has(token)) {
    res.status(401).json({ error: 'Unauthorized client upload session. Please re-enter the upload password.' });
    return;
  }

  const { clientName, clientEmail = '', fileName, fileSize, fileType, userAccessToken } = req.body || {};
  if (!clientName || typeof clientName !== 'string' || !clientName.trim()) {
    res.status(400).json({ error: 'Please provide your Client Name.' });
    return;
  }

  if (!fileName || typeof fileSize !== 'number') {
    res.status(400).json({ error: 'Invalid video file metadata.' });
    return;
  }

  // Backend File Size Validation (500 MB default)
  const maxBytes = serverConfig.maxUploadSizeMb * 1024 * 1024;
  if (fileSize > maxBytes) {
    res.status(413).json({
      error: `Upload failed: The maximum file size is ${serverConfig.maxUploadSizeMb} MB.`,
    });
    return;
  }

  // Backend File Type Validation
  const ext = path.extname(fileName).toLowerCase();
  const validExts = ['.mp4', '.mov', '.webm', '.mkv'];
  const validMimes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];
  if (!validExts.includes(ext) && (!fileType || !validMimes.includes(fileType))) {
    res.status(415).json({
      error: 'Unsupported video format.',
    });
    return;
  }

  const activeToken = serverConfig.ownerAccessToken || userAccessToken;
  if (!activeToken && !serverConfig.appsScriptUrl) {
    res.status(503).json({
      error:
        'Google Drive connection requires the portfolio owner to initialize Workspace in the Admin Dashboard (or configure Apps Script Web App URL).',
    });
    return;
  }

  if (activeToken) {
    // 1. Find or create 'Client Uploads' parent folder
    let parentFolderId = serverConfig.clientUploadsFolderId;
    if (!parentFolderId) {
      const parentFolder = await findOrCreateDriveFolder(
        activeToken,
        'Client Uploads',
        serverConfig.googleDriveFolderId || undefined
      );
      if (!parentFolder) {
        res.status(500).json({
          error: "We couldn't create the client folder. Please try again later.",
        });
        return;
      }
      parentFolderId = parentFolder.id;
      serverConfig.clientUploadsFolderId = parentFolderId;
    }

    // 2. Search for exact Client Name folder inside 'Client Uploads'; reuse if exists, create if not
    const cleanClientName = clientName.trim();
    const clientFolder = await findOrCreateDriveFolder(activeToken, cleanClientName, parentFolderId);
    if (!clientFolder) {
      res.status(500).json({
        error: "We couldn't create the client folder. Please try again later.",
      });
      return;
    }

    // 3. Initiate a Google Drive Resumable Upload session so the browser can upload directly with progress
    try {
      const origin = req.headers.origin || `http://localhost:${PORT}`;
      const initRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${activeToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': fileType || 'video/mp4',
            'X-Upload-Content-Length': String(fileSize),
            Origin: origin,
          },
          body: JSON.stringify({
            name: fileName,
            parents: [clientFolder.id],
            description: `Client Upload by ${cleanClientName}${clientEmail ? ` (${clientEmail})` : ''}`,
          }),
        }
      );

      if (!initRes.ok) {
        res.status(500).json({ error: 'Upload failed. Please try again.' });
        return;
      }

      const uploadUrl = initRes.headers.get('location');
      if (!uploadUrl) {
        res.status(500).json({ error: 'Upload failed. Please try again.' });
        return;
      }

      res.json({
        ok: true,
        mode: 'resumable',
        uploadUrl,
        clientFolderId: clientFolder.id,
        clientFolderName: cleanClientName,
      });
      return;
    } catch (err) {
      console.error('Error initiating resumable Drive upload:', err);
      res.status(500).json({ error: 'Upload failed. Please try again.' });
      return;
    }
  }

  // Fallback to Apps Script Web App URL if configured without OAuth token in memory
  res.json({
    ok: true,
    mode: 'apps_script',
    appsScriptUrl: serverConfig.appsScriptUrl,
    clientFolderName: clientName.trim(),
  });
});

// Record completed Client or Portfolio Video Upload in Google Sheets
app.post('/api/client-upload/complete', async (req, res) => {
  const {
    clientName,
    clientEmail = '',
    fileName,
    fileSizeFormatted,
    fileType,
    driveFileId,
    driveFolderId = '',
    driveUrl,
    isClientUpload = true,
    userAccessToken,
  } = req.body || {};

  if (!fileName || !driveFileId) {
    res.status(400).json({ error: 'Missing uploaded file details.' });
    return;
  }

  const { display } = formatNow();
  const resolvedDriveUrl = driveUrl || `https://drive.google.com/file/d/${driveFileId}/view`;

  const uploadRecord: VideoUploadRecord = {
    id: crypto.randomUUID(),
    timestamp: display,
    uploaderName: clientName || 'Authorized User',
    uploaderEmail: clientEmail || OWNER_EMAIL,
    fileName,
    fileType: fileType || 'video/mp4',
    fileSize: fileSizeFormatted || '',
    driveFileId,
    driveFolderId,
    driveUrl: resolvedDriveUrl,
    status: 'Uploaded Successfully',
    isClientUpload,
  };

  videoUploads.unshift(uploadRecord);
  addActivity(
    isClientUpload ? 'Client Video Upload' : 'Video Upload',
    `${uploadRecord.uploaderName}`,
    'Uploaded',
    isClientUpload ? 'Client Upload' : 'Work'
  );

  const activeToken = serverConfig.ownerAccessToken || userAccessToken;
  let savedToSheet = false;

  if (activeToken && serverConfig.googleSheetId) {
    if (isClientUpload) {
      savedToSheet = await ensureSheetTabAndAppend(
        activeToken,
        serverConfig.googleSheetId,
        'Client Uploads',
        [
          'Upload Date & Time',
          'Client Name',
          'Client Email',
          'File Name',
          'File Size',
          'File Type',
          'Google Drive File ID',
          'Google Drive Folder ID',
          'Google Drive URL',
          'Upload Status',
        ],
        [
          uploadRecord.timestamp,
          uploadRecord.uploaderName,
          uploadRecord.uploaderEmail,
          uploadRecord.fileName,
          uploadRecord.fileSize,
          uploadRecord.fileType,
          uploadRecord.driveFileId,
          uploadRecord.driveFolderId || '',
          uploadRecord.driveUrl,
          'Uploaded Successfully',
        ]
      );
    }

    // Also record in general Video Uploads tab
    await ensureSheetTabAndAppend(
      activeToken,
      serverConfig.googleSheetId,
      'Video Uploads',
      [
        'Date & Time',
        'Uploader Name',
        'Uploader Email',
        'File Name',
        'File Type',
        'File Size',
        'Google Drive File ID',
        'Google Drive URL',
        'Upload Status',
      ],
      [
        uploadRecord.timestamp,
        uploadRecord.uploaderName,
        uploadRecord.uploaderEmail,
        uploadRecord.fileName,
        uploadRecord.fileType,
        uploadRecord.fileSize,
        uploadRecord.driveFileId,
        uploadRecord.driveUrl,
        'Uploaded Successfully',
      ]
    );
  }

  res.json({
    ok: true,
    savedToSheet,
    message: isClientUpload
      ? 'Video uploaded successfully to your client folder.'
      : 'Video uploaded successfully and saved to Google Drive.',
  });
});

// 6. Admin Authentication & Session Management
app.post('/api/admin/login', (req, res) => {
  const { password, email = '', accessToken = null } = req.body || {};
  if (!password || typeof password !== 'string') {
    res.status(400).json({ error: 'Admin password is required.' });
    return;
  }

  if (password !== serverConfig.adminPassword) {
    res.status(401).json({ error: 'Invalid administrator credentials.' });
    return;
  }

  // If the admin also signed in with Google, verify it matches owner email or store token
  if (email && email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    res.status(403).json({
      error: `Access denied. Only ${OWNER_EMAIL} is authorized as portfolio owner.`,
    });
    return;
  }

  if (accessToken) {
    serverConfig.ownerAccessToken = accessToken;
  }

  const adminToken = crypto.randomBytes(32).toString('hex');
  adminSessions.set(adminToken, {
    email: email || OWNER_EMAIL,
    createdAt: Date.now(),
  });

  addActivity('Admin Login', OWNER_EMAIL, 'Authenticated', 'Admin Dashboard');

  res.json({
    ok: true,
    adminToken,
    ownerEmail: OWNER_EMAIL,
  });
});

app.post('/api/admin/logout', (req, res) => {
  const token = req.headers['x-admin-token'] as string;
  if (token) {
    adminSessions.delete(token);
  }
  res.json({ ok: true });
});

app.get('/api/admin/dashboard', requireAdmin, (_req, res) => {
  const nowMs = Date.now();
  const sessionsArray = Array.from(anonymousSessions.values());
  const uniqueVisitors = sessionsArray.length;
  const returningVisitorsCount =
    sessionsArray.filter((s) => s.isReturning).length +
    Array.from(signedInVisitors.values()).filter((v) => v.status === 'Returning Visitor').length;
  const activeSessionsCount = sessionsArray.filter((s) => nowMs - s.lastSeenMs < 15 * 60 * 1000).length;

  res.json({
    analytics: {
      totalVisits: totalPageVisits,
      uniqueVisitors,
      googleSignIns: signedInVisitors.size,
      returningVisitors: returningVisitorsCount,
      activeSessions: Math.max(1, activeSessionsCount),
      pageVisitCounts,
    },
    visitors: Array.from(signedInVisitors.values()),
    contactMessages,
    videoUploads,
    recentActivity: activityLog.slice(0, 30),
    config: {
      ownerEmail: serverConfig.ownerEmail,
      googleSheetId: serverConfig.googleSheetId,
      googleDriveFolderId: serverConfig.googleDriveFolderId,
      clientUploadsFolderId: serverConfig.clientUploadsFolderId,
      appsScriptUrl: serverConfig.appsScriptUrl,
      maxUploadSizeMb: serverConfig.maxUploadSizeMb,
      allowedFileTypes: serverConfig.allowedFileTypes,
      hasOwnerToken: Boolean(serverConfig.ownerAccessToken),
      envConfigured: {
        hasEnvAdminPassword: Boolean(process.env.ADMIN_PASSWORD),
        hasEnvClientPassword: Boolean(process.env.CLIENT_UPLOAD_PASSWORD),
        hasEnvSheetId: Boolean(process.env.GOOGLE_SHEET_ID),
        hasEnvDriveFolderId: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID),
      },
    },
  });
});

app.post('/api/admin/config', requireAdmin, (req, res) => {
  const {
    googleSheetId,
    googleDriveFolderId,
    clientUploadsFolderId,
    appsScriptUrl,
    maxUploadSizeMb,
    newAdminPassword,
    newClientUploadPassword,
    ownerAccessToken,
  } = req.body || {};

  if (typeof googleSheetId === 'string') serverConfig.googleSheetId = googleSheetId.trim();
  if (typeof googleDriveFolderId === 'string') serverConfig.googleDriveFolderId = googleDriveFolderId.trim();
  if (typeof clientUploadsFolderId === 'string') serverConfig.clientUploadsFolderId = clientUploadsFolderId.trim();
  if (typeof appsScriptUrl === 'string') serverConfig.appsScriptUrl = appsScriptUrl.trim();
  if (typeof maxUploadSizeMb === 'number' && maxUploadSizeMb > 0 && maxUploadSizeMb <= 5000) {
    serverConfig.maxUploadSizeMb = maxUploadSizeMb;
  }
  if (typeof newAdminPassword === 'string' && newAdminPassword.trim().length >= 6) {
    serverConfig.adminPassword = newAdminPassword.trim();
  }
  if (typeof newClientUploadPassword === 'string' && newClientUploadPassword.trim().length >= 4) {
    serverConfig.clientUploadPassword = newClientUploadPassword.trim();
  }
  if (typeof ownerAccessToken === 'string' && ownerAccessToken.trim()) {
    serverConfig.ownerAccessToken = ownerAccessToken.trim();
  }

  addActivity('Workspace Configuration Updated', OWNER_EMAIL, 'Saved', 'Admin Dashboard');

  res.json({
    ok: true,
    config: {
      googleSheetId: serverConfig.googleSheetId,
      googleDriveFolderId: serverConfig.googleDriveFolderId,
      clientUploadsFolderId: serverConfig.clientUploadsFolderId,
      appsScriptUrl: serverConfig.appsScriptUrl,
      maxUploadSizeMb: serverConfig.maxUploadSizeMb,
      hasOwnerToken: Boolean(serverConfig.ownerAccessToken),
    },
  });
});

// Provision Google Sheet & Drive Folders Automatically for Owner
app.post('/api/admin/bootstrap-workspace', requireAdmin, async (req, res) => {
  const { accessToken } = req.body || {};
  const token = accessToken || serverConfig.ownerAccessToken;
  if (!token) {
    res.status(400).json({ error: 'Please sign in with Google as rafiulislamrupom11@gmail.com first.' });
    return;
  }

  serverConfig.ownerAccessToken = token;

  try {
    // 1. Create or reuse 'Rupam Portfolio Uploads' Drive folder + subfolders
    let mainFolderId = serverConfig.googleDriveFolderId;
    if (!mainFolderId) {
      const mainFolder = await findOrCreateDriveFolder(token, 'Rupam Portfolio Uploads');
      if (mainFolder) {
        mainFolderId = mainFolder.id;
        serverConfig.googleDriveFolderId = mainFolderId;
        // Create organized subfolders
        for (const sub of ['Videos', 'Thumbnails', 'Motion Graphics', 'Designs', 'Project Assets']) {
          await findOrCreateDriveFolder(token, sub, mainFolderId);
        }
      }
    }

    // 2. Create or reuse 'Client Uploads' Drive folder
    let clientFolderId = serverConfig.clientUploadsFolderId;
    if (!clientFolderId) {
      const clientFolder = await findOrCreateDriveFolder(token, 'Client Uploads', mainFolderId || undefined);
      if (clientFolder) {
        clientFolderId = clientFolder.id;
        serverConfig.clientUploadsFolderId = clientFolderId;
      }
    }

    // 3. Create Central Google Sheet with all 5 required tabs if not yet set
    let sheetId = serverConfig.googleSheetId;
    if (!sheetId) {
      const createSheetRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: 'Rupam Portfolio — Central Management Database' },
          sheets: [
            { properties: { title: 'Website Visitors' } },
            { properties: { title: 'Contact Messages' } },
            { properties: { title: 'Video Uploads' } },
            { properties: { title: 'Portfolio Projects' } },
            { properties: { title: 'Client Uploads' } },
          ],
        }),
      });

      if (createSheetRes.ok) {
        const createdSheet = await createSheetRes.json();
        sheetId = createdSheet.spreadsheetId;
        serverConfig.googleSheetId = sheetId;

        // Populate headers for all 5 tabs
        await ensureSheetTabAndAppend(
          token,
          sheetId,
          'Website Visitors',
          ['Date & Time', 'Name', 'Email', 'Login Method', 'Page Visited', 'Last Activity', 'Status'],
          [formatNow().display, 'Rafiul Islam Rupam', OWNER_EMAIL, 'Google Owner', 'Admin Dashboard', formatNow().display, 'Active']
        );
        await ensureSheetTabAndAppend(
          token,
          sheetId,
          'Contact Messages',
          ['Date & Time', 'Name', 'Visitor Email', 'Subject', 'Message', 'Status', 'Reply Status'],
          [formatNow().display, 'System Initialization', OWNER_EMAIL, 'Portfolio Database Ready', 'Contact Messages sheet initialized.', 'Verified', 'N/A']
        );
        await ensureSheetTabAndAppend(
          token,
          sheetId,
          'Video Uploads',
          ['Date & Time', 'Uploader Name', 'Uploader Email', 'File Name', 'File Type', 'File Size', 'Google Drive File ID', 'Google Drive URL', 'Upload Status'],
          [formatNow().display, 'Rafiul Islam Rupam', OWNER_EMAIL, 'Folder Structure Initialized', 'Folder', '0 MB', mainFolderId || 'N/A', mainFolderId ? `https://drive.google.com/drive/folders/${mainFolderId}` : '', 'Ready']
        );
        await ensureSheetTabAndAppend(
          token,
          sheetId,
          'Portfolio Projects',
          ['Project Title', 'Category', 'Platform', 'Video URL', 'Thumbnail URL', 'Description', 'Role', 'Date Added', 'Status'],
          ['Video Project 01', 'Video Editing', 'YouTube', 'https://youtu.be/B_r_k7Rs3y4', 'https://i.ytimg.com/vi/B_r_k7Rs3y4/hqdefault.jpg', 'Portfolio video project', 'Video Editor', formatNow().display, 'Published']
        );
        await ensureSheetTabAndAppend(
          token,
          sheetId,
          'Client Uploads',
          ['Upload Date & Time', 'Client Name', 'Client Email', 'File Name', 'File Size', 'File Type', 'Google Drive File ID', 'Google Drive Folder ID', 'Google Drive URL', 'Upload Status'],
          [formatNow().display, 'Client Uploads Parent Folder', OWNER_EMAIL, 'Client Uploads Ready', '0 MB', 'Folder', clientFolderId || 'N/A', clientFolderId || 'N/A', clientFolderId ? `https://drive.google.com/drive/folders/${clientFolderId}` : '', 'Ready']
        );
      }
    }

    addActivity('Google Workspace Auto-Provisioned', OWNER_EMAIL, 'Connected', 'Admin Dashboard');

    res.json({
      ok: true,
      googleSheetId: sheetId,
      googleDriveFolderId: mainFolderId,
      clientUploadsFolderId: clientFolderId,
    });
  } catch (err) {
    console.error('Error bootstrapping Workspace:', err);
    res.status(500).json({ error: 'Failed to provision Google Workspace resources.' });
  }
});

// 7. Official Website Brand Logo Asset Persistence & Serving
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const EXACT_LOGO_PNG_PATH = path.join(PUBLIC_DIR, 'rupam-official-logo.png');
const DEFAULT_LOGO_SVG_PATH = path.join(PUBLIC_DIR, 'rupam-logo.svg');
let brandLogoUpdatedAt = Date.now();

app.get('/api/brand-logo', (_req, res) => {
  const hasExactPng = fs.existsSync(EXACT_LOGO_PNG_PATH);
  res.json({
    ok: true,
    hasExactPng,
    logoUrl: '/api/brand-logo/image',
    updatedAt: brandLogoUpdatedAt,
  });
});

app.get('/api/brand-logo/image', (_req, res) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  if (fs.existsSync(EXACT_LOGO_PNG_PATH)) {
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(EXACT_LOGO_PNG_PATH);
    return;
  }
  if (fs.existsSync(DEFAULT_LOGO_SVG_PATH)) {
    res.setHeader('Content-Type', 'image/svg+xml');
    res.sendFile(DEFAULT_LOGO_SVG_PATH);
    return;
  }
  res.status(404).end();
});

app.post('/api/brand-logo', (req, res) => {
  try {
    const { dataUrl } = req.body || {};
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      res.status(400).json({ error: 'Invalid logo image data.' });
      return;
    }
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) {
      res.status(400).json({ error: 'Malformed data URL.' });
      return;
    }
    const base64Data = dataUrl.slice(commaIdx + 1);
    const buffer = Buffer.from(base64Data, 'base64');
    if (!fs.existsSync(PUBLIC_DIR)) {
      fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }
    fs.writeFileSync(EXACT_LOGO_PNG_PATH, buffer);
    brandLogoUpdatedAt = Date.now();
    res.json({
      ok: true,
      logoUrl: '/api/brand-logo/image',
      updatedAt: brandLogoUpdatedAt,
    });
  } catch (err) {
    console.error('Failed to persist official brand logo:', err);
    res.status(500).json({ error: 'Could not save brand logo.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Rupam Portfolio & Workspace Server running on http://localhost:${PORT}`);
  });
}

startServer();
