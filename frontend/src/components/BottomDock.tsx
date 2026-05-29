import { useEffect, useState } from "react";
import { Clock3, LogOut, MessageSquarePlus, PanelLeft, Settings } from "lucide-react";

type BottomDockProps = {
  onNewSession: () => void;
  onToggleSettings: () => void;
  onToggleSidebar: () => void;
  onLogout: () => void;
  showUsageInfo: boolean;
  usageOpacity: number;
  usageSimpleText: string;
  usageDetailText: string;
  usageCurrencyText: string;
};

const formatTime = (date: Date): string =>
  `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
const HOVER_MEDIA_QUERY = "(hover: hover) and (pointer: fine)";
const COMPACT_MEDIA_QUERY = "(max-width: 640px)";
const USAGE_VISIBILITY_THRESHOLD = 0.01;

export const BottomDock = ({
  onNewSession,
  onToggleSettings,
  onToggleSidebar,
  onLogout,
  showUsageInfo,
  usageOpacity,
  usageSimpleText,
  usageDetailText,
  usageCurrencyText,
}: BottomDockProps) => {
  const [timeText, setTimeText] = useState(() => formatTime(new Date()));
  const [usageExpanded, setUsageExpanded] = useState(false);
  const [hoverEnabled, setHoverEnabled] = useState(() => window.matchMedia(HOVER_MEDIA_QUERY).matches);
  const [isCompact, setIsCompact] = useState(() => window.matchMedia(COMPACT_MEDIA_QUERY).matches);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeText(formatTime(new Date()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(HOVER_MEDIA_QUERY);
    const onChange = () => setHoverEnabled(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_MEDIA_QUERY);
    const onChange = () => setIsCompact(mediaQuery.matches);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!showUsageInfo) {
      setUsageExpanded(false);
    }
  }, [showUsageInfo]);
  const usageVisible = usageOpacity > USAGE_VISIBILITY_THRESHOLD;

  useEffect(() => {
    if (!usageVisible) {
      setUsageExpanded(false);
    }
  }, [usageVisible]);

  return (
    <footer className="ba-dock">
      <div className="ba-dock-actions">
        <button type="button" onClick={onToggleSidebar}>
          <PanelLeft size={18} />
          <span>Chats</span>
        </button>
        <button type="button" onClick={onNewSession}>
          <MessageSquarePlus size={18} />
          <span>New</span>
        </button>
        <button type="button" onClick={onToggleSettings}>
          <Settings size={18} />
          <span>Settings</span>
        </button>
        <button type="button" onClick={onLogout}>
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>

      <div className={`ba-dock-meta ${showUsageInfo && !usageVisible ? "is-usage-collapsed" : ""}`}>
        {showUsageInfo ? (
          <button
            type="button"
            className={`ba-dock-usage ${usageExpanded ? "is-expanded" : ""} ${usageVisible ? "is-visible" : "is-collapsed"}`}
            style={{ opacity: usageOpacity, pointerEvents: usageVisible ? "auto" : "none" }}
            aria-label={usageExpanded ? (isCompact ? usageCurrencyText : usageDetailText) : usageSimpleText}
            aria-hidden={!usageVisible}
            tabIndex={usageVisible ? 0 : -1}
            onMouseEnter={() => {
              if (hoverEnabled) {
                setUsageExpanded(true);
              }
            }}
            onMouseLeave={() => {
              if (hoverEnabled) {
                setUsageExpanded(false);
              }
            }}
            onClick={() => setUsageExpanded((current) => !current)}
          >
            <span>{usageExpanded ? (isCompact ? usageCurrencyText : usageDetailText) : usageSimpleText}</span>
          </button>
        ) : null}
        <div className="ba-dock-time">
          <Clock3 size={14} />
          <span>{timeText}</span>
        </div>
      </div>
    </footer>
  );
};
