import React, { useState, useRef } from 'react';
import { Lock, Upload, CheckCircle2, AlertCircle, Film, ShieldCheck, FileVideo, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface ClientUploadSectionProps {
  userAccessToken: string | null;
  onTrackPage: (page: string) => void;
}

interface CompletedClientUpload {
  clientName: string;
  fileName: string;
  fileSizeFormatted: string;
  folderName: string;
  timestamp: string;
}

export const ClientUploadSection: React.FC<ClientUploadSectionProps> = ({
  userAccessToken,
  onTrackPage,
}) => {
  const [passwordInput, setPasswordInput] = useState('');
  const [clientUploadToken, setClientUploadToken] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [maxSizeMb, setMaxSizeMb] = useState<number>(500);

  // Upload form state
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [projectNotes, setProjectNotes] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Upload progress state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedBytes, setUploadedBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadResult, setUploadResult] = useState<CompletedClientUpload | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const formatMegabytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    if (mb < 1) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
  };

  const validateVideoFile = (file: File): string | null => {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedExts = ['mp4', 'mov', 'webm', 'mkv'];
    const allowedMimes = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'];

    if (!allowedExts.includes(ext) && !allowedMimes.includes(file.type)) {
      return 'Unsupported video format. Allowed formats: MP4, MOV, WebM, MKV.';
    }

    const maxBytes = maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      return `File is too large. The maximum allowed video size is ${maxSizeMb} MB.`;
    }

    return null;
  };

  const handleVerifyPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!passwordInput.trim()) {
      setAuthError('Please enter the dedicated client upload password.');
      return;
    }

    setIsVerifying(true);
    onTrackPage('Client Upload');
    try {
      const res = await fetch('/api/client-upload/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: passwordInput }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setAuthError(data.error || 'Invalid upload password.');
        return;
      }

      setClientUploadToken(data.clientUploadToken);
      if (typeof data.maxUploadSizeMb === 'number') {
        setMaxSizeMb(data.maxUploadSizeMb);
      }
      setPasswordInput('');
    } catch {
      setAuthError('Unable to verify password right now. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    setUploadResult(null);
    const file = e.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }

    const validationError = validateVideoFile(file);
    if (validationError) {
      setUploadError(validationError);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setSelectedFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);
    setUploadResult(null);

    if (!clientUploadToken) {
      setUploadError('Your upload session expired. Please re-enter the client upload password.');
      return;
    }

    if (!clientName.trim()) {
      setUploadError('Please enter your Client Name so your dedicated Google Drive folder can be prepared.');
      return;
    }

    if (!selectedFile) {
      setUploadError('Please select a video file to upload.');
      return;
    }

    const validationError = validateVideoFile(selectedFile);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setIsUploading(true);
    setUploadedBytes(0);
    setTotalBytes(selectedFile.size);
    setUploadPercent(0);

    try {
      // Step 1: Server validates file size/type & finds or creates Client Uploads/<Client Name> folder
      const prepRes = await fetch('/api/client-upload/prepare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-upload-token': clientUploadToken,
        },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          projectNotes: projectNotes.trim(),
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type || 'video/mp4',
          userAccessToken,
        }),
      });

      const prepData = await prepRes.json();
      if (!prepRes.ok || !prepData.ok) {
        setUploadError(prepData.error || 'Upload failed. Please try again.');
        setIsUploading(false);
        return;
      }

      if (prepData.mode === 'resumable' && prepData.uploadUrl) {
        // Step 2: Stream file bytes directly to the isolated Google Drive resumable upload session
        const driveFileResult = await new Promise<{ id: string; webViewLink?: string }>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', prepData.uploadUrl, true);
          xhr.setRequestHeader('Content-Type', selectedFile.type || 'video/mp4');

          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setUploadedBytes(event.loaded);
              setTotalBytes(event.total);
              const pct = Math.min(99, Math.round((event.loaded / event.total) * 100));
              setUploadPercent(pct);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const parsed = JSON.parse(xhr.responseText);
                resolve(parsed);
              } catch {
                resolve({ id: `drive-${Date.now()}` });
              }
            } else {
              reject(new Error('Upload failed. Please try again.'));
            }
          };

          xhr.onerror = () => {
            reject(new Error('Upload failed. Please try again.'));
          };

          xhr.send(selectedFile);
        });

        setUploadedBytes(selectedFile.size);
        setUploadPercent(100);

        // Step 3: Record upload metadata in the Client Uploads Google Sheet tab
        await fetch('/api/client-upload/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientName: clientName.trim(),
            clientEmail: clientEmail.trim(),
            fileName: selectedFile.name,
            fileSizeFormatted: formatMegabytes(selectedFile.size),
            fileType: selectedFile.type || 'video/mp4',
            driveFileId: driveFileResult.id,
            driveFolderId: prepData.clientFolderId || '',
            driveUrl:
              driveFileResult.webViewLink ||
              `https://drive.google.com/file/d/${driveFileResult.id}/view`,
            isClientUpload: true,
            userAccessToken,
          }),
        });

        setUploadResult({
          clientName: clientName.trim(),
          fileName: selectedFile.name,
          fileSizeFormatted: formatMegabytes(selectedFile.size),
          folderName: `Client Uploads / ${prepData.clientFolderName || clientName.trim()}`,
          timestamp: new Date().toLocaleString(),
        });
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        setUploadError('Upload failed. Please try again.');
      }
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <section id="client-upload" className="py-24 border-t border-white/[0.07] relative">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Explanation & Folder Architecture Info */}
          <div className="lg:col-span-5 space-y-6">
            <div className="text-xs font-mono tracking-wider text-[#00D2FF]">
              06. Client Video Delivery Portal
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
              Client Video Upload
            </h2>
            <p className="text-[#94A3B8] text-base leading-relaxed">
              Dedicated high-capacity transfer portal for clients sending raw footage, project
              assets, or reference cuts directly to Rafiul Islam Rupam’s production Google Drive.
            </p>

            <div className="pt-4 border-t border-white/[0.07] space-y-4 text-sm text-[#94A3B8]">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-4 h-4 text-[#00D2FF] shrink-0 mt-1" />
                <div>
                  <span className="text-white font-medium">Automatic Client Folder Routing</span>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Videos are organized automatically under{' '}
                    <span className="font-mono text-white/90">Client Uploads / [Your Client Name]</span>.
                    Subsequent uploads reuse your existing folder.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Film className="w-4 h-4 text-[#7AA2F7] shrink-0 mt-1" />
                <div>
                  <span className="text-white font-medium">Supported Formats &amp; Size Limit</span>
                  <p className="text-xs text-[#94A3B8] mt-0.5 font-mono">
                    MP4 · MOV · WebM · MKV · Max {maxSizeMb} MB per file
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Password Gate or Isolated Client Upload Interface */}
          <div className="lg:col-span-7">
            <div className="bg-[#0B0D1E] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
              {!clientUploadToken ? (
                <form onSubmit={handleVerifyPassword} className="space-y-6">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-4 gap-4">
                    <div className="flex items-center gap-3.5">
                      <BrandLogo size="md" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          Protected Client Transfer Access
                        </h3>
                        <p className="text-xs text-[#94A3B8] mt-1">
                          Enter the client upload password provided by Rafiul Islam Rupam to unlock the
                          video uploader.
                        </p>
                      </div>
                    </div>
                    <Lock className="w-5 h-5 text-[#00D2FF] shrink-0" />
                  </div>

                  {authError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="client-upload-password"
                      className="block text-xs font-medium text-[#CBD5E1] mb-2"
                    >
                      Client Upload Password
                    </label>
                    <input
                      id="client-upload-password"
                      type="password"
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Enter secret upload password"
                      className="w-full px-4 py-3 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
                      autoComplete="off"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-4 pt-2">
                    <span className="text-xs text-[#64748B]">
                      Need the password? Contact rafiulislamrupom11@gmail.com
                    </span>
                    <button
                      type="submit"
                      disabled={isVerifying}
                      className="px-5 py-2.5 rounded-xl bg-[#00D2FF] text-[#03030F] font-semibold text-sm hover:bg-[#33DBFF] transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
                    >
                      {isVerifying ? 'Verifying...' : 'Unlock Upload Portal'}
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleUploadSubmit} className="space-y-5">
                  <div className="flex items-center justify-between border-b border-white/[0.07] pb-4 gap-4">
                    <div className="flex items-center gap-3.5">
                      <BrandLogo size="md" />
                      <div>
                        <h3 className="text-lg font-semibold text-white">
                          Upload Video to Client Folder
                        </h3>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                          Direct encrypted transfer · Max {maxSizeMb} MB · MP4, MOV, WebM, MKV
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setClientUploadToken(null);
                        setSelectedFile(null);
                        setUploadResult(null);
                        setUploadError(null);
                      }}
                      className="text-xs text-[#94A3B8] hover:text-white transition-colors whitespace-nowrap cursor-pointer"
                    >
                      Lock Portal
                    </button>
                  </div>

                  {uploadError && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{uploadError}</span>
                    </div>
                  )}

                  {uploadResult && (
                    <div
                      role="status"
                      className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2"
                    >
                      <div className="flex items-center gap-2 text-emerald-300 font-semibold text-sm">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Upload Complete — Your video has been successfully uploaded.</span>
                      </div>
                      <p className="text-xs text-emerald-200/90">
                        Video uploaded successfully to your client folder.
                      </p>
                      <div className="pt-2 border-t border-emerald-500/20 text-xs text-[#CBD5E1] font-mono space-y-1">
                        <div>Client: {uploadResult.clientName}</div>
                        <div>File: {uploadResult.fileName} ({uploadResult.fileSizeFormatted})</div>
                        <div>Destination: {uploadResult.folderName}</div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="client-name-input"
                        className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                      >
                        Client Name *
                      </label>
                      <input
                        id="client-name-input"
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="e.g. Studio Horizon"
                        disabled={isUploading}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="client-email-input"
                        className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                      >
                        Client Email (Optional)
                      </label>
                      <input
                        id="client-email-input"
                        type="email"
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="client@company.com"
                        disabled={isUploading}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="client-project-notes"
                      className="block text-xs font-medium text-[#CBD5E1] mb-1.5"
                    >
                      Project Title / Editing Notes (Optional)
                    </label>
                    <input
                      id="client-project-notes"
                      type="text"
                      value={projectNotes}
                      onChange={(e) => setProjectNotes(e.target.value)}
                      placeholder="Brief note about footage or project name"
                      disabled={isUploading}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#03030F] border border-white/10 text-white text-sm focus:outline-none focus:border-[#00D2FF] transition-colors"
                    />
                  </div>

                  {/* Video File Selector */}
                  <div>
                    <label className="block text-xs font-medium text-[#CBD5E1] mb-1.5">
                      Select Video File (Max {maxSizeMb} MB · MP4, MOV, WebM, MKV) *
                    </label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".mp4,.mov,.webm,.mkv,video/mp4,video/quicktime,video/webm,video/x-matroska"
                      onChange={handleFileChange}
                      disabled={isUploading}
                      className="hidden"
                      id="client-video-file-input"
                    />
                    {!selectedFile ? (
                      <label
                        htmlFor="client-video-file-input"
                        className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-white/15 bg-[#03030F]/70 hover:border-[#00D2FF]/60 transition-colors cursor-pointer text-center"
                      >
                        <Upload className="w-6 h-6 text-[#00D2FF]" />
                        <span className="text-sm font-medium text-white">
                          Click to select video file
                        </span>
                        <span className="text-xs text-[#64748B] font-mono">
                          MP4, MOV, WebM, MKV · Up to {maxSizeMb} MB
                        </span>
                      </label>
                    ) : (
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#03030F] border border-white/10">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileVideo className="w-5 h-5 text-[#00D2FF] shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white truncate">
                              {selectedFile.name}
                            </p>
                            <p className="text-xs text-[#94A3B8] font-mono">
                              {formatMegabytes(selectedFile.size)} · {selectedFile.type || 'Video'}
                            </p>
                          </div>
                        </div>
                        {!isUploading && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFile(null);
                              if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                            className="p-1.5 text-[#94A3B8] hover:text-white transition-colors cursor-pointer"
                            aria-label="Remove selected file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Upload Progress Bar */}
                  {isUploading && (
                    <div className="p-4 rounded-xl bg-[#03030F] border border-[#00D2FF]/30 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#00D2FF]">Uploading...</span>
                        <span className="text-white">
                          Uploading {formatMegabytes(uploadedBytes)} / {formatMegabytes(totalBytes)} —{' '}
                          {uploadPercent}%
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#00D2FF] to-[#7AA2F7] transition-all duration-150"
                          style={{ width: `${uploadPercent}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isUploading || !selectedFile}
                      className="px-6 py-2.5 rounded-xl bg-[#00D2FF] text-[#03030F] font-semibold text-sm hover:bg-[#33DBFF] transition-colors whitespace-nowrap disabled:opacity-40 cursor-pointer"
                    >
                      {isUploading ? 'Uploading Video...' : 'Upload Video'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
