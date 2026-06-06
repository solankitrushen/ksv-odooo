"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  useActivateStore,
  useDeactivateStore,
  useVerifyStore,
} from "@/hooks/use-stores";
import type { Store } from "@/lib/api-types";
import { CheckCircle, Power, PowerOff } from "lucide-react";

interface Props {
  store: Pick<Store, "_id" | "isActive" | "isVerified">;
  variant?: "compact" | "full";
}

export function StoreActions({ store, variant = "full" }: Props) {
  const verify = useVerifyStore();
  const deactivate = useDeactivateStore();
  const activate = useActivateStore();

  const showVerify = !store.isVerified;
  const showDeactivate = store.isActive;
  const showActivate = !store.isActive;

  if (!showVerify && !showDeactivate && !showActivate) {
    return (
      <span className="text-xs text-muted-foreground">No actions</span>
    );
  }

  const size = variant === "compact" ? "sm" : "default";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showVerify && (
        <Button
          disabled={verify.isPending}
          onClick={() => verify.mutate(store._id)}
          size={size}
          variant="outline"
        >
          <CheckCircle className="h-4 w-4" />
          Verify
        </Button>
      )}

      {showActivate && (
        <Button
          disabled={activate.isPending}
          onClick={() => activate.mutate(store._id)}
          size={size}
          variant="outline"
        >
          <Power className="h-4 w-4" />
          Activate
        </Button>
      )}

      {showDeactivate && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              disabled={deactivate.isPending}
              size={size}
              variant="destructive"
            >
              <PowerOff className="h-4 w-4" />
              Deactivate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Deactivate this store?</AlertDialogTitle>
              <AlertDialogDescription>
                The store owner will lose access immediately. You can
                reactivate later from the backend.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deactivate.mutate(store._id)}
              >
                Deactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
