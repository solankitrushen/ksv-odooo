"use client";

import { RfqWizard } from "@/components/features/vb/rfq-wizard";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/contexts/page-title-context";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function NewRfqPage() {
  const { setPageTitle } = usePageTitle();

  useEffect(() => {
    setPageTitle({
      description: "Define items, assign vendors, and publish",
      title: "Create RFQ",
    });
    return () => setPageTitle(null);
  }, [setPageTitle]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/rfqs">
        <Button size="sm" variant="ghost">
          <ArrowLeft className="h-4 w-4" />
          Back to RFQs
        </Button>
      </Link>
      <RfqWizard />
    </div>
  );
}
