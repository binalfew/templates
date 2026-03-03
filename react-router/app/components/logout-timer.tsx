import { useCallback, useEffect, useRef, useState } from "react";
import { Form, useLocation, useSubmit } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";

export function LogoutTimer({ inactivityTimeoutMinutes }: { inactivityTimeoutMinutes: number }) {
  const [status, setStatus] = useState<"idle" | "show-modal">("idle");
  const location = useLocation();
  const submit = useSubmit();

  const logoutTime = 1000 * 60 * inactivityTimeoutMinutes;
  // Show modal 2 minutes before logout (or immediately if timeout < 2 minutes)
  const modalTime = Math.max(0, logoutTime - 1000 * 60 * 2);

  const modalTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const logoutTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const countdownTimer = useRef<ReturnType<typeof setInterval>>(undefined);

  const startCountdown = useCallback(() => {
    const remaining = Math.min(120, inactivityTimeoutMinutes * 60);
    setTimeLeft(remaining);
    countdownTimer.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimer.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [inactivityTimeoutMinutes]);

  useEffect(() => {
    if (status === "show-modal") {
      startCountdown();
    } else {
      clearInterval(countdownTimer.current);
    }
  }, [status, startCountdown]);

  const logout = useCallback(() => {
    submit(null, { method: "POST", action: "/auth/logout" });
  }, [submit]);

  const cleanupTimers = useCallback(() => {
    clearTimeout(modalTimer.current);
    clearTimeout(logoutTimer.current);
    clearInterval(countdownTimer.current);
  }, []);

  const resetTimers = useCallback(() => {
    cleanupTimers();
    setStatus("idle");
    modalTimer.current = setTimeout(() => {
      setStatus("show-modal");
    }, modalTime);
    logoutTimer.current = setTimeout(logout, logoutTime);
  }, [cleanupTimers, logout, logoutTime, modalTime]);

  // Reset timers on route navigation
  useEffect(() => resetTimers(), [resetTimers, location.key]);
  // Cleanup on unmount
  useEffect(() => cleanupTimers, [cleanupTimers]);

  function closeModal() {
    setStatus("idle");
    resetTimers();
  }

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const display = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <Dialog open={status === "show-modal"} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Are you still there?</DialogTitle>
          <DialogDescription>
            You will be logged out in <strong>{display}</strong> due to inactivity.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={closeModal}>
            Remain Logged In
          </Button>
          <Form method="POST" action="/auth/logout">
            <Button type="submit" variant="destructive">
              Logout
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
