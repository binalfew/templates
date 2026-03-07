import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate } from "react-router";
import {
  Loader2,
  Search,
  Settings,
  Users,
  Clock,
  ArrowRight,
  LayoutDashboard,
  Shield,
  KeyRound,
  ClipboardList,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { Badge } from "~/components/ui/badge";

// ─── Types ───────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePrefix?: string;
}

interface SearchResultItem {
  id: string;
  category: "action" | "recent" | "result";
  label: string;
  description?: string;
  href: string;
  icon: React.ReactNode;
  entityType?: string;
}

// ─── Constants ───────────────────────────────────────────

const RECENT_SEARCHES_KEY = "global-search-recent";
const MAX_RECENT = 5;

const ENTITY_CONFIG: Record<
  string,
  { icon: typeof Users; label: string; colorClass: string }
> = {
  User: { icon: Users, label: "User", colorClass: "bg-blue-100 text-blue-800" },
  Role: { icon: Shield, label: "Role", colorClass: "bg-purple-100 text-purple-800" },
  Permission: {
    icon: KeyRound,
    label: "Permission",
    colorClass: "bg-amber-100 text-amber-800",
  },
  AuditLog: {
    icon: ClipboardList,
    label: "Log",
    colorClass: "bg-slate-100 text-slate-800",
  },
};

function buildQuickActions(basePrefix: string): SearchResultItem[] {
  return [
    {
      id: "action-dashboard",
      category: "action",
      label: "Go to Dashboard",
      href: basePrefix,
      icon: <LayoutDashboard className="size-4" />,
    },
    {
      id: "action-users",
      category: "action",
      label: "Go to Users",
      href: `${basePrefix}/security/users`,
      icon: <Users className="size-4" />,
    },
    {
      id: "action-settings",
      category: "action",
      label: "Go to Settings",
      href: `${basePrefix}/settings`,
      icon: <Settings className="size-4" />,
    },
  ];
}

// ─── Helpers ─────────────────────────────────────────────

function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  try {
    const recent = getRecentSearches().filter((s) => s !== query);
    recent.unshift(query);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // localStorage may be unavailable
  }
}

function getEntityIcon(type: string) {
  const config = ENTITY_CONFIG[type];
  if (!config) return <Search className="size-4" />;
  const Icon = config.icon;
  return <Icon className="size-4" />;
}

// ─── Component ───────────────────────────────────────────

export function CommandPalette({ open, onOpenChange, basePrefix = "/admin" }: CommandPaletteProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const fetcher = useFetcher();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const loading = fetcher.state === "loading";
  const searchData = fetcher.data;

  // Map API results to display items with entity-specific icons
  const results: SearchResultItem[] =
    searchData?.results?.results?.map((r: any) => ({
      id: r.id,
      category: "result" as const,
      label: r.title,
      description: r.subtitle,
      href: `${basePrefix}/${r.url}`,
      icon: getEntityIcon(r.type),
      entityType: r.type,
    })) ?? [];

  // Group results by entity type for display
  const groupedResults: { type: string; items: SearchResultItem[] }[] = [];
  const entityOrder = ["User", "Role", "Permission", "AuditLog"];
  for (const type of entityOrder) {
    const items = results.filter((r) => r.entityType === type);
    if (items.length > 0) {
      groupedResults.push({ type, items });
    }
  }

  // Flat list of all selectable items for keyboard navigation
  const flatResults = groupedResults.flatMap((g) => g.items);
  const quickActions = buildQuickActions(basePrefix);
  const showResults = query.length >= 2;
  const displayItems = showResults ? flatResults : quickActions;

  // Load recent searches when dialog opens
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches());
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const handleInputChange = (value: string) => {
    setQuery(value);
    setSelectedIndex(0);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        fetcher.load(`${basePrefix}/search?q=${encodeURIComponent(value.trim())}`);
      }, 300);
    }
  };

  const selectItem = (item: SearchResultItem) => {
    if (query.trim().length >= 2) {
      addRecentSearch(query.trim());
    }
    onOpenChange(false);
    navigate(item.href);
  };

  const handleRecentClick = (recent: string) => {
    setQuery(recent);
    handleInputChange(recent);
  };

  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-result-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault();
        setSelectedIndex((i) => (i < displayItems.length - 1 ? i + 1 : 0));
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        setSelectedIndex((i) => (i > 0 ? i - 1 : displayItems.length - 1));
        break;
      }
      case "Enter": {
        e.preventDefault();
        const item = displayItems[selectedIndex];
        if (item) selectItem(item);
        break;
      }
    }
  };

  // Track running index for grouped results (keyboard selection)
  let runningIndex = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        onKeyDown={handleKeyDown}
      >
        <DialogTitle className="sr-only">Search</DialogTitle>

        {/* Search input */}
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Search or jump to..."
            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          {loading && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
        </div>

        {/* Results area */}
        <div ref={listRef} className="max-h-[300px] overflow-y-auto p-2">
          {/* Recent searches (when query is empty) */}
          {!showResults && recentSearches.length > 0 && (
            <div className="mb-2">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                <Clock className="size-3" />
                Recent Searches
              </div>
              {recentSearches.map((recent) => (
                <button
                  key={recent}
                  type="button"
                  onClick={() => handleRecentClick(recent)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Search className="size-3 text-muted-foreground" />
                  <span>{recent}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick actions */}
          {!showResults && (
            <div>
              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                Quick Actions
              </div>
              {quickActions.map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  data-result-item
                  onClick={() => selectItem(action)}
                  className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
                    selectedIndex === index ? "bg-accent text-accent-foreground" : "hover:bg-accent"
                  }`}
                >
                  <span className="text-muted-foreground">{action.icon}</span>
                  <span className="flex-1 text-left">{action.label}</span>
                  <ArrowRight className="size-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}

          {/* Grouped search results */}
          {showResults &&
            groupedResults.length > 0 &&
            groupedResults.map((group) => {
              const config = ENTITY_CONFIG[group.type];
              const GroupIcon = config?.icon ?? Search;
              const items = group.items;

              return (
                <div key={group.type} className="mb-1">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                    <GroupIcon className="size-3" />
                    {config?.label ?? group.type}s
                    <Badge variant="outline" className="ml-auto h-4 px-1 text-[10px]">
                      {items.length}
                    </Badge>
                  </div>
                  {items.map((item) => {
                    const idx = runningIndex++;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-result-item
                        onClick={() => selectItem(item)}
                        className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
                          selectedIndex === idx
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        <span className="text-muted-foreground">{item.icon}</span>
                        <span className="flex-1 min-w-0 text-left">
                          <span className="font-medium truncate">{item.label}</span>
                          {item.description && (
                            <span className="ml-2 text-xs text-muted-foreground truncate">
                              {item.description}
                            </span>
                          )}
                        </span>
                        <Badge
                          className={`shrink-0 text-[10px] ${config?.colorClass ?? ""}`}
                        >
                          {config?.label ?? item.entityType}
                        </Badge>
                      </button>
                    );
                  })}
                </div>
              );
            })}

          {/* Empty state */}
          {showResults && !loading && results.length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
          <div className="flex gap-2">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
            <span>Navigate</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
            <span>Open</span>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
            <span>Close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
