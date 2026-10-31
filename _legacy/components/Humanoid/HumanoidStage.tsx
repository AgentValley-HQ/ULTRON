"use client";

import dynamic from "next/dynamic";

const HumanoidClient = dynamic(() => import("./HumanoidClient"), {
  ssr: false,
  loading: () => null
});

export function HumanoidStage() {
  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center">
      <HumanoidClient />
    </div>
  );
}
