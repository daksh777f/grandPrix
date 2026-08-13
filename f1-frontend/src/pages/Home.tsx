import { Hero } from '@/components/sections/Hero';
import { MissionStrip } from '@/components/sections/MissionStrip';
import { VoiceFeature } from '@/components/sections/VoiceFeature';
import { RaceReplay } from '@/components/sections/RaceReplay';
import { Drivers } from '@/components/sections/Drivers';
import { Montage } from '@/components/sections/Montage';
import { Closing } from '@/components/sections/Closing';
import { Footer } from '@/components/sections/Footer';

export function Home() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-asphalt">
      <Hero />
      <MissionStrip />
      <VoiceFeature />
      <RaceReplay />
      <Drivers />
      <Montage />
      <Closing />
      <Footer />
    </div>
  );
}
