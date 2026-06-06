"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateStoreCredentials } from "@/hooks/use-stores";
import { generateStrongPassword } from "@/lib/password-utils";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  storeId: string;
  currentEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoreCredentialsDialog({
  storeId,
  currentEmail,
  open,
  onOpenChange,
}: Props) {
  const [email, setEmail] = useState(currentEmail);
  const [password, setPassword] = useState("");
  const update = useUpdateStoreCredentials();

  const handleSubmit = async () => {
    const payload: { email?: string; password?: string } = {};
    if (email && email !== currentEmail) payload.email = email;
    if (password) payload.password = password;
    if (!payload.email && !payload.password) {
      toast.error("Change email or password to update");
      return;
    }
    await update.mutateAsync({ id: storeId, ...payload });
    setPassword("");
    onOpenChange(false);
  };

  const generate = () => {
    const pwd = generateStrongPassword(14);
    setPassword(pwd);
    navigator.clipboard.writeText(pwd);
    toast.success("Password generated and copied");
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change store credentials</DialogTitle>
          <DialogDescription>
            Changing the email will require re-verification. Share new
            credentials with the owner securely.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5 block" htmlFor="cred-email">
              Email
            </Label>
            <Input
              id="cred-email"
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              value={email}
            />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <Label htmlFor="cred-pw">New password (leave blank to keep)</Label>
              <Button
                onClick={generate}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Sparkles className="h-3 w-3" />
                Generate
              </Button>
            </div>
            <Input
              id="cred-pw"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 chars"
              type="text"
              value={password}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button disabled={update.isPending} onClick={handleSubmit}>
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
