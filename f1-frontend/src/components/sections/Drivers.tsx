import { useState, useEffect } from 'react';
import { Users, X } from 'lucide-react';
import DriftWall from '@/components/ui/DriftWall';
import { AnimatePresence, motion } from 'motion/react';
import { fetchGrid, type Driver } from '@/lib/api';

export function Drivers() {
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [driversData, setDriversData] = useState<Driver[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadDrivers() {
      try {
        const data = await fetchGrid();
        setDriversData(data);
      } catch (err) {
        console.error("Failed to fetch drivers:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadDrivers();
  }, []);

  // Multiply drivers to fill the wall if needed
  const wallDrivers = driversData.length > 0
    ? [...driversData, ...driversData, ...driversData, ...driversData, ...driversData, ...driversData]
    : [];

  const items = wallDrivers.map((driver, index) => ({
    image: driver.headshot_url,
    title: driver.full_name,
    teamColour: driver.team_colour ? `#${driver.team_colour}` : undefined,
    id: `${driver.driver_number}-${index}`,
    onClick: () => setSelectedDriver(driver)
  }));

  return (
    <section id="drivers" className="py-32 bg-asphalt relative overflow-hidden">
      <div className="mb-16 max-w-7xl mx-auto px-6 text-center relative z-20">
        <h2 className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight text-ink mb-4 flex items-center justify-center gap-4">
          <Users className="w-8 h-8 text-chrome" />
          The Grid
        </h2>
        <p className="font-body text-xl text-ink-muted">
          20 drivers. 20 distinct race profiles.
        </p>
      </div>

      <div className="h-[600px] w-full relative">
        <div className="absolute inset-0 bg-gradient-to-b from-asphalt via-transparent to-asphalt z-10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-r from-asphalt via-transparent to-asphalt z-10 pointer-events-none" />
        {isLoading && (
          <div className="h-full flex items-center justify-center font-mono text-xs uppercase tracking-widest text-ink-muted">Loading grid data...</div>
        )}
        {!isLoading && items.length > 0 && (
          <DriftWall
            items={items}
            pauseOnHover={true}
            speed={0.5}
            columns={8}
            tileWidth={250}
            tileHeight={350}
            grayscale={true}
            dim={0.7}
          />
        )}
        {!isLoading && items.length === 0 && (
          <div className="h-full flex items-center justify-center font-mono text-xs uppercase tracking-widest text-ink-muted">Grid data unavailable</div>
        )}
      </div>

      {/* Driver Detail Modal */}
      <AnimatePresence>
        {selectedDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-asphalt/90 backdrop-blur-sm"
            onClick={() => setSelectedDriver(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-4xl bg-[#0b0b12] border border-chrome/20 rounded-2xl overflow-hidden flex flex-col md:flex-row shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedDriver(null)}
                className="absolute top-4 right-4 z-10 p-2 bg-asphalt/50 hover:bg-chrome/20 rounded-full text-ink transition-colors"
                aria-label="Close modal"
              >
                <X className="w-6 h-6" />
              </button>

              <div
                className="w-full md:w-1/2 h-[400px] md:h-[500px] relative overflow-hidden"
                style={{ backgroundColor: selectedDriver.team_colour ? `#${selectedDriver.team_colour}20` : '#1a1a24' }}
              >
                <img
                  src={selectedDriver.headshot_url}
                  alt={selectedDriver.full_name}
                  className="w-full h-full object-contain object-bottom"
                />
              </div>

              <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-4">
                  <span className="font-display text-5xl md:text-7xl font-black text-chrome/30">
                    {selectedDriver.driver_number}
                  </span>
                  <div
                    className="h-8 w-2 rounded-full"
                    style={{ backgroundColor: selectedDriver.team_colour ? `#${selectedDriver.team_colour}` : '#ffffff' }}
                  />
                </div>

                <h3 className="font-display text-4xl font-bold uppercase text-ink mb-2">
                  {selectedDriver.full_name}
                </h3>

                <p className="font-body text-xl text-ink-muted mb-6">
                  {selectedDriver.team_name}
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-chrome/10 pb-4">
                    <span className="text-chrome font-body uppercase text-sm tracking-wider">Country</span>
                    <span className="text-ink font-bold">{selectedDriver.country_code}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-chrome/10 pb-4">
                    <span className="text-chrome font-body uppercase text-sm tracking-wider">Team</span>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: selectedDriver.team_colour ? `#${selectedDriver.team_colour}` : '#ffffff' }}
                      />
                      <span className="text-ink font-bold">{selectedDriver.team_name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
