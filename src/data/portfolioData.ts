export type ProjectCategory =
  | 'Video Editing'
  | 'Motion Graphics'
  | 'Social Media Content'
  | 'Thumbnails & Graphic Design'
  | 'Commercial / Promotional';

export type VideoPlatform =
  | 'YouTube'
  | 'YouTube Shorts'
  | 'Facebook'
  | 'Instagram'
  | 'TikTok'
  | 'External';

export interface PortfolioProject {
  id: string;
  title: string;
  videoUrl: string;
  category: ProjectCategory;
  platform: VideoPlatform;
  isShort?: boolean;
  youtubeId?: string;
  thumbnailUrl: string;
  fallbackThumbnailUrl?: string;
  channelName?: string;
  clientName?: string;
  role?: string;
  description?: string;
  tools?: string[];
  dateAdded: string;
  status: 'Published' | 'Draft';
}

export interface SocialProfile {
  id: string;
  platform: string;
  handle: string;
  url: string;
  description: string;
}

export interface ServiceItem {
  id: string;
  index: string;
  title: string;
  description: string;
  deliverables: string;
}

export interface SoftwareSkill {
  id: string;
  name: string;
  shortCode: string;
  discipline: string;
  accentColor: string;
}

// Helper: Parse any video URL to detect platform, YouTube ID, and whether it is a YouTube Short
export function parseVideoUrl(rawUrl: string): {
  platform: VideoPlatform;
  youtubeId?: string;
  isShort: boolean;
  thumbnailUrl: string;
  fallbackThumbnailUrl: string;
  embedUrl?: string;
} {
  const url = (rawUrl || '').trim();

  // Check YouTube Shorts
  const shortsMatch = url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i);
  if (shortsMatch) {
    const ytId = shortsMatch[1];
    return {
      platform: 'YouTube Shorts',
      youtubeId: ytId,
      isShort: true,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      fallbackThumbnailUrl: `https://i.ytimg.com/vi/${ytId}/mqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`,
    };
  }

  // Check standard YouTube or youtu.be
  const ytMatch =
    url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/i) ||
    url.match(/[?&]v=([a-zA-Z0-9_-]{6,})/i) ||
    url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i);

  if (ytMatch) {
    const ytId = ytMatch[1];
    return {
      platform: 'YouTube',
      youtubeId: ytId,
      isShort: false,
      thumbnailUrl: `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
      fallbackThumbnailUrl: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0`,
    };
  }

  if (/facebook\.com|fb\.watch/i.test(url)) {
    return {
      platform: 'Facebook',
      isShort: false,
      thumbnailUrl: '',
      fallbackThumbnailUrl: '',
    };
  }

  if (/instagram\.com/i.test(url)) {
    return {
      platform: 'Instagram',
      isShort: /\/reel\//i.test(url),
      thumbnailUrl: '',
      fallbackThumbnailUrl: '',
    };
  }

  if (/tiktok\.com/i.test(url)) {
    return {
      platform: 'TikTok',
      isShort: true,
      thumbnailUrl: '',
      fallbackThumbnailUrl: '',
    };
  }

  return {
    platform: 'External',
    isShort: false,
    thumbnailUrl: '',
    fallbackThumbnailUrl: '',
  };
}

// Helper to create a structured PortfolioProject from minimal submission fields
export function buildProjectFromInput(input: {
  id?: string;
  title: string;
  videoUrl: string;
  category?: ProjectCategory;
  platform?: VideoPlatform;
  role?: string;
  description?: string;
  channelName?: string;
  clientName?: string;
  customThumbnailUrl?: string;
  tools?: string[];
}): PortfolioProject {
  const parsed = parseVideoUrl(input.videoUrl);
  return {
    id: input.id || `proj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: input.title.trim() || 'Video Project',
    videoUrl: input.videoUrl.trim(),
    category: input.category || 'Video Editing',
    platform: input.platform || parsed.platform,
    isShort: parsed.isShort,
    youtubeId: parsed.youtubeId,
    thumbnailUrl: input.customThumbnailUrl?.trim() || parsed.thumbnailUrl,
    fallbackThumbnailUrl: parsed.fallbackThumbnailUrl,
    channelName: input.channelName?.trim() || undefined,
    clientName: input.clientName?.trim() || undefined,
    role: input.role?.trim() || undefined,
    description: input.description?.trim() || undefined,
    tools: input.tools,
    dateAdded: new Date().toISOString().split('T')[0],
    status: 'Published',
  };
}

// Initial 6 YouTube / YouTube Shorts projects provided by Rafiul Islam Rupam
export const INITIAL_PROJECTS: PortfolioProject[] = [
  buildProjectFromInput({
    id: 'video-project-01',
    title: 'Video Project 01',
    videoUrl: 'https://youtu.be/B_r_k7Rs3y4',
    category: 'Video Editing',
  }),
  buildProjectFromInput({
    id: 'video-project-02',
    title: 'Video Project 02',
    videoUrl: 'https://youtu.be/PQZISUyZ8zM',
    category: 'Video Editing',
  }),
  buildProjectFromInput({
    id: 'video-project-03',
    title: 'Video Project 03',
    videoUrl: 'https://youtu.be/cku0zh08RRI',
    category: 'Video Editing',
  }),
  buildProjectFromInput({
    id: 'video-project-04',
    title: 'Video Project 04',
    videoUrl: 'https://youtu.be/le4g_5PfNMs',
    category: 'Video Editing',
  }),
  buildProjectFromInput({
    id: 'video-project-05',
    title: 'Video Project 05',
    videoUrl: 'https://youtube.com/shorts/oQHhGGy_Ebs',
    category: 'Video Editing',
  }),
  buildProjectFromInput({
    id: 'video-project-06',
    title: 'Video Project 06',
    videoUrl: 'https://youtube.com/shorts/ZnbwlRGsGx8',
    category: 'Video Editing',
  }),
];

export const SOCIAL_PROFILES: SocialProfile[] = [
  {
    id: 'youtube',
    platform: 'YouTube',
    handle: '@RafiuzzamanGlitchX',
    url: 'https://www.youtube.com/@RafiuzzamanGlitchX',
    description: 'Edited videos, visual storytelling, and motion graphics showcase.',
  },
  {
    id: 'instagram',
    platform: 'Instagram',
    handle: '@md.rafiulrupam',
    url: 'https://www.instagram.com/md.rafiulrupam/',
    description: 'Reels, short-form edits, motion studies, and visual updates.',
  },
  {
    id: 'tiktok',
    platform: 'TikTok',
    handle: '@itsmerupamhere',
    url: 'https://www.tiktok.com/@itsmerupamhere',
    description: 'Vertical edits, pacing experiments, and short-form motion.',
  },
  {
    id: 'facebook',
    platform: 'Facebook',
    handle: 'Rafiul Islam Rupam',
    url: 'https://www.facebook.com/profile.php?id=61574862845580',
    description: 'Social media video production, creative updates, and community connection.',
  },
  {
    id: 'x',
    platform: 'X',
    handle: '@rafiul_rup34054',
    url: 'https://x.com/rafiul_rup34054',
    description: 'Direct updates, creative work-in-progress, and industry conversations.',
  },
  {
    id: 'linkedin',
    platform: 'LinkedIn',
    handle: 'Md. Rafiul Islam Rupom',
    url: 'https://www.linkedin.com/in/md-rafiul-islam-rupom-763594394/',
    description: 'Professional network, video post-production, and motion design inquiries.',
  },
  {
    id: 'google-site',
    platform: 'Portfolio Archive',
    handle: 'sites.google.com/view/rafiul-rupam',
    url: 'https://sites.google.com/view/rafiul-rupam/home',
    description: 'Extended archive of creative projects and Google Sites portfolio.',
  },
];

export const SERVICES_LIST: ServiceItem[] = [
  {
    id: 'video-editing',
    index: '01',
    title: 'Video Editing',
    description:
      'Narrative assembly, precise pacing, audio synchronization, and seamless transitions that turn raw footage into cohesive visual stories.',
    deliverables: 'Full Timeline Assembly · Sound Design · Multi-Cam Sync',
  },
  {
    id: 'motion-graphics',
    index: '02',
    title: 'Motion Graphics',
    description:
      'Custom 2D motion design, kinetic typography, lower thirds, callouts, and visual explanations built for clarity and visual retention.',
    deliverables: 'Kinetic Typography · Custom Overlays · Visual Effects',
  },
  {
    id: 'youtube-editing',
    index: '03',
    title: 'YouTube Video Editing',
    description:
      'Long-form and mid-form YouTube post-production structured for audience engagement, clean visual rhythm, and strong narrative hooks.',
    deliverables: 'Long-Form Pacing · B-Roll Integration · Retention Structuring',
  },
  {
    id: 'social-media-video',
    index: '04',
    title: 'Social Media Video Editing',
    description:
      'Vertical and square format video editing tailored for YouTube Shorts, Instagram Reels, TikTok, and Facebook with dynamic captions.',
    deliverables: '9:16 Vertical Framing · Dynamic Captions · Hook Optimization',
  },
  {
    id: 'color-grading',
    index: '05',
    title: 'Color Grading',
    description:
      'Shot matching, skin-tone balancing, contrast sculpting, and cinematic look development to establish a consistent visual atmosphere.',
    deliverables: 'Color Correction · Shot Matching · Look Development',
  },
  {
    id: 'thumbnail-design',
    index: '06',
    title: 'Thumbnail Design',
    description:
      'High-contrast, clear, compositionally balanced video thumbnails designed to communicate the core story at a glance.',
    deliverables: 'YouTube Thumbnails · Subject Isolation · Typographic Hierarchy',
  },
  {
    id: 'promotional-video',
    index: '07',
    title: 'Promotional Video',
    description:
      'Commercial cuts, product showcases, and brand introductions crafted to present offerings with clarity and polish.',
    deliverables: 'Brand Spots · Product Promos · Social Ad Cuts',
  },
  {
    id: 'logo-animation',
    index: '08',
    title: 'Logo Animation',
    description:
      'Refined animated brand marks, intros, and outros that give static identities smooth, memorable motion.',
    deliverables: 'Animated Intros · Brand Stingers · Transparent Overlays',
  },
  {
    id: 'graphic-design',
    index: '09',
    title: 'Graphic Design',
    description:
      'Digital posters, channel branding assets, social media graphics, and promotional layouts supporting video and content releases.',
    deliverables: 'Social Graphics · Channel Art · Promotional Layouts',
  },
];

export const SOFTWARE_SKILLS: SoftwareSkill[] = [
  {
    id: 'premiere-pro',
    name: 'Adobe Premiere Pro',
    shortCode: 'Pr',
    discipline: 'Non-Linear Video Editing & Timeline Assembly',
    accentColor: '#9999FF',
  },
  {
    id: 'after-effects',
    name: 'Adobe After Effects',
    shortCode: 'Ae',
    discipline: 'Motion Graphics, Compositing & Visual Effects',
    accentColor: '#00D2FF',
  },
  {
    id: 'photoshop',
    name: 'Adobe Photoshop',
    shortCode: 'Ps',
    discipline: 'Thumbnail Design, Retouching & Digital Imaging',
    accentColor: '#31A8FF',
  },
  {
    id: 'illustrator',
    name: 'Adobe Illustrator',
    shortCode: 'Ai',
    discipline: 'Vector Assets, Typography & Brand Marks',
    accentColor: '#FF9A00',
  },
  {
    id: 'davinci-resolve',
    name: 'DaVinci Resolve',
    shortCode: 'Dv',
    discipline: 'Color Grading, Node Workflows & Finishing',
    accentColor: '#BB9AFF',
  },
];

export const APPS_SCRIPT_TEMPLATE = `/**
 * RUPAM PORTFOLIO — GOOGLE APPS SCRIPT WEB APP BACKEND
 * Owner Account: rafiulislamrupom11@gmail.com
 * Connects Google Sheets (5 Tabs), Google Drive (Client Uploads & Portfolio Uploads), and Gmail.
 */

const CONFIG = {
  OWNER_EMAIL: 'rafiulislamrupom11@gmail.com',
  SPREADSHEET_ID: 'PASTE_YOUR_GOOGLE_SHEET_ID_HERE',
  PORTFOLIO_FOLDER_ID: 'PASTE_YOUR_PORTFOLIO_DRIVE_FOLDER_ID_HERE',
  CLIENT_UPLOADS_FOLDER_NAME: 'Client Uploads'
};

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === 'logVisitor') {
      return jsonResponse(logVisitorToSheet(payload.visitor));
    }
    if (action === 'submitContact') {
      return jsonResponse(handleContactSubmission(payload.contact));
    }
    if (action === 'uploadClientVideo') {
      return jsonResponse(handleClientVideoUpload(payload));
    }

    return jsonResponse({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
  }
  return sheet;
}

function logVisitorToSheet(v) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, 'Website Visitors', [
    'Date & Time', 'Name', 'Email', 'Login Method', 'Page Visited', 'Last Activity', 'Status'
  ]);
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][2]).toLowerCase() === String(v.email).toLowerCase()) {
      sheet.getRange(i + 1, 5, 1, 3).setValues([[v.pageVisited, v.lastActivity, 'Returning Visitor']]);
      return { ok: true, updated: true };
    }
  }
  sheet.appendRow([v.timestamp, v.name, v.email, 'Google', v.pageVisited, v.lastActivity, v.status]);
  return { ok: true, created: true };
}

function handleContactSubmission(c) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, 'Contact Messages', [
    'Date & Time', 'Name', 'Visitor Email', 'Subject', 'Message', 'Status', 'Reply Status'
  ]);
  sheet.appendRow([c.timestamp, c.name, c.email, c.subject, c.message, 'Received', 'Pending Reply']);

  MailApp.sendEmail({
    to: CONFIG.OWNER_EMAIL,
    replyTo: c.email,
    subject: 'New Portfolio Contact: ' + c.subject,
    body: [
      'New Portfolio Contact',
      '',
      'Visitor Name:', c.name,
      '',
      'Visitor Email:', c.email,
      '',
      'Subject:', c.subject,
      '',
      'Message:', c.message,
      '',
      'Date & Time:', c.timestamp
    ].join('\\n')
  });

  return { ok: true };
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}`;
