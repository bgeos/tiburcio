"use client";

import { useState } from "react";
import { Bug } from "lucide-react";
import { Button } from "@/components/ui/button";

function Thrower(): never {
  throw new Error("Demo render error from /design/states/error");
}

export function ErrorTrigger() {
  const [shouldThrow, setShouldThrow] = useState(false);

  return (
    <>
      {shouldThrow ? <Thrower /> : null}
      <Button variant="destructive" className="w-fit" onClick={() => setShouldThrow(true)}>
        <Bug aria-hidden="true" />
        Throw a render error
      </Button>
    </>
  );
}
