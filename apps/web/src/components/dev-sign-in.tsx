import { Button } from "@mostly/ui/components/button";
import { useEffect, useState } from "react";

import { ENV } from "@/env.public";

interface DevAuthStatus {
  enabled: boolean;
  account: {
    email: string;
    name: string;
  } | null;
  googleEnabled: boolean;
}

interface DevSignInProps {
  disabled: boolean;
  onError: (message: string | null) => void;
}

const serverBaseUrl = () => ENV.VITE_SERVER_URL.replace(/\/$/u, "");

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { message?: unknown };
    if (typeof payload.message === "string" && payload.message.length > 0) {
      return payload.message;
    }
  } catch {
    // Non-JSON error bodies fall back to a generic status message.
  }
  return `Could not sign in with local dev account (${response.status}).`;
};

const DevSignIn = ({ disabled, onError }: DevSignInProps) => {
  const [status, setStatus] = useState<DevAuthStatus | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadStatus = async () => {
      try {
        const response = await fetch(`${serverBaseUrl()}/api/auth/dev/status`, {
          credentials: "include",
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as DevAuthStatus;
        if (!controller.signal.aborted) {
          setStatus(data);
        }
      } catch {
        // Ignore abort/network errors; Google sign-in remains available.
      }
    };

    void loadStatus();
    return () => {
      controller.abort();
    };
  }, []);

  if (!(status?.enabled && status.account)) {
    return null;
  }

  const handleDevSignIn = async () => {
    setSigningIn(true);
    onError(null);

    try {
      const response = await fetch(`${serverBaseUrl()}/api/auth/dev/sign-in`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: "{}",
      });

      if (!response.ok) {
        onError(await readErrorMessage(response));
        setSigningIn(false);
        return;
      }

      window.location.assign("/today");
    } catch (error) {
      setSigningIn(false);
      onError(error instanceof Error ? error.message : "Could not sign in with local dev account.");
    }
  };

  return (
    <div className="grid justify-items-center gap-1.5">
      <Button
        type="button"
        variant="secondary"
        className="min-h-11 rounded-full px-5 text-sm"
        disabled={disabled || signingIn}
        data-testid="dev-sign-in-button"
        onClick={handleDevSignIn}
      >
        {signingIn ? "Signing in…" : `Continue as ${status.account.name}`}
      </Button>
      <p className="text-muted-foreground text-xs">Local dev account · {status.account.email}</p>
    </div>
  );
};

export default DevSignIn;
