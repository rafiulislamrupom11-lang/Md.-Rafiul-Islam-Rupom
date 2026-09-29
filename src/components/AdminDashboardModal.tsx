import React, { useState, useEffect } from 'react';
import {
  X,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Edit3,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Upload,
  Calendar,
  MessageSquare,
  FileSpreadsheet,
  FolderKanban,
  Copy,
  Check,
  Shield,
} from 'lucide-react';
import {
   PortfolioProject,
  ProjectCategory,
  VideoPlatform,
  buildProjectFromInput,
  APPS_SCRIPT_TEMPLATE,
} from '../data/portfolioData';
import { BrandLogo, useBrandLogo } from './BrandLogo';
import { googleSignIn, OWNER_EMAIL } from '../services/workspaceAuth';
import {
  syncProjectsToGoogleSheet,
  fetchUpcomingCalendarEvents,
  createCalendarMilestone,
  fetchGoogleFormSummary,
  fetchChatSpaces,
  postChatMessage,
  CalendarEventItem,
  FormResponseSummary,
  ChatSpaceItem,
} from '../services/workspaceApi';

interface AdminDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: PortfolioProject[];
  onUpdateProjects: (projects: PortfolioProject[]) => void;
  profileImage: string | null;
  onUpdateProfileImage: (dataUrl: string | null) => void;
  ownerAccessToken: string | null;
  onSetOwnerAccessToken: (token: string) => void;
  currentUserEmail: string | null;
}

type AdminTab =
  | 'overview'
  | 'visitors'
  | 'contacts'
  | 'uploads'
  | 'portfolio'
  | 'workspace';

export const AdminDashboardModal: React.FC<AdminDashboardModalProps> = ({
  isOpen,
  onClose,
  projects,
  onUpdateProjects,
  profileImage,
  onUpdateProfileImage,
  ownerAccessToken,
  onSetOwnerAccessToken,
  currentUserEmail,
}) => {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const { uploadExactLogoFile, isUploadingLogo } = useBrandLogo();
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Confirmation modal state for destructive/mutating operations (Mandatory per Workspace Skill)
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    onConfirm: () => Promise<void> | void;
  } | null>(null);

  // Portfolio Add/Edit Form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projTitle, setProjTitle] = useState('');
  const [projUrl, setProjUrl] = useState('');
  const [projCategory, setProjCategory] = useState<ProjectCategory>('Video Editing');
  const [projPlatform, setProjPlatform] = useState<VideoPlatform | 'Auto'>('Auto');
  const [projRole, setProjRole] = useState('');
  const [projChannel, setProjChannel] = useState('');
  const [projClient, setProjClient] = useState('');
  const [projDesc, setProjDesc] = useState('');
  const [projThumb, setProjThumb] = useState('');

  // Admin Video Upload -> Google Drive ("Rupam Portfolio Uploads")
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadCat, setUploadCat] = useState<ProjectCategory>('Video Editing');
  const [uploadProjName, setUploadProjName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploadingAdminVideo, setIsUploadingAdminVideo] = useState(false);
  const [adminUploadStatus, setAdminUploadStatus] = useState<string | null>(null);

  // Workspace Settings & Suite state
  const [sheetIdInput, setSheetIdInput] = useState('');
  const [driveFolderIdInput, setDriveFolderIdInput] = useState('');
  const [clientFolderIdInput, setClientFolderIdInput] = useState('');
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState('');
  const [maxSizeInput, setMaxSizeInput] = useState(500);
  const [newAdminPass, setNewAdminPass] = useState('');
  const [newClientPass, setNewClientPass] = useState('');
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Calendar, Forms, Chat state
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [formIdInput, setFormIdInput] = useState('');
  const [formSummary, setFormSummary] = useState<FormResponseSummary | null>(null);
  const [chatSpaces, setChatSpaces] = useState<ChatSpaceItem[]>([]);
  const [selectedSpace, setSelectedSpace] = useState('');
  const [chatMessageInput, setChatMessageInput] = useState('');

  const fetchDashboard = async (tokenToUse?: string) => {
    const t = tokenToUse || adminToken;
    if (!t) return;
    setIsLoadingData(true);
    try {
      const res = await fetch('/api/admin/dashboard', {
        headers: { 'x-admin-token': t },
      });
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
        if (data.config) {
          setSheetIdInput(data.config.googleSheetId || '');
          setDriveFolderIdInput(data.config.googleDriveFolderId || '');
          setClientFolderIdInput(data.config.clientUploadsFolderId || '');
          setAppsScriptUrlInput(data.config.appsScriptUrl || '');
          setMaxSizeInput(data.config.maxUploadSizeMb || 500);
        }
      } else if (res.status === 401) {
        setAdminToken(null);
      }
    } catch {
      // ignore transient error
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isOpen && adminToken) {
      fetchDashboard(adminToken);
    }
  }, [isOpen, adminToken]);

  if (!isOpen) return null;

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!passwordInput.trim()) {
      setLoginError('Please enter your server-side administrator password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: passwordInput,
          email: currentUserEmail || '',
          accessToken: ownerAccessToken,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setLoginError(data.error || 'Invalid administrator credentials.');
        return;
      }

      setAdminToken(data.adminToken);
      setPasswordInput('');
      await fetchDashboard(data.adminToken);
    } catch {
      setLoginError('Authentication service unreachable. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = async () => {
    if (adminToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
      });
    }
    setAdminToken(null);
    setDashboardData(null);
    onClose();
  };

  const handleConnectOwnerWorkspace = async () => {
    setStatusBanner(null);
    try {
      const result = await googleSignIn();
      if (!result) return;
      onSetOwnerAccessToken(result.accessToken);

      if (adminToken) {
        await fetch('/api/admin/config', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-token': adminToken,
          },
          body: JSON.stringify({ ownerAccessToken: result.accessToken }),
        });
        await fetchDashboard(adminToken);
      }

      // Load Calendar & Chat spaces
      const [events, spaces] = await Promise.all([
        fetchUpcomingCalendarEvents(result.accessToken),
        fetchChatSpaces(result.accessToken),
      ]);
      setCalendarEvents(events);
      setChatSpaces(spaces);
      if (spaces.length > 0) setSelectedSpace(spaces[0].name);

      setStatusBanner({
        type: 'success',
        text: `Connected Google Workspace for ${result.user.email}. Sheets, Drive, Gmail, Calendar, Forms, and Chat are ready.`,
      });
    } catch (err: any) {
      setStatusBanner({
        type: 'error',
        text: err?.message || 'Google Workspace authorization was cancelled.',
      });
    }
  };

  const handleBootstrapWorkspace = async () => {
    if (!adminToken) return;
    setIsBootstrapping(true);
    setStatusBanner(null);
    try {
      let token = ownerAccessToken;
      if (!token) {
        const signInResult = await googleSignIn();
        if (signInResult) {
          token = signInResult.accessToken;
          onSetOwnerAccessToken(token);
        }
      }
      if (!token) {
        setStatusBanner({
          type: 'error',
          text: 'Please authorize with Google Workspace first.',
        });
        setIsBootstrapping(false);
        return;
      }

      const res = await fetch('/api/admin/bootstrap-workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': adminToken,
        },
        body: JSON.stringify({ accessToken: token }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setStatusBanner({
          type: 'error',
          text: data.error || 'Could not provision Google Sheet and Drive folders.',
        });
        return;
      }

      // Also sync current portfolio projects to Tab 4
      if (data.googleSheetId) {
        await syncProjectsToGoogleSheet(token, data.googleSheetId, projects);
      }

      await fetchDashboard(adminToken);
      setStatusBanner({
        type: 'success',
        text: 'Provisioned Central Google Sheet (5 Tabs) and Google Drive folders (Rupam Portfolio Uploads & Client Uploads).',
      });
    } catch {
      setStatusBanner({
        type: 'error',
        text: 'Failed to provision Google Workspace resources.',
      });
    } finally {
      setIsBootstrapping(false);
    }
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projUrl.trim()) return;

    const built = buildProjectFromInput({
      id: editingId || undefined,
      title: projTitle || `Video Project 0${projects.length + 1}`,
      videoUrl: projUrl,
      category: projCategory,
      platform: projPlatform === 'Auto' ? undefined : projPlatform,
      role: projRole,
      channelName: projChannel,
      clientName: projClient,
      description: projDesc,
      customThumbnailUrl: projThumb,
    });

    // Fetch YouTube oEmbed title/channel if title was left default and it's a YouTube URL
    if (!projTitle.trim() && built.youtubeId) {
      try {
        const res = await fetch(`/api/youtube/oembed?url=${encodeURIComponent(projUrl)}`);
        if (res.ok) {
          const meta = await res.json();
          if (meta.title) built.title = meta.title;
          if (meta.author_name && !built.channelName) built.channelName = meta.author_name;
        }
      } catch {
        // keep clean fallback
      }
    }

    const updatedList = editingId
      ? projects.map((p) => (p.id === editingId ? built : p))
      : [built, ...projects];

    if (editingId && ownerAccessToken && sheetIdInput) {
      // Mandatory confirmation before overwriting existing project data in Google Sheets
      setConfirmAction({
        title: `Update "${built.title}" in Portfolio & Google Sheets?`,
        description: `This will update the project details for "${built.title}" in your live portfolio and overwrite its row in the "Portfolio Projects" Google Sheet tab.`,
        confirmLabel: 'Confirm Update',
        onConfirm: async () => {
          onUpdateProjects(updatedList);
          await syncProjectsToGoogleSheet(ownerAccessToken, sheetIdInput, updatedList);
          resetProjectForm();
          setConfirmAction(null);
          setStatusBanner({ type: 'success', text: `Updated "${built.title}".` });
        },
      });
      return;
    }

    onUpdateProjects(updatedList);
    if (ownerAccessToken && sheetIdInput) {
      await syncProjectsToGoogleSheet(ownerAccessToken, sheetIdInput, updatedList);
    }
    resetProjectForm();
    setStatusBanner({
      type: 'success',
      text: `Added "${built.title}" to My Work / Video Showcase.`,
    });
  };

  const handleDeleteProject = (proj: PortfolioProject) => {
    setConfirmAction({
      title: `Delete "${proj.title}" from Portfolio?`,
      description: `Are you sure you want to remove "${proj.title}" from your portfolio and update the "Portfolio Projects" Google Sheet tab? This action cannot be undone.`,
      confirmLabel: 'Delete Project',
      onConfirm: async () => {
        const updatedList = projects.filter((p) => p.id !== proj.id);
        onUpdateProjects(updatedList);
        if (ownerAccessToken && sheetIdInput) {
          await syncProjectsToGoogleSheet(ownerAccessToken, sheetIdInput, updatedList);
        }
        setConfirmAction(null);
        setStatusBanner({ type: 'success', text: `Removed "${proj.title}".` });
      },
    });
  };

  const startEditingProject = (proj: PortfolioProject) => {
    setEditingId(proj.id);
    setProjTitle(proj.title);
    setProjUrl(proj.videoUrl);
    setProjCategory(proj.category);
    setProjPlatform(proj.platform);
    setProjRole(proj.role || '');
    setProjChannel(proj.channelName || '');
    setProjClient(proj.clientName || '');
    setProjDesc(proj.description || '');
    setProjThumb(proj.thumbnailUrl || '');
  };

  const resetProjectForm = () => {
    setEditingId(null);
    setProjTitle('');
    setProjUrl('');
    setProjCategory('Video Editing');
    setProjPlatform('Auto');
    setProjRole('');
    setProjChannel('');
    setProjClient('');
    setProjDesc('');
    setProjThumb('');
  };

  // Handle Owner Portfolio Video Upload -> Google Drive ("Rupam Portfolio Uploads")
  const handleAdminVideoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminUploadStatus(null);
    if (!uploadFile || !uploadTitle.trim()) return;

    const maxBytes = maxSizeInput * 1024 * 1024;
    if (uploadFile.size > maxBytes) {
      setAdminUploadStatus(`Upload failed: The maximum file size is ${maxSizeInput} MB.`);
      return;
    }

    let token = ownerAccessToken;
    if (!token) {
      try {
        const res = await googleSignIn();
        if (res) {
          token = res.accessToken;
          onSetOwnerAccessToken(token);
        }
      } catch {
        setAdminUploadStatus('Upload failed. Please sign in with Google Workspace first.');
        return;
      }
    }

    if (!token) {
      setAdminUploadStatus('Upload failed. Please sign in with Google Workspace first.');
      return;
    }

    setIsUploadingAdminVideo(true);
    try {
      const metadata: any = {
        name: uploadFile.name,
        description: `${uploadTitle.trim()} — ${uploadDesc.trim()} (${uploadCat})`,
      };
      if (driveFolderIdInput) {
        metadata.parents = [driveFolderIdInput];
      }

      const initRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,webViewLink',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Upload-Content-Type': uploadFile.type || 'video/mp4',
            'X-Upload-Content-Length': String(uploadFile.size),
          },
          body: JSON.stringify(metadata),
        }
      );

      if (!initRes.ok) {
        setAdminUploadStatus('Upload failed. Please check the file and try again.');
        setIsUploadingAdminVideo(false);
        return;
      }

      const uploadUrl = initRes.headers.get('location');
      if (!uploadUrl) {
        setAdminUploadStatus('Upload failed. Please check the file and try again.');
        setIsUploadingAdminVideo(false);
        return;
      }

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': uploadFile.type || 'video/mp4' },
        body: uploadFile,
      });

      if (!uploadRes.ok) {
        setAdminUploadStatus('Upload failed. Please check the file and try again.');
        setIsUploadingAdminVideo(false);
        return;
      }

      const uploadedData = await uploadRes.json();
      const sizeMb = `${(uploadFile.size / (1024 * 1024)).toFixed(1)} MB`;

      await fetch('/api/client-upload/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: uploadProjName.trim() || 'Rafiul Islam Rupam',
          clientEmail: OWNER_EMAIL,
          fileName: uploadFile.name,
          fileSizeFormatted: sizeMb,
          fileType: uploadFile.type || 'video/mp4',
          driveFileId: uploadedData.id,
          driveFolderId: driveFolderIdInput,
          driveUrl:
            uploadedData.webViewLink || `https://drive.google.com/file/d/${uploadedData.id}/view`,
          isClientUpload: false,
          userAccessToken: token,
        }),
      });

      setAdminUploadStatus('Video uploaded successfully and saved to Google Drive.');
      setUploadTitle('');
      setUploadDesc('');
      setUploadProjName('');
      setUploadFile(null);
      await fetchDashboard();
    } catch {
      setAdminUploadStatus('Upload failed. Please check the file and try again.');
    } finally {
      setIsUploadingAdminVideo(false);
    }
  };

  const handleSaveWorkspaceConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken) return;
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: JSON.stringify({
        googleSheetId: sheetIdInput,
        googleDriveFolderId: driveFolderIdInput,
        clientUploadsFolderId: clientFolderIdInput,
        appsScriptUrl: appsScriptUrlInput,
        maxUploadSizeMb: Number(maxSizeInput) || 500,
        newAdminPassword: newAdminPass || undefined,
        newClientUploadPassword: newClientPass || undefined,
        ownerAccessToken,
      }),
    });
    if (res.ok) {
      setNewAdminPass('');
      setNewClientPass('');
      await fetchDashboard(adminToken);
      setStatusBanner({
        type: 'success',
        text: 'Saved Workspace & security settings on the server.',
      });
    }
  };

  const handleProfilePhotoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateProfileImage(reader.result);
        setStatusBanner({
          type: 'success',
          text: 'Updated Hero Profile Portrait while preserving original appearance.',
        });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-[#080A18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden my-8">
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08] bg-[#03030F]">
          <div className="flex items-center gap-3">
            <BrandLogo size="sm" />
            <h2 className="text-lg font-bold text-white">
              {adminToken ? 'Rupam Portfolio — Admin Dashboard' : 'Administrator Authentication'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {adminToken && (
              <button
                type="button"
                onClick={handleAdminLogout}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium hover:bg-rose-500/25 transition-colors whitespace-nowrap cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Close Admin Modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Destructive Operation Confirmation Dialog */}
        {confirmAction && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-4">
            <div className="max-w-md w-full bg-[#0B0D1E] border border-white/15 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <BrandLogo size="sm" />
                <h3 className="text-base font-bold text-white">{confirmAction.title}</h3>
              </div>
              <p className="text-xs text-[#CBD5E1] leading-relaxed">{confirmAction.description}</p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmAction(null)}
                  className="px-4 py-2 rounded-lg border border-white/10 text-xs font-medium text-[#CBD5E1] hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmAction.onConfirm()}
                  className="px-4 py-2 rounded-lg bg-rose-500 text-white text-xs font-semibold hover:bg-rose-600 cursor-pointer"
                >
                  {confirmAction.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Body Content */}
        {!adminToken ? (
          <div className="p-8 max-w-md mx-auto space-y-6">
            <div className="space-y-3 text-center">
              <div className="flex justify-center">
                <BrandLogo size="xl" />
              </div>
              <h3 className="text-xl font-bold text-white">Protected Owner Access</h3>
              <p className="text-xs text-[#94A3B8] leading-relaxed">
                This area is strictly separate from public visitor Google Sign-In. Enter your
                server-side administrator password to manage portfolio projects, visitor analytics,
                and Google Workspace integrations.
              </p>
            </div>

            {loginError && (
              <div className="flex items-start gap-2 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-password-input"
                  className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                >
                  Admin Password
                </label>
                <input
                  id="admin-password-input"
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter server-side ADMIN_PASSWORD"
                  className="w-full px-4 py-3 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF]"
                  autoComplete="current-password"
                />
                <p className="text-[11px] text-[#64748B] mt-2">
                  Configured via server environment variable <code className="font-mono">ADMIN_PASSWORD</code>{' '}
                  (Development default if unset in Secrets: <code className="font-mono text-[#94A3B8]">RupamAdmin2026!</code>; Client upload default: <code className="font-mono text-[#94A3B8]">RupamClient2026!</code>).
                </p>
              </div>

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-3 rounded-xl bg-[#00D2FF] text-[#03030F] font-semibold text-sm hover:bg-[#33DBFF] transition-colors cursor-pointer"
              >
                {isLoggingIn ? 'Verifying Session...' : 'Sign In to Admin Dashboard'}
              </button>
            </form>
          </div>
        ) : (
          <div className="p-6 space-y-6 max-h-[82vh] overflow-y-auto">
            {/* Status Banner */}
            {statusBanner && (
              <div
                className={`flex items-center justify-between p-4 rounded-xl border text-xs ${
                  statusBanner.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {statusBanner.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span>{statusBanner.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusBanner(null)}
                  className="text-white/60 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Top Workspace Connection Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#03030F] border border-white/[0.08]">
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-white">
                  Owner Google Workspace Integration ({OWNER_EMAIL})
                </div>
                <p className="text-xs text-[#94A3B8]">
                  {ownerAccessToken || dashboardData?.config?.hasOwnerToken
                    ? 'Connected · Sheets, Drive, Gmail, Calendar, Forms & Chat authorized'
                    : 'Connect your Google account to enable live Sheets logging, Drive folder automation & Gmail notifications.'}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleConnectOwnerWorkspace}
                  className="px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                >
                  {ownerAccessToken ? 'Reconnect Google Workspace' : 'Connect Owner Google Account'}
                </button>
                <button
                  type="button"
                  onClick={handleBootstrapWorkspace}
                  disabled={isBootstrapping}
                  className="px-3.5 py-2 rounded-lg bg-[#00D2FF] text-[#03030F] text-xs font-semibold hover:bg-[#33DBFF] transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
                >
                  {isBootstrapping
                    ? 'Provisioning...'
                    : 'Auto-Create Sheet (5 Tabs) & Drive Folders'}
                </button>
                <button
                  type="button"
                  onClick={() => fetchDashboard()}
                  className="p-2 rounded-lg border border-white/10 text-[#94A3B8] hover:text-white cursor-pointer"
                  title="Refresh Analytics"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingData ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-1 p-1 bg-[#03030F] rounded-xl border border-white/[0.07] overflow-x-auto">
              {[
                { id: 'overview', label: 'Website Analytics' },
                { id: 'visitors', label: `Visitors (${dashboardData?.visitors?.length || 0})` },
                {
                  id: 'contacts',
                  label: `Contact Messages (${dashboardData?.contactMessages?.length || 0})`,
                },
                { id: 'uploads', label: `Video Uploads (${dashboardData?.videoUploads?.length || 0})` },
                { id: 'portfolio', label: `Portfolio Projects (${projects.length})` },
                { id: 'workspace', label: 'Workspace & Setup' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id as AdminTab)}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    activeTab === t.id
                      ? 'bg-[#00D2FF] text-[#03030F] font-semibold'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* TAB 1: WEBSITE ANALYTICS & OVERVIEW */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    {
                      label: 'Total Visits',
                      value: dashboardData?.analytics?.totalVisits ?? 1,
                      note: 'All page views',
                    },
                    {
                      label: 'Unique Visitors',
                      value: dashboardData?.analytics?.uniqueVisitors ?? 1,
                      note: 'Distinct sessions',
                    },
                    {
                      label: 'Google Sign-ins',
                      value: dashboardData?.analytics?.googleSignIns ?? 0,
                      note: 'Authorized accounts',
                    },
                    {
                      label: 'Returning Visitors',
                      value: dashboardData?.analytics?.returningVisitors ?? 0,
                      note: 'Repeat sessions',
                    },
                    {
                      label: 'Contact Messages',
                      value: dashboardData?.contactMessages?.length ?? 0,
                      note: 'Saved & emailed',
                    },
                    {
                      label: 'Portfolio Projects',
                      value: projects.length,
                      note: `${dashboardData?.videoUploads?.length ?? 0} Drive uploads`,
                    },
                  ].map((stat) => (
                    <div
                      key={stat.label}
                      className="p-4 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-1"
                    >
                      <div className="text-xs text-[#94A3B8]">{stat.label}</div>
                      <div className="text-2xl font-bold text-white font-mono tabular-nums">
                        {stat.value}
                      </div>
                      <div className="text-[11px] text-[#64748B]">{stat.note}</div>
                    </div>
                  ))}
                </div>

                {/* Most Visited Pages & Recent Activity */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4 p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-4">
                    <h3 className="text-sm font-semibold text-white">Most Visited Sections</h3>
                    <div className="space-y-2.5">
                      {Object.entries(dashboardData?.analytics?.pageVisitCounts || {}).map(
                        ([page, count]) => (
                          <div
                            key={page}
                            className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.05] last:border-0"
                          >
                            <span className="text-[#CBD5E1]">{page}</span>
                            <span className="font-mono tabular-nums text-[#00D2FF]">
                              {String(count)} visits
                            </span>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  <div className="lg:col-span-8 p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-4">
                    <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-white/10 text-[#94A3B8]">
                            <th className="py-2.5 pr-4 font-medium">Time</th>
                            <th className="py-2.5 px-4 font-medium">Activity</th>
                            <th className="py-2.5 px-4 font-medium">User</th>
                            <th className="py-2.5 pl-4 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.05]">
                          {(dashboardData?.recentActivity || []).length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-[#64748B]">
                                No activity recorded in this session yet.
                              </td>
                            </tr>
                          ) : (
                            (dashboardData?.recentActivity || []).map((act: any) => (
                              <tr key={act.id}>
                                <td className="py-2.5 pr-4 font-mono tabular-nums text-[#94A3B8] whitespace-nowrap">
                                  {act.time}
                                </td>
                                <td className="py-2.5 px-4 text-white font-medium">
                                  {act.activity}
                                </td>
                                <td className="py-2.5 px-4 text-[#CBD5E1]">{act.user}</td>
                                <td className="py-2.5 pl-4 text-[#00D2FF] font-mono">
                                  {act.status}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: WEBSITE VISITORS (GOOGLE SIGN-IN LOG) */}
            {activeTab === 'visitors' && (
              <div className="p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      Website Visitors — Google Sign-In Log
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-0.5">
                      Synced with Google Sheets Tab 1: <span className="font-mono">Website Visitors</span>
                    </p>
                  </div>
                  {sheetIdInput && (
                    <a
                      href={`https://docs.google.com/spreadsheets/d/${sheetIdInput}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-[#00D2FF] hover:underline"
                    >
                      <span>Open Google Sheet</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[#94A3B8]">
                        <th className="py-2.5 pr-4 font-medium">Date &amp; Time</th>
                        <th className="py-2.5 px-4 font-medium">Name</th>
                        <th className="py-2.5 px-4 font-medium">Email</th>
                        <th className="py-2.5 px-4 font-medium">Login Method</th>
                        <th className="py-2.5 px-4 font-medium">Page Visited</th>
                        <th className="py-2.5 px-4 font-medium">Last Activity</th>
                        <th className="py-2.5 pl-4 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {(dashboardData?.visitors || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#64748B]">
                            No visitors have signed in with Google yet. Anonymous traffic is counted in
                            Website Analytics without collecting personal data.
                          </td>
                        </tr>
                      ) : (
                        (dashboardData?.visitors || []).map((v: any, i: number) => (
                          <tr key={`${v.email}-${i}`}>
                            <td className="py-2.5 pr-4 font-mono tabular-nums text-[#94A3B8]">
                              {v.timestamp}
                            </td>
                            <td className="py-2.5 px-4 text-white font-medium">{v.name}</td>
                            <td className="py-2.5 px-4 text-[#CBD5E1] font-mono">{v.email}</td>
                            <td className="py-2.5 px-4 text-[#94A3B8]">{v.loginMethod}</td>
                            <td className="py-2.5 px-4 text-[#CBD5E1]">{v.pageVisited}</td>
                            <td className="py-2.5 px-4 font-mono tabular-nums text-[#94A3B8]">
                              {v.lastActivity}
                            </td>
                            <td className="py-2.5 pl-4 text-[#00D2FF]">{v.status}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 3: CONTACT MESSAGES */}
            {activeTab === 'contacts' && (
              <div className="p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Contact Messages</h3>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Synced with Google Sheets Tab 2 (<span className="font-mono">Contact Messages</span>)
                    and emailed to <span className="font-mono">{OWNER_EMAIL}</span>
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/10 text-[#94A3B8]">
                        <th className="py-2.5 pr-4 font-medium">Date &amp; Time</th>
                        <th className="py-2.5 px-4 font-medium">Name</th>
                        <th className="py-2.5 px-4 font-medium">Visitor Email</th>
                        <th className="py-2.5 px-4 font-medium">Subject</th>
                        <th className="py-2.5 px-4 font-medium">Message</th>
                        <th className="py-2.5 px-4 font-medium">Status</th>
                        <th className="py-2.5 pl-4 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.05]">
                      {(dashboardData?.contactMessages || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-[#64748B]">
                            No contact messages submitted yet.
                          </td>
                        </tr>
                      ) : (
                        (dashboardData?.contactMessages || []).map((msg: any) => (
                          <tr key={msg.id}>
                            <td className="py-3 pr-4 font-mono tabular-nums text-[#94A3B8] whitespace-nowrap">
                              {msg.timestamp}
                            </td>
                            <td className="py-3 px-4 text-white font-medium">{msg.name}</td>
                            <td className="py-3 px-4 font-mono text-[#CBD5E1]">{msg.email}</td>
                            <td className="py-3 px-4 text-white">{msg.subject}</td>
                            <td className="py-3 px-4 text-[#CBD5E1] max-w-xs truncate">
                              {msg.message}
                            </td>
                            <td className="py-3 px-4 text-[#00D2FF]">{msg.status}</td>
                            <td className="py-3 pl-4">
                              <a
                                href={`mailto:${msg.email}?subject=${encodeURIComponent(
                                  `Re: ${msg.subject}`
                                )}`}
                                className="text-[#00D2FF] hover:underline whitespace-nowrap"
                              >
                                Reply Directly
                              </a>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: VIDEO UPLOADS -> GOOGLE DRIVE */}
            {activeTab === 'uploads' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-4">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-[#00D2FF]" />
                    <h3 className="text-sm font-semibold text-white">
                      Upload Your Video to Google Drive
                    </h3>
                  </div>
                  <p className="text-xs text-[#94A3B8]">
                    Uploads directly to <span className="font-mono">Rupam Portfolio Uploads</span> and
                    logs the File ID &amp; URL in the <span className="font-mono">Video Uploads</span>{' '}
                    Google Sheet tab.
                  </p>

                  {adminUploadStatus && (
                    <div className="p-3 rounded-lg bg-[#00D2FF]/10 border border-[#00D2FF]/30 text-xs text-[#00D2FF]">
                      {adminUploadStatus}
                    </div>
                  )}

                  <form onSubmit={handleAdminVideoUpload} className="space-y-3.5 text-xs">
                    <div>
                      <label className="block text-[#CBD5E1] mb-1">Video Title *</label>
                      <input
                        type="text"
                        required
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="e.g. Commercial Reel 2026"
                        className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">Category</label>
                        <select
                          value={uploadCat}
                          onChange={(e) => setUploadCat(e.target.value as ProjectCategory)}
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        >
                          <option value="Video Editing">Video Editing</option>
                          <option value="Motion Graphics">Motion Graphics</option>
                          <option value="Social Media Content">Social Media Content</option>
                          <option value="Thumbnails & Graphic Design">
                            Thumbnails &amp; Graphic Design
                          </option>
                          <option value="Commercial / Promotional">Commercial / Promotional</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">
                          Optional Project Name
                        </label>
                        <input
                          type="text"
                          value={uploadProjName}
                          onChange={(e) => setUploadProjName(e.target.value)}
                          placeholder="Client / Project"
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#CBD5E1] mb-1">Description</label>
                      <textarea
                        rows={2}
                        value={uploadDesc}
                        onChange={(e) => setUploadDesc(e.target.value)}
                        placeholder="Short notes about this video file"
                        className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[#CBD5E1] mb-1">Video File *</label>
                      <input
                        type="file"
                        accept=".mp4,.mov,.webm,.mkv,video/*"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="w-full text-xs text-[#94A3B8] file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/10 file:text-white hover:file:bg-white/15"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isUploadingAdminVideo || !uploadFile}
                      className="w-full py-2.5 rounded-lg bg-[#00D2FF] text-[#03030F] font-semibold hover:bg-[#33DBFF] transition-colors disabled:opacity-40 cursor-pointer"
                    >
                      {isUploadingAdminVideo
                        ? 'Uploading to Google Drive...'
                        : 'Upload Video to Google Drive'}
                    </button>
                  </form>
                </div>

                <div className="lg:col-span-7 p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-4">
                  <h3 className="text-sm font-semibold text-white">
                    Uploaded Videos (Portfolio &amp; Client Uploads)
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-white/10 text-[#94A3B8]">
                          <th className="py-2.5 pr-3 font-medium">Upload Date</th>
                          <th className="py-2.5 px-3 font-medium">Uploader / Client</th>
                          <th className="py-2.5 px-3 font-medium">File Name</th>
                          <th className="py-2.5 px-3 font-medium">Size</th>
                          <th className="py-2.5 px-3 font-medium">Status</th>
                          <th className="py-2.5 pl-3 font-medium">Drive Link</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05]">
                        {(dashboardData?.videoUploads || []).length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-[#64748B]">
                              No videos uploaded in this session yet.
                            </td>
                          </tr>
                        ) : (
                          (dashboardData?.videoUploads || []).map((u: any) => (
                            <tr key={u.id}>
                              <td className="py-2.5 pr-3 font-mono tabular-nums text-[#94A3B8]">
                                {u.timestamp}
                              </td>
                              <td className="py-2.5 px-3 text-white font-medium">
                                {u.uploaderName}
                              </td>
                              <td className="py-2.5 px-3 text-[#CBD5E1]">{u.fileName}</td>
                              <td className="py-2.5 px-3 font-mono text-[#94A3B8]">{u.fileSize}</td>
                              <td className="py-2.5 px-3 text-emerald-400">{u.status}</td>
                              <td className="py-2.5 pl-3">
                                <a
                                  href={u.driveUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[#00D2FF] hover:underline"
                                >
                                  <span>Open in Drive</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: PORTFOLIO PROJECTS & HERO PORTRAIT MANAGER */}
            {activeTab === 'portfolio' && (
              <div className="space-y-6">
                {/* Official Website Brand Logo Manager */}
                <div className="p-5 rounded-xl bg-[#03030F] border border-white/[0.07] flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <BrandLogo size="lg" />
                    <div className="space-y-1">
                      <h3 className="text-sm font-semibold text-white">
                        Official Website Brand Logo
                      </h3>
                      <p className="text-xs text-[#94A3B8]">
                        Active across Navbar, Mobile Menu, Hero, Footer, Favicon, Admin, Login, Splash, Contact, and Modals without modification.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 rounded-lg bg-[#00D2FF] text-[#03030F] text-xs font-semibold hover:bg-[#33DBFF] transition-colors cursor-pointer whitespace-nowrap">
                      <span>{isUploadingLogo ? 'Syncing Logo...' : 'Select Exact Logo File (rupam 1.png)'}</span>
                      <input
                        type="file"
                        accept="image/png,image/svg+xml,image/webp,image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const ok = await uploadExactLogoFile(file);
                          if (ok) {
                            setStatusBanner({
                              type: 'success',
                              text: 'Official website logo synced across all website locations and browser favicon.',
                            });
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* Profile Image Uploader (Preserving Original Identity) */}
                <div className="p-5 rounded-xl bg-[#03030F] border border-white/[0.07] flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white">
                      Personal Profile / Hero Image
                    </h3>
                    <p className="text-xs text-[#94A3B8]">
                      Upload your authentic personal photo. Displayed unaltered in the Hero section.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 rounded-lg bg-[#00D2FF] text-[#03030F] text-xs font-semibold hover:bg-[#33DBFF] transition-colors cursor-pointer">
                      <span>Upload Profile Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleProfilePhotoFile}
                        className="hidden"
                      />
                    </label>
                    {profileImage && (
                      <button
                        type="button"
                        onClick={() => onUpdateProfileImage(null)}
                        className="px-3 py-2 rounded-lg border border-white/10 text-xs text-[#94A3B8] hover:text-white cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Add / Edit Project Form */}
                  <form
                    onSubmit={handleSaveProject}
                    className="lg:col-span-5 p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-3.5 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        {editingId ? 'Edit Portfolio Project' : 'Add New Portfolio Project'}
                      </h3>
                      {editingId && (
                        <button
                          type="button"
                          onClick={resetProjectForm}
                          className="text-xs text-[#94A3B8] hover:text-white cursor-pointer"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[#CBD5E1] mb-1">
                        Video / External URL (YouTube, Shorts, Facebook, Instagram, TikTok) *
                      </label>
                      <input
                        type="url"
                        required
                        value={projUrl}
                        onChange={(e) => setProjUrl(e.target.value)}
                        placeholder="https://youtu.be/... or https://youtube.com/shorts/..."
                        className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[#CBD5E1] mb-1">
                        Project Title (Leave blank to auto-fetch from YouTube)
                      </label>
                      <input
                        type="text"
                        value={projTitle}
                        onChange={(e) => setProjTitle(e.target.value)}
                        placeholder="e.g. Video Project 07"
                        className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">Category</label>
                        <select
                          value={projCategory}
                          onChange={(e) => setProjCategory(e.target.value as ProjectCategory)}
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        >
                          <option value="Video Editing">Video Editing</option>
                          <option value="Motion Graphics">Motion Graphics</option>
                          <option value="Social Media Content">Social Media Content</option>
                          <option value="Thumbnails & Graphic Design">
                            Thumbnails &amp; Graphic Design
                          </option>
                          <option value="Commercial / Promotional">Commercial / Promotional</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">Platform Detection</label>
                        <select
                          value={projPlatform}
                          onChange={(e) => setProjPlatform(e.target.value as VideoPlatform | 'Auto')}
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        >
                          <option value="Auto">Auto-Detect from URL</option>
                          <option value="YouTube">YouTube</option>
                          <option value="YouTube Shorts">YouTube Shorts</option>
                          <option value="Facebook">Facebook</option>
                          <option value="Instagram">Instagram</option>
                          <option value="TikTok">TikTok</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">My Role (Optional)</label>
                        <input
                          type="text"
                          value={projRole}
                          onChange={(e) => setProjRole(e.target.value)}
                          placeholder="e.g. Video Editing + Motion Graphics"
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">
                          Channel / Client (Optional)
                        </label>
                        <input
                          type="text"
                          value={projChannel}
                          onChange={(e) => setProjChannel(e.target.value)}
                          placeholder="Channel or Client Name"
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[#CBD5E1] mb-1">Short Description (Optional)</label>
                      <textarea
                        rows={2}
                        value={projDesc}
                        onChange={(e) => setProjDesc(e.target.value)}
                        placeholder="Concise project summary"
                        className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-lg bg-[#00D2FF] text-[#03030F] font-semibold hover:bg-[#33DBFF] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{editingId ? 'Save Project Changes' : 'Add Project to Portfolio'}</span>
                    </button>
                  </form>

                  {/* Existing Portfolio Projects List */}
                  <div className="lg:col-span-7 p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-4">
                    <h3 className="text-sm font-semibold text-white">
                      Active Portfolio Projects ({projects.length})
                    </h3>
                    <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                      {projects.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-4 p-3 rounded-xl bg-[#080A18] border border-white/[0.06]"
                        >
                          <div className="min-w-0 space-y-0.5">
                            <div className="text-xs font-semibold text-white truncate">
                              {p.title}
                            </div>
                            <div className="text-[11px] text-[#94A3B8] truncate">
                              {p.platform} · {p.category}
                              {p.role ? ` · ${p.role}` : ''}
                            </div>
                            <div className="text-[11px] font-mono text-[#64748B] truncate">
                              {p.videoUrl}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => startEditingProject(p)}
                              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/5 cursor-pointer"
                              title="Edit Project"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProject(p)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 6: WORKSPACE SUITE (SHEETS, DRIVE, CALENDAR, FORMS, CHAT) & APPS SCRIPT */}
            {activeTab === 'workspace' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Server Configuration Form */}
                  <form
                    onSubmit={handleSaveWorkspaceConfig}
                    className="lg:col-span-6 p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-4 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-[#00D2FF]" />
                      <h3 className="text-sm font-semibold text-white">
                        Google Workspace &amp; Upload Security Configuration
                      </h3>
                    </div>

                    <div>
                      <label className="block text-[#CBD5E1] mb-1">
                        Google Sheet ID (Central 5-Tab Database)
                      </label>
                      <input
                        type="text"
                        value={sheetIdInput}
                        onChange={(e) => setSheetIdInput(e.target.value)}
                        placeholder="Click 'Auto-Create Sheet' above or paste Spreadsheet ID"
                        className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">
                          Portfolio Drive Folder ID (Rupam Portfolio Uploads)
                        </label>
                        <input
                          type="text"
                          value={driveFolderIdInput}
                          onChange={(e) => setDriveFolderIdInput(e.target.value)}
                          placeholder="Google Drive Folder ID"
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">
                          Client Uploads Parent Folder ID
                        </label>
                        <input
                          type="text"
                          value={clientFolderIdInput}
                          onChange={(e) => setClientFolderIdInput(e.target.value)}
                          placeholder="Client Uploads Folder ID"
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">
                          Apps Script Web App URL (Optional)
                        </label>
                        <input
                          type="url"
                          value={appsScriptUrlInput}
                          onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                          placeholder="https://script.google.com/macros/s/.../exec"
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">
                          Max Video Upload Size (MB)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={5000}
                          value={maxSizeInput}
                          onChange={(e) => setMaxSizeInput(Number(e.target.value))}
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/[0.06]">
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">
                          Update Admin Password (Server-Side)
                        </label>
                        <input
                          type="password"
                          value={newAdminPass}
                          onChange={(e) => setNewAdminPass(e.target.value)}
                          placeholder="Leave blank to keep current"
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[#CBD5E1] mb-1">
                          Update Client Upload Password (Server-Side)
                        </label>
                        <input
                          type="password"
                          value={newClientPass}
                          onChange={(e) => setNewClientPass(e.target.value)}
                          placeholder="Leave blank to keep current"
                          className="w-full px-3 py-2 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2.5 rounded-lg bg-[#00D2FF] text-[#03030F] font-semibold hover:bg-[#33DBFF] transition-colors cursor-pointer"
                    >
                      Save Configuration
                    </button>
                  </form>

                  {/* Google Calendar, Google Forms & Google Chat Tools */}
                  <div className="lg:col-span-6 space-y-4">
                    {/* Google Calendar Production Schedule */}
                    <div className="p-4 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-[#00D2FF]" />
                          <span className="font-semibold text-white">
                            Google Calendar — Editing Schedule &amp; Deadlines
                          </span>
                        </div>
                        {ownerAccessToken && (
                          <button
                            type="button"
                            onClick={async () => {
                              const evs = await fetchUpcomingCalendarEvents(ownerAccessToken);
                              setCalendarEvents(evs);
                            }}
                            className="text-[#00D2FF] hover:underline cursor-pointer"
                          >
                            Refresh
                          </button>
                        )}
                      </div>

                      {calendarEvents.length > 0 && (
                        <div className="space-y-1.5">
                          {calendarEvents.slice(0, 3).map((ev) => (
                            <div
                              key={ev.id}
                              className="flex items-center justify-between py-1 border-b border-white/[0.05]"
                            >
                              <span className="text-white truncate">{ev.summary}</span>
                              <span className="font-mono text-[#94A3B8] text-[11px]">
                                {ev.start ? new Date(ev.start).toLocaleDateString() : ''}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-2 pt-1">
                        <input
                          type="text"
                          value={newEventTitle}
                          onChange={(e) => setNewEventTitle(e.target.value)}
                          placeholder="Milestone title (e.g. Client Rough Cut)"
                          className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        />
                        <input
                          type="datetime-local"
                          value={newEventDate}
                          onChange={(e) => setNewEventDate(e.target.value)}
                          className="px-2.5 py-1.5 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!ownerAccessToken || !newEventTitle || !newEventDate) return;
                            setConfirmAction({
                              title: 'Add Event to Google Calendar?',
                              description: `Create calendar event "${newEventTitle}" on your primary Google Calendar?`,
                              confirmLabel: 'Create Event',
                              onConfirm: async () => {
                                const created = await createCalendarMilestone(
                                  ownerAccessToken,
                                  newEventTitle,
                                  newEventDate,
                                  'Portfolio production milestone'
                                );
                                if (created) {
                                  setCalendarEvents([created, ...calendarEvents]);
                                  setNewEventTitle('');
                                  setNewEventDate('');
                                }
                                setConfirmAction(null);
                              },
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium cursor-pointer"
                        >
                          Add Event
                        </button>
                      </div>
                    </div>

                    {/* Google Forms Client Brief Reader */}
                    <div className="p-4 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-3 text-xs">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="w-4 h-4 text-[#7AA2F7]" />
                        <span className="font-semibold text-white">
                          Google Forms — Client Project Brief Responses
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={formIdInput}
                          onChange={(e) => setFormIdInput(e.target.value)}
                          placeholder="Paste Google Form ID to inspect responses"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#080A18] border border-white/10 text-white font-mono"
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            if (!ownerAccessToken || !formIdInput) return;
                            const summary = await fetchGoogleFormSummary(
                              ownerAccessToken,
                              formIdInput
                            );
                            setFormSummary(summary);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium cursor-pointer"
                        >
                          Load Responses
                        </button>
                      </div>
                      {formSummary && (
                        <div className="p-2.5 rounded-lg bg-[#080A18] space-y-1">
                          <div className="text-white font-medium">
                            {formSummary.formTitle} · {formSummary.responseCount} responses
                          </div>
                          {formSummary.recentResponses.map((r) => (
                            <div key={r.responseId} className="text-[11px] text-[#94A3B8]">
                              {r.createTime}: {r.summaryText}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Google Chat Notification Dispatcher */}
                    <div className="p-4 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-3 text-xs">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-[#BB9AFF]" />
                        <span className="font-semibold text-white">
                          Google Chat — Project Space Update
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={selectedSpace}
                          onChange={(e) => setSelectedSpace(e.target.value)}
                          placeholder={
                            chatSpaces.length > 0
                              ? chatSpaces[0].displayName
                              : 'spaces/SPACE_ID'
                          }
                          className="w-40 px-2.5 py-1.5 rounded-lg bg-[#080A18] border border-white/10 text-white font-mono"
                        />
                        <input
                          type="text"
                          value={chatMessageInput}
                          onChange={(e) => setChatMessageInput(e.target.value)}
                          placeholder="Post project status to Google Chat space"
                          className="flex-1 px-2.5 py-1.5 rounded-lg bg-[#080A18] border border-white/10 text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!ownerAccessToken || !selectedSpace || !chatMessageInput) return;
                            setConfirmAction({
                              title: 'Send Message to Google Chat Space?',
                              description: `Post "${chatMessageInput}" to ${selectedSpace}?`,
                              confirmLabel: 'Send Chat Message',
                              onConfirm: async () => {
                                await postChatMessage(
                                  ownerAccessToken,
                                  selectedSpace,
                                  chatMessageInput
                                );
                                setChatMessageInput('');
                                setConfirmAction(null);
                              },
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium cursor-pointer"
                        >
                          Post
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ready-to-Deploy Google Apps Script Code.gs */}
                <div className="p-5 rounded-xl bg-[#03030F] border border-white/[0.07] space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white">
                        Optional Standalone Google Apps Script Backend (Code.gs)
                      </h4>
                      <p className="text-[11px] text-[#94A3B8]">
                        You can either use the built-in 1-click Google Workspace OAuth connection
                        above OR deploy this Apps Script Web App on your Google Sheet.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
                        setCopiedScript(true);
                        setTimeout(() => setCopiedScript(false), 2000);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-white cursor-pointer"
                    >
                      {copiedScript ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied Code.gs</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Apps Script</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-[#080A18] border border-white/5 text-[11px] font-mono text-[#94A3B8] overflow-x-auto max-h-48">
                    {APPS_SCRIPT_TEMPLATE}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
