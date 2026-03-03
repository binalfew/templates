import { useMemo, useState } from "react";
import { Form, Link, useMatches, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LogOut, Search, User } from "lucide-react";
import { CommandPalette } from "~/components/layout/command-palette";
import { ShortcutHelp } from "~/components/layout/shortcut-help";
import {
  useKeyboardShortcuts,
  getShortcutInfo,
  type ShortcutDefinition,
} from "~/lib/use-keyboard-shortcuts";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";
import { Avatar, AvatarImage, AvatarFallback } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { NotificationBell } from "~/components/notification-bell";
import { OfflineIndicator } from "~/components/offline-indicator";
import { LanguageSwitcher } from "~/components/layout/language-switcher";
import { ThemeSwitch } from "~/routes/resources/theme-switch";
import type { Theme } from "~/lib/theme.server";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

type TopNavbarProps = {
  user: { id: string; name: string | null; email: string; photoUrl?: string | null };
  basePrefix?: string;
  theme?: Theme | null;
  notificationsEnabled?: boolean;
  unreadCount?: number;
  notifications?: NotificationItem[];
  searchEnabled?: boolean;
  shortcutsEnabled?: boolean;
  i18nEnabled?: boolean;
  offlineEnabled?: boolean;
};

type BreadcrumbEntry = {
  label: string;
  to?: string;
};

function useBreadcrumbs(): BreadcrumbEntry[] {
  const matches = useMatches();

  const crumbs: BreadcrumbEntry[] = [];
  for (const match of matches) {
    const handle = match.handle as { breadcrumb?: string } | undefined;
    if (handle?.breadcrumb) {
      crumbs.push({
        label: handle.breadcrumb,
        to: match.pathname,
      });
    }
  }

  return crumbs;
}

function getUserInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export function TopNavbar({
  user,
  basePrefix = "/admin",
  theme,
  notificationsEnabled = false,
  unreadCount = 0,
  notifications = [],
  searchEnabled = false,
  shortcutsEnabled = false,
  i18nEnabled = false,
  offlineEnabled = false,
}: TopNavbarProps) {
  const breadcrumbs = useBreadcrumbs();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const [searchOpen, setSearchOpen] = useState(false);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);

  // Build shortcut definitions
  const shortcuts = useMemo<ShortcutDefinition[]>(() => {
    const defs: ShortcutDefinition[] = [];

    if (searchEnabled) {
      defs.push({
        id: "search",
        keys: "⌘ K",
        description: "Open command palette",
        group: "global",
        key: "k",
        mod: true,
        handler: () => setSearchOpen((o) => !o),
      });
    }

    defs.push({
      id: "help",
      keys: "?",
      description: "Show keyboard shortcuts",
      group: "global",
      key: "?",
      handler: () => setShortcutHelpOpen((o) => !o),
    });

    defs.push(
      {
        id: "nav-dashboard",
        keys: "g then d",
        description: "Go to Dashboard",
        group: "navigation",
        key: ["g", "d"],
        handler: () => navigate(basePrefix),
      },
      {
        id: "nav-users",
        keys: "g then u",
        description: "Go to Users",
        group: "navigation",
        key: ["g", "u"],
        handler: () => navigate(`${basePrefix}/users`),
      },
      {
        id: "nav-settings",
        keys: "g then s",
        description: "Go to Settings",
        group: "navigation",
        key: ["g", "s"],
        handler: () => navigate(`${basePrefix}/settings`),
      },
    );

    return defs;
  }, [searchEnabled, navigate, basePrefix]);

  useKeyboardShortcuts(shortcuts, {
    enabled: searchEnabled || shortcutsEnabled,
  });

  const shortcutInfoList = useMemo(() => getShortcutInfo(shortcuts), [shortcuts]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b bg-primary text-primary-foreground">
      <div className="flex flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4 bg-primary-foreground/30"
        />
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList className="text-primary-foreground/70">
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <BreadcrumbItem key={crumb.to ?? crumb.label}>
                  {index > 0 && <BreadcrumbSeparator />}
                  {isLast ? (
                    <BreadcrumbPage className="text-primary-foreground">
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild className="hover:text-primary-foreground">
                      <Link to={crumb.to!}>{crumb.label}</Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="flex items-center gap-1 px-2 sm:gap-2 sm:px-4 [&_button]:text-primary-foreground [&_button:hover]:bg-primary-foreground/10 [&_button:hover]:text-primary-foreground">
        {searchEnabled ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground md:hidden"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
            >
              <Search className="size-4" />
            </Button>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="hidden cursor-pointer items-center gap-2 rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 text-sm text-primary-foreground/70 transition-colors hover:bg-primary-foreground/20 md:flex"
            >
              <Search className="size-4" />
              <span>{t("search")}</span>
              <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/70">
                <span className="text-xs">&#8984;</span>K
              </kbd>
            </button>
          </>
        ) : (
          <div className="hidden items-center gap-2 rounded-md border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-1.5 text-sm text-primary-foreground/70 md:flex">
            <Search className="size-4" />
            <span>Search...</span>
            <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 font-mono text-[10px] font-medium text-primary-foreground/70">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </div>
        )}

        {i18nEnabled && (
          <div className="hidden sm:flex">
            <LanguageSwitcher />
          </div>
        )}

        <ThemeSwitch userPreference={theme} />

        {/* Offline indicator */}
        {offlineEnabled && <OfflineIndicator />}

        {/* Notifications */}
        <NotificationBell
          unreadCount={unreadCount}
          notifications={notifications}
          enabled={notificationsEnabled}
          basePrefix={basePrefix}
        />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 rounded-full hover:bg-primary-foreground/10"
            >
              <Avatar className="size-8 border border-primary-foreground/30">
                {user.photoUrl && <AvatarImage src={user.photoUrl} alt={user.name ?? user.email} />}
                <AvatarFallback className="bg-primary-foreground/10 text-primary-foreground text-xs">
                  {getUserInitials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user.name ?? user.email}</p>
                <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to={`${basePrefix}/profile`}>
                <User />
                {t("profile")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <Form method="post" action="/auth/logout">
              <DropdownMenuItem asChild>
                <button type="submit" className="w-full">
                  <LogOut />
                  {t("signOut")}
                </button>
              </DropdownMenuItem>
            </Form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {searchEnabled && (
        <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} basePrefix={basePrefix} />
      )}
      <ShortcutHelp
        open={shortcutHelpOpen}
        onOpenChange={setShortcutHelpOpen}
        shortcuts={shortcutInfoList}
      />
    </header>
  );
}
