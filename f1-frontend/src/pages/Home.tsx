import { Hero } from '@/components/sections/Hero';
import { CarHotspotInspector } from '@/components/sections/CarHotspotInspector';
import { MissionStrip } from '@/components/sections/MissionStrip';
import { Drivers } from '@/components/sections/Drivers';
import { RaceReplay } from '@/components/sections/RaceReplay';
import { VoiceFeature } from '@/components/sections/VoiceFeature';

export function Home() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-asphalt">
      <Hero />
      <div id="inspector">
        <CarHotspotInspector />
      </div>
      <MissionStrip />
      <div id="voice">
        <VoiceFeature />
      </div>
      <div id="replay">
        <RaceReplay />
      </div>
      <div id="drivers">
        <Drivers />
      </div>
    </div>
  );
}
