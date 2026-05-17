"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Filter, ArrowUpDown, Users, Grid3x3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CreateLeadButton } from "@/components/pipeline/create-lead-button";

export function PipelineToolbar({ mine }: { mine: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleMine = () => {
    const params = new URLSearchParams(searchParams.toString());
    if (mine) {
      params.delete("mine");
    } else {
      params.set("mine", "true");
    }
    const qs = params.toString();
    router.push(qs ? `/pipeline?${qs}` : "/pipeline");
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="inline-flex items-center bg-card border border-border rounded-lg p-0.5">
        <button
          className={`h-7 w-8 grid place-items-center rounded-md bg-foreground text-background`}
        >
          <Grid3x3 className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleMine}
        data-active={mine}
        className={mine ? "bg-foreground text-background hover:bg-foreground hover:text-background" : ""}
      >
        <Users className="size-3.5" /> {mine ? "Mine" : "All"}
      </Button>
      <Button variant="outline" size="sm">
        <Filter className="size-3.5" /> Filter
      </Button>
      <Button variant="outline" size="sm">
        <ArrowUpDown className="size-3.5" /> Sort
      </Button>
      <CreateLeadButton />
    </div>
  );
}
