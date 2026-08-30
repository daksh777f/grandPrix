import { useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Loader } from '@/components/ui/Loader';
import { Navbar } from '@/components/ui/Navbar';
import { Home } from '@/pages/Home';
import { LiveIntelligencePage } from '@/pages/LiveIntelligencePage';
import { VoicePage } from '@/pages/VoicePage';
import { RaceTimelinePage } from '@/pages/RaceTimelinePage';
import { HistoryPage } from '@/pages/HistoryPage';

import { TyrePage } from '@/pages/TyrePage';

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
              <Route path="live" element={<LiveIntelligencePage />} />
              <Route path="tyres" element={<TyrePage />} />
              <Route path="voice" element={<VoicePage />} />
              <Route path="timeline" element={<RaceTimelinePage />} />
              <Route path="history" element={<HistoryPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
    </div>
  );
}

export default App;

