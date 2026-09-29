import React, { useState, useEffect } from 'react';
import { Play, ExternalLink, X, Plus, Film } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import {
  PortfolioProject,
  ProjectCategory,
  parseVideoUrl,
  buildProjectFromInput,
} from '../data/portfolioData';

interface PortfolioSectionProps {
  projects: PortfolioProject[];
  onAddProject: (project: PortfolioProject) => void;
  onTrackPage: (page: string) => void;
}

const FILTER_OPTIONS = [
  'All',
  'Video Editing',
  'YouTube',
  'YouTube Shorts',
  'Motion Graphics',
  'Social Media Content',
  'Thumbnails & Graphic Design',
  'Commercial / Promotional',
] as const;

type FilterOption = (typeof FILTER_OPTIONS)[number];

const SHOWCASE_FILTERS = [
  'All',
  'YouTube',
  'Shorts',
  'Facebook',
  'Instagram',
  'TikTok',
  'Motion Graphics',
  'Editing',
] as const;

type ShowcaseFilter = (typeof SHOWCASE_FILTERS)[number];

export const PortfolioSection: React.FC<PortfolioSectionProps> = ({
  projects,
  onAddProject,
  onTrackPage,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterOption>('All');
  const [showcaseFilter, setShowcaseFilter] = useState<ShowcaseFilter>('All');
  const [activeModalProject, setActiveModalProject] = useState<PortfolioProject | null>(null);
  const [resolvedMeta, setResolvedMeta] = useState<
    Record<string, { title?: string; author_name?: string }>
  >({});
  const [imgFallbacks, setImgFallbacks] = useState<Record<string, number>>({});

  // Quick Add Video URL drawer state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickUrl, setQuickUrl] = useState('');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickCategory, setQuickCategory] = useState<ProjectCategory>('Video Editing');
  const [quickRole, setQuickRole] = useState('');
  const [quickDesc, setQuickDesc] = useState('');

  // Automatically fetch YouTube oEmbed metadata (title & channel) for YouTube projects
  useEffect(() => {
    let isMounted = true;
    projects.forEach(async (proj) => {
      if (!proj.youtubeId || resolvedMeta[proj.id]) return;
      try {
        const res = await fetch(`/api/youtube/oembed?url=${encodeURIComponent(proj.videoUrl)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted && (data.title || data.author_name)) {
          setResolvedMeta((prev) => ({
            ...prev,
            [proj.id]: {
              title: data.title,
              author_name: data.author_name,
            },
          }));
        }
      } catch {
        // Keep clean fallback project label if metadata cannot be retrieved
      }
    });
    return () => {
      isMounted = false;
    };
  }, [projects]);

  // Close modal on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveModalProject(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredProjects = projects.filter((proj) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'YouTube') return proj.platform === 'YouTube';
    if (activeFilter === 'YouTube Shorts') return proj.platform === 'YouTube Shorts' || proj.isShort;
    return proj.category === activeFilter;
  });

  const filteredShowcase = projects.filter((proj) => {
    if (showcaseFilter === 'All') return true;
    if (showcaseFilter === 'YouTube') return proj.platform === 'YouTube';
    if (showcaseFilter === 'Shorts') return proj.platform === 'YouTube Shorts' || proj.isShort;
    if (showcaseFilter === 'Facebook') return proj.platform === 'Facebook';
    if (showcaseFilter === 'Instagram') return proj.platform === 'Instagram';
    if (showcaseFilter === 'TikTok') return proj.platform === 'TikTok';
    if (showcaseFilter === 'Motion Graphics') return proj.category === 'Motion Graphics';
    if (showcaseFilter === 'Editing') return proj.category === 'Video Editing';
    return true;
  });

  const standardVideos = filteredProjects.filter((p) => !p.isShort && p.platform !== 'YouTube Shorts');
  const shortVideos = filteredProjects.filter((p) => p.isShort || p.platform === 'YouTube Shorts');

  const getDisplayTitle = (proj: PortfolioProject) => {
    const fetchedTitle = resolvedMeta[proj.id]?.title;
    if (/^Video Project 0\d$/i.test(proj.title) && fetchedTitle) {
      return fetchedTitle;
    }
    return proj.title;
  };

  const getDisplayChannel = (proj: PortfolioProject) => {
    return proj.channelName || resolvedMeta[proj.id]?.author_name || '';
  };

  const getThumbnailSrc = (proj: PortfolioProject) => {
    const stage = imgFallbacks[proj.id] || 0;
    if (stage === 0 && proj.thumbnailUrl) return proj.thumbnailUrl;
    if (stage === 1 && proj.fallbackThumbnailUrl) return proj.fallbackThumbnailUrl;
    return '';
  };

  const handleImageError = (projId: string) => {
    setImgFallbacks((prev) => ({
      ...prev,
      [projId]: (prev[projId] || 0) + 1,
    }));
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUrl.trim()) return;
    const newProj = buildProjectFromInput({
      title: quickTitle.trim() || `Video Project 0${projects.length + 1}`,
      videoUrl: quickUrl.trim(),
      category: quickCategory,
      role: quickRole.trim() || undefined,
      description: quickDesc.trim() || undefined,
    });
    onAddProject(newProj);
    setQuickUrl('');
    setQuickTitle('');
    setQuickRole('');
    setQuickDesc('');
    setShowQuickAdd(false);
  };

  return (
    <>
      {/* SECTION 5: MY WORK / PORTFOLIO */}
      <section id="work" className="py-24 border-t border-white/[0.07] relative">
        <div className="max-w-[1200px] mx-auto px-6 space-y-12">
          {/* Header & Interactive Filter Controls */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="text-xs font-mono tracking-wider text-[#00D2FF]">
                02. Selected Portfolio
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                My Work
              </h2>
              <p className="text-[#94A3B8] text-base max-w-xl">
                Curated video editing, motion graphics, YouTube post-production, and vertical short-form
                projects. Click any project to play in the studio viewer or open the original source.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
              className="self-start md:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/15 bg-white/[0.03] hover:border-[#00D2FF]/60 text-xs font-medium text-white transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#00D2FF]" />
              <span>{showQuickAdd ? 'Close Project Builder' : 'Quick Add Video URL'}</span>
            </button>
          </div>

          {/* Quick Project Submission Drawer */}
          {showQuickAdd && (
            <form
              onSubmit={handleQuickAddSubmit}
              className="p-6 rounded-2xl bg-[#0B0D1E] border border-[#00D2FF]/30 space-y-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5">
                  <BrandLogo size="xs" />
                  <h3 className="text-sm font-semibold text-white">
                    Instant Portfolio Card Generator
                  </h3>
                </div>
                <span className="text-xs text-[#94A3B8]">
                  Paste a YouTube, Shorts, Facebook, Instagram, or TikTok URL
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[#CBD5E1] mb-1">Video URL *</label>
                  <input
                    type="url"
                    required
                    value={quickUrl}
                    onChange={(e) => setQuickUrl(e.target.value)}
                    placeholder="https://youtu.be/... or https://youtube.com/shorts/..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#03030F] border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#CBD5E1] mb-1">
                    Project Title (Auto-fetched if blank)
                  </label>
                  <input
                    type="text"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                    placeholder={`Video Project 0${projects.length + 1}`}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#03030F] border border-white/10 text-white"
                  />
                </div>
                <div>
                  <label className="block text-[#CBD5E1] mb-1">Category</label>
                  <select
                    value={quickCategory}
                    onChange={(e) => setQuickCategory(e.target.value as ProjectCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#03030F] border border-white/10 text-white"
                  >
                    <option value="Video Editing">Video Editing</option>
                    <option value="Motion Graphics">Motion Graphics</option>
                    <option value="Social Media Content">Social Media Content</option>
                    <option value="Thumbnails & Graphic Design">Thumbnails &amp; Graphic Design</option>
                    <option value="Commercial / Promotional">Commercial / Promotional</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <label className="block text-[#CBD5E1] mb-1">Role (Optional)</label>
                  <input
                    type="text"
                    value={quickRole}
                    onChange={(e) => setQuickRole(e.target.value)}
                    placeholder="e.g. Video Editing + Motion Graphics"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#03030F] border border-white/10 text-white"
                  />
                </div>
                <div className="sm:col-span-2 flex items-end gap-3">
                  <div className="flex-1">
                    <label className="block text-[#CBD5E1] mb-1">Short Description (Optional)</label>
                    <input
                      type="text"
                      value={quickDesc}
                      onChange={(e) => setQuickDesc(e.target.value)}
                      placeholder="Brief description of the project"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-[#03030F] border border-white/10 text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#00D2FF] text-[#03030F] font-semibold hover:bg-[#33DBFF] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Generate Card
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Category & Platform Filter Bar */}
          <div
            role="tablist"
            aria-label="Filter portfolio projects"
            className="flex items-center gap-1.5 p-1.5 bg-[#0B0D1E] border border-white/[0.07] rounded-xl overflow-x-auto"
          >
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter}
                onClick={() => {
                  setActiveFilter(filter);
                  onTrackPage('Work');
                }}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeFilter === filter
                    ? 'bg-[#00D2FF] text-[#03030F] font-semibold shadow-sm'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Empty State if a category has no items yet */}
          {filteredProjects.length === 0 && (
            <div className="p-12 rounded-2xl bg-[#0B0D1E] border border-white/[0.07] text-center space-y-3">
              <Film className="w-8 h-8 text-[#00D2FF] mx-auto" />
              <h3 className="text-base font-semibold text-white">
                No projects in "{activeFilter}" yet
              </h3>
              <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                Click "Quick Add Video URL" above or use the Admin Dashboard to add a project to{' '}
                {activeFilter}.
              </p>
              <button
                type="button"
                onClick={() => setActiveFilter('All')}
                className="px-4 py-2 rounded-lg bg-white/10 text-xs text-white hover:bg-white/15 cursor-pointer"
              >
                Show All Projects
              </button>
            </div>
          )}

          {/* 16:9 Widescreen Video Projects Grid */}
          {standardVideos.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {standardVideos.map((proj) => {
                const thumbSrc = getThumbnailSrc(proj);
                const displayTitle = getDisplayTitle(proj);
                const displayChannel = getDisplayChannel(proj);

                return (
                  <article
                    key={proj.id}
                    className="group bg-[#0B0D1E] border border-white/[0.08] hover:border-[#00D2FF]/40 rounded-2xl overflow-hidden transition-colors flex flex-col justify-between"
                  >
                    {/* 16:9 Media Container */}
                    <div
                      onClick={() => setActiveModalProject(proj)}
                      className="relative aspect-video bg-[#050714] overflow-hidden cursor-pointer"
                    >
                      {thumbSrc ? (
                        <img
                          src={thumbSrc}
                          alt={displayTitle}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() => handleImageError(proj.id)}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0B0D1E] via-[#0F172A] to-[#03030F] p-6 text-center">
                          <Film className="w-10 h-10 text-[#00D2FF]/60 mb-2" />
                          <span className="text-sm font-medium text-white/80">{displayTitle}</span>
                        </div>
                      )}

                      {/* Measured Contrast Scrim + Play Trigger */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent opacity-80 group-hover:opacity-95 transition-opacity flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-[#00D2FF]/90 text-[#03030F] flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-110">
                          <Play className="w-6 h-6 fill-current ml-0.5" />
                        </div>
                      </div>
                    </div>

                    {/* Card Details */}
                    <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[#94A3B8]">
                          <span className="text-[#00D2FF] font-medium">{proj.platform}</span>
                          <span aria-hidden="true">·</span>
                          <span>{proj.category}</span>
                          {displayChannel && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-[#CBD5E1]">{displayChannel}</span>
                            </>
                          )}
                          {proj.role && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>Role: {proj.role}</span>
                            </>
                          )}
                        </div>

                        <h3 className="text-lg font-bold text-white leading-snug">{displayTitle}</h3>

                        {proj.description && (
                          <p className="text-xs text-[#94A3B8] leading-relaxed">
                            {proj.description}
                          </p>
                        )}
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setActiveModalProject(proj)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00D2FF] hover:text-[#33DBFF] transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play in Studio Viewer</span>
                        </button>

                        <a
                          href={proj.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white transition-colors whitespace-nowrap"
                        >
                          <span>Watch Video</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {/* 9:16 Portrait-Friendly YouTube Shorts Layout */}
          {shortVideos.length > 0 && (
            <div className="space-y-6 pt-4">
              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
                <h3 className="text-lg font-bold text-white">
                  YouTube Shorts &amp; Vertical Edits
                </h3>
                <span className="text-xs text-[#94A3B8] font-mono">9:16 Vertical Format</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {shortVideos.map((proj) => {
                  const thumbSrc = getThumbnailSrc(proj);
                  const displayTitle = getDisplayTitle(proj);
                  const displayChannel = getDisplayChannel(proj);

                  return (
                    <article
                      key={proj.id}
                      className="group bg-[#0B0D1E] border border-white/[0.08] hover:border-[#00D2FF]/40 rounded-2xl overflow-hidden transition-colors flex flex-col justify-between"
                    >
                      {/* Portrait 9:16 Media Container */}
                      <div
                        onClick={() => setActiveModalProject(proj)}
                        className="relative aspect-[9/14] bg-[#050714] overflow-hidden cursor-pointer"
                      >
                        {thumbSrc ? (
                          <img
                            src={thumbSrc}
                            alt={displayTitle}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={() => handleImageError(proj.id)}
                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-[#0B0D1E] to-[#03030F] p-6 text-center">
                            <Film className="w-10 h-10 text-[#00D2FF]/60 mb-2" />
                            <span className="text-sm font-medium text-white/80">{displayTitle}</span>
                          </div>
                        )}

                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent flex flex-col justify-end p-5">
                          <div className="w-12 h-12 rounded-full bg-[#00D2FF]/90 text-[#03030F] flex items-center justify-center shadow-lg mb-auto mt-auto mx-auto transition-transform duration-200 group-hover:scale-110">
                            <Play className="w-5 h-5 fill-current ml-0.5" />
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#CBD5E1]">
                              <span className="text-[#00D2FF] font-medium">{proj.platform}</span>
                              <span aria-hidden="true">·</span>
                              <span>{proj.category}</span>
                            </div>
                            <h4 className="text-base font-bold text-white leading-snug">
                              {displayTitle}
                            </h4>
                            {displayChannel && (
                              <div className="text-xs text-[#94A3B8]">{displayChannel}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="p-4 flex items-center justify-between gap-3 bg-[#0B0D1E] border-t border-white/[0.06]">
                        <button
                          type="button"
                          onClick={() => setActiveModalProject(proj)}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00D2FF] hover:text-[#33DBFF] whitespace-nowrap cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Short</span>
                        </button>
                        <a
                          href={proj.videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-white transition-colors whitespace-nowrap"
                        >
                          <span>Watch Video</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* SECTION 6: DEDICATED VIDEO SHOWCASE SECTION */}
      <section id="video-showcase" className="py-24 border-t border-white/[0.07] bg-[#050614]/60">
        <div className="max-w-[1200px] mx-auto px-6 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="text-xs font-mono tracking-wider text-[#7AA2F7]">
                03. Multi-Platform Reel
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white [text-wrap:balance]">
                Video Showcase
              </h2>
              <p className="text-[#94A3B8] text-base max-w-xl">
                Filter across YouTube, YouTube Shorts, Facebook, Instagram, TikTok, Motion Graphics,
                and Editing projects.
              </p>
            </div>

            {/* Video Showcase Filter Bar */}
            <div className="flex items-center gap-1 p-1 bg-[#0B0D1E] border border-white/[0.07] rounded-xl overflow-x-auto">
              {SHOWCASE_FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setShowcaseFilter(f);
                    onTrackPage('Video Showcase');
                  }}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    showcaseFilter === f
                      ? 'bg-[#7AA2F7] text-[#03030F] font-semibold'
                      : 'text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShowcase.map((proj) => {
              const thumbSrc = getThumbnailSrc(proj);
              const displayTitle = getDisplayTitle(proj);
              const displayChannel = getDisplayChannel(proj);

              return (
                <div
                  key={`showcase-${proj.id}`}
                  className="group bg-[#0B0D1E] border border-white/[0.07] hover:border-[#7AA2F7]/40 rounded-2xl overflow-hidden flex flex-col justify-between transition-colors"
                >
                  <div
                    onClick={() => setActiveModalProject(proj)}
                    className="relative aspect-video bg-[#03030F] overflow-hidden cursor-pointer"
                  >
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={displayTitle}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={() => handleImageError(proj.id)}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#080A18]">
                        <Film className="w-8 h-8 text-[#7AA2F7]/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/25 transition-colors flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-white/90 text-[#03030F] flex items-center justify-center transition-transform duration-200 group-hover:scale-110">
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      </div>
                    </div>
                  </div>

                  <div className="p-5 space-y-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-[#94A3B8]">
                      <span className="text-[#7AA2F7] font-medium">{proj.platform}</span>
                      <span aria-hidden="true">·</span>
                      <span>{proj.category}</span>
                      {displayChannel && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate max-w-[140px]">{displayChannel}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-white line-clamp-1">{displayTitle}</h3>
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                      <button
                        type="button"
                        onClick={() => setActiveModalProject(proj)}
                        className="text-xs font-medium text-[#00D2FF] hover:underline cursor-pointer"
                      >
                        Play Embed
                      </button>
                      <a
                        href={proj.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#CBD5E1] hover:text-white"
                      >
                        <span>Watch Video</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FULLSCREEN LIGHTBOX / VIDEO PLAYER MODAL */}
      {activeModalProject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
          onClick={() => setActiveModalProject(null)}
        >
          <div
            className={`relative w-full ${
              activeModalProject.isShort ? 'max-w-md' : 'max-w-4xl'
            } bg-[#0B0D1E] border border-white/15 rounded-2xl overflow-hidden shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-[#03030F]">
              <div className="flex items-center gap-3 min-w-0 pr-4">
                <BrandLogo size="sm" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-white truncate">
                    {getDisplayTitle(activeModalProject)}
                  </h3>
                  <div className="text-xs text-[#94A3B8]">
                    {activeModalProject.platform} · {activeModalProject.category}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={activeModalProject.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00D2FF] text-[#03030F] text-xs font-semibold hover:bg-[#33DBFF] whitespace-nowrap"
                >
                  <span>Watch on {activeModalProject.platform}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveModalProject(null)}
                  className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 cursor-pointer"
                  aria-label="Close Video Player"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Video Player Container */}
            <div
              className={`w-full bg-black ${
                activeModalProject.isShort ? 'aspect-[9/16] max-h-[75vh]' : 'aspect-video'
              }`}
            >
              {parseVideoUrl(activeModalProject.videoUrl).embedUrl ? (
                <iframe
                  src={parseVideoUrl(activeModalProject.videoUrl).embedUrl}
                  title={getDisplayTitle(activeModalProject)}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <BrandLogo size="lg" />
                  <p className="text-sm text-[#CBD5E1]">
                    Direct embedding is restricted for this source. Click below to watch the original
                    video directly.
                  </p>
                  <a
                    href={activeModalProject.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00D2FF] text-[#03030F] font-semibold text-sm"
                  >
                    <span>Watch Video</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
