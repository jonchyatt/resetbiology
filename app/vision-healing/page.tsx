import { VisionHealing } from "@/components/Vision/VisionHealing";

export const metadata = {
  title: "Vision Healing | Reset Biology",
};

export default function VisionHealingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-black px-4 py-10 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <VisionHealing />
      </div>
    </main>
  );
}
