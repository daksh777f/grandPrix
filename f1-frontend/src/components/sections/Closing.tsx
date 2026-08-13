

export function Closing() {
  return (
    <>
      <section className="relative w-full bg-brand-red text-ink overflow-hidden pt-32 pb-64">
        {/* The video with top gradient blend */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-brand-red via-brand-red/80 to-transparent z-10" />
          <video
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover opacity-60"
            src="https://videos.pexels.com/video-files/856148/856148-hd_1920_1080_30fps.mp4"
            // Fallback stock video; swap with track-video_2 when available
          />
        </div>

        <div className="relative z-20 max-w-4xl mx-auto px-6 text-center flex flex-col items-center">
          <h2 className="font-display font-bold text-4xl md:text-6xl tracking-wide uppercase mb-12">
            The Silent <span className="text-asphalt">Co-Driver</span>
          </h2>

          <div className="space-y-6 font-display text-2xl md:text-4xl font-medium leading-tight">
            <p>
              We built this to prove that telemetry isn't just numbers on a screen.
              It's human emotion, pressure, and breaking points.
            </p>
            <p className="text-asphalt font-bold">
              No warning sign goes unheard.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
