import { useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Loader } from '@/components/ui/Loader';
import { Navbar } from '@/components/ui/Navbar';
import { Home } from '@/pages/Home';
import { VoiceFeature } from '@/components/sections/VoiceFeature';
import { RaceReplay } from '@/components/sections/RaceReplay';
import { Drivers } from '@/components/sections/Drivers';
import { HistoryPage } from './pages/HistoryPage';
import { MissionStrip } from '@/components/sections/MissionStrip';

function Layout() {
  return (
    <>
      <Navbar />
      <main>
        <Outlet />
      </main>
    </>
  );
}

function App() {
  const [loaderComplete, setLoaderComplete] = useState(false);

  return (
    <div className="min-h-screen bg-asphalt text-ink font-body selection:bg-brand-red/30 selection:text-ink overflow-x-hidden">
      {!loaderComplete && <Loader onComplete={() => setLoaderComplete(true)} />}
      
      {loaderComplete && (
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="voice" element={<><MissionStrip /><VoiceFeature /></>} />
              <Route path="replay" element={<RaceReplay />} />
              <Route path="drivers" element={<Drivers />} />
              <Route path="history" element={<HistoryPage />} />
              {/* Closing can be placed at the end of some pages if needed, but we'll leave it out for now as the user requested separate pages. Actually, let's keep it accessible or part of the layout? The user didn't specify. I'll put it on the replay page just for visual weight or remove it. Let's make an 'about' or 'closing' page, or just leave it. */}
            </Route>
          </Routes>
        </BrowserRouter>
      )}
    </div>
  );
}

export default App;
