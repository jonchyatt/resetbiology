import type { Metadata } from "next";
import './breath.css';

export const metadata: Metadata = {
  title: "Breath Training - Reset Biology Portal",
  description: "Master your nervous system through guided breathing exercises. Enhance your metabolic reset with precision breath training.",
};

export default function BreathLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="breath-page min-h-screen">
      {children}
    </div>
  );
}