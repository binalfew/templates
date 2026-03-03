import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";
import { Badge } from "~/components/ui/badge";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <Badge variant="destructive" className="gap-1">
      <WifiOff className="size-3" />
      Offline
    </Badge>
  );
}
