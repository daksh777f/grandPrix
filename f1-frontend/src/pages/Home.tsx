import { Hero } from '@/components/sections/Hero';
import { MissionStrip } from '@/components/sections/MissionStrip';
import { Closing } from '@/components/sections/Closing';
import { Footer } from '@/components/sections/Footer';

export function Home() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-asphalt">
      <Hero />
      <MissionStrip />
      <Closing />
      <Footer />
    </div>
  );
}

