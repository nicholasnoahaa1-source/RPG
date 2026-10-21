"use client";

import dynamic from "next/dynamic";

const Workstation = dynamic(() => import("./Workstation"), { ssr: false });

export default function Client() {
  return <Workstation />;
}
