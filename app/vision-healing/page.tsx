import { VisionHealing } from "@/components/Vision/VisionHealing";

export const metadata = {
  title: "Vision Healing | Reset Biology",
};

export default function VisionHealingPage() {
  return (
    <main
      className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 relative px-4 py-10 text-white md:px-10"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.7), rgba(0,0,0,0.8)), url(/hero-background.jpg)",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <div className="relative z-10 mx-auto max-w-6xl">
        <VisionHealing />
      </div>
    </main>
  );
}
