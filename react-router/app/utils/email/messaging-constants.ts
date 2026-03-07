export const BROADCAST_STATUS_COLORS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  DRAFT: "secondary",
  SCHEDULED: "outline",
  SENDING: "default",
  SENT: "outline",
  CANCELLED: "destructive",
  FAILED: "destructive",
};

export const CHANNEL_COLORS: Record<string, string> = {
  EMAIL: "bg-blue-100 text-blue-800",
  SMS: "bg-green-100 text-green-800",
  PUSH: "bg-orange-100 text-orange-800",
  IN_APP: "bg-purple-100 text-purple-800",
};
