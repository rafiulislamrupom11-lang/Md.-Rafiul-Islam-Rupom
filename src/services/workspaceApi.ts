import { PortfolioProject } from '../data/portfolioData';

export interface CalendarEventItem {
  id: string;
  summary: string;
  start: string;
  end: string;
  htmlLink?: string;
}

export interface FormResponseSummary {
  formTitle: string;
  responseCount: number;
  recentResponses: Array<{
    responseId: string;
    createTime: string;
    summaryText: string;
  }>;
}

export interface ChatSpaceItem {
  name: string;
  displayName: string;
  spaceType?: string;
}

// Sync portfolio projects list to the "Portfolio Projects" tab in Google Sheets
export async function syncProjectsToGoogleSheet(
  accessToken: string,
  spreadsheetId: string,
  projects: PortfolioProject[]
): Promise<boolean> {
  if (!accessToken || !spreadsheetId) return false;

  const tabName = 'Portfolio Projects';
  const headers = [
    'Project Title',
    'Category',
    'Platform',
    'Video URL',
    'Thumbnail URL',
    'Description',
    'Role',
    'Date Added',
    'Status',
  ];

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
    }

    // Clear and write fresh table
    const rows = [
      headers,
      ...projects.map((p) => [
        p.title,
        p.category,
        p.platform,
        p.videoUrl,
        p.thumbnailUrl || '',
        p.description || '',
        p.role || '',
        p.dateAdded,
        p.status,
      ]),
    ];

    const putRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(tabName)}!A1:I${rows.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );

    return putRes.ok;
  } catch (err) {
    console.error('Error syncing projects to Google Sheets:', err);
    return false;
  }
}

// Fetch upcoming events from Google Calendar
export async function fetchUpcomingCalendarEvents(accessToken: string): Promise<CalendarEventItem[]> {
  const timeMin = new Date().toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=6&singleEvents=true&orderBy=startTime`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    summary: item.summary || 'Untitled Editing Session',
    start: item.start?.dateTime || item.start?.date || '',
    end: item.end?.dateTime || item.end?.date || '',
    htmlLink: item.htmlLink,
  }));
}

// Create a project milestone or client call on Google Calendar
export async function createCalendarMilestone(
  accessToken: string,
  summary: string,
  dateStr: string,
  description: string
): Promise<CalendarEventItem | null> {
  const startDate = new Date(dateStr);
  const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      description,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
    }),
  });
  if (!res.ok) return null;
  const item = await res.json();
  return {
    id: item.id,
    summary: item.summary,
    start: item.start?.dateTime || '',
    end: item.end?.dateTime || '',
    htmlLink: item.htmlLink,
  };
}

// Fetch Google Form metadata & responses (for Client Intake Forms)
export async function fetchGoogleFormSummary(
  accessToken: string,
  formId: string
): Promise<FormResponseSummary | null> {
  const cleanId = formId.trim();
  if (!cleanId) return null;

  const [formRes, respRes] = await Promise.all([
    fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(cleanId)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
    fetch(`https://forms.googleapis.com/v1/forms/${encodeURIComponent(cleanId)}/responses`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  ]);

  if (!formRes.ok) return null;
  const formData = await formRes.json();
  const respData = respRes.ok ? await respRes.json() : { responses: [] };
  const responses: any[] = respData.responses || [];

  return {
    formTitle: formData.info?.title || 'Client Intake Form',
    responseCount: responses.length,
    recentResponses: responses.slice(0, 5).map((r: any) => {
      const answersObj = r.answers || {};
      const values = Object.values(answersObj)
        .map((ans: any) => ans?.textAnswers?.answers?.[0]?.value)
        .filter(Boolean)
        .slice(0, 3)
        .join(' · ');
      return {
        responseId: r.responseId,
        createTime: r.createTime ? new Date(r.createTime).toLocaleDateString() : '',
        summaryText: values || 'Form submission received',
      };
    }),
  };
}

// Fetch Google Chat spaces & post project update
export async function fetchChatSpaces(accessToken: string): Promise<ChatSpaceItem[]> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces?pageSize=10', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.spaces || []).map((s: any) => ({
    name: s.name,
    displayName: s.displayName || s.name,
    spaceType: s.spaceType,
  }));
}

export async function postChatMessage(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<boolean> {
  const res = await fetch(`https://chat.googleapis.com/v1/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  return res.ok;
}
