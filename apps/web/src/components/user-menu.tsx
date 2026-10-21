import { Button } from "@mostly/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@mostly/ui/components/dropdown-menu";
import { Skeleton } from "@mostly/ui/components/skeleton";

import { authClient } from "@/lib/auth-client";

type SessionUser = typeof authClient.$Infer.Session.user;

const Avatar = ({ user, name }: { user: SessionUser; name: string }) => {
  if (user.image) {
    return (
      <img
        src={user.image}
        alt=""
        className="border-border size-8 rounded-full border"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="bg-accent text-accent-foreground grid size-8 place-items-center rounded-full text-sm"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
};

const UserMenu = () => {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return <Skeleton className="size-8 rounded-full" />;
  }

  if (!session) {
    return null;
  }

  const { user } = session;
  const name = user.name || user.email;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="min-h-11 gap-2 rounded-full px-1.5"
          />
        }
        aria-label={`Account menu for ${name}`}
      >
        <Avatar user={user} name={name} />
        <span className="hidden max-w-32 truncate text-sm sm:inline">
          {name}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-card min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="text-foreground block truncate text-sm">
              {name}
            </span>
            <span className="block truncate">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="min-h-11 text-sm"
            onClick={() => window.location.assign("/account")}
          >
            Account and data
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
