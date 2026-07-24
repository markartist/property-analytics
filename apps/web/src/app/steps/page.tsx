import type { Metadata } from "next";
import { StepsExperience } from "@/components/freedom/steps-experience";

export const metadata: Metadata = {
  title: "Steps to Freedom in Christ",
  description: "A guided public rendering of the Steps to Freedom in Christ.",
  icons: {
    icon: [{ url: "/ficm-favicon.jpg", type: "image/jpeg", sizes: "250x250" }],
    apple: [{ url: "/ficm-favicon.jpg", type: "image/jpeg", sizes: "250x250" }],
  },
};

export default function StepsPage() {
  return <StepsExperience />;
}
