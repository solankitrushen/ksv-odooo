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
import {
  useSendStoreEmailOTP,
  useVerifyStoreEmailOTP,
} from "@/hooks/use-stores";
import { useState } from "react";

interface Props {
  storeId: string;
  storeEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StoreEmailVerifyDialog({
  storeId,
  storeEmail,
  open,
  onOpenChange,
}: Props) {
  const [otp, setOtp] = useState("");
  const send = useSendStoreEmailOTP();
  const verify = useVerifyStoreEmailOTP();

  const handleSend = () => send.mutate(storeId);

  const handleVerify = async () => {
    if (otp.length < 4) return;
    await verify.mutateAsync({ id: storeId, otp });
    setOtp("");
    onOpenChange(false);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify store email</DialogTitle>
          <DialogDescription>
            Send a 6-digit code to <span className="font-mono">{storeEmail}</span> and
            confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Button
            disabled={send.isPending}
            onClick={handleSend}
            variant="outline"
          >
            {send.isPending ? "Sending..." : "Send code"}
          </Button>
          <div>
            <Label className="mb-1.5 block" htmlFor="otp">
              6-digit code
            </Label>
            <Input
              id="otp"
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              value={otp}
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={otp.length !== 6 || verify.isPending}
            onClick={handleVerify}
          >
            {verify.isPending ? "Verifying..." : "Verify"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
