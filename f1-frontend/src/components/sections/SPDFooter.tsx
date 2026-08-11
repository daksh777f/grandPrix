export function SPDFooter() {
  return (
    <section className="relative w-full bg-[#E10600] flex flex-col z-10 font-body overflow-hidden">
      
      {/* Outer wrapper */}
      <div className="flex-1 flex flex-col items-center justify-center w-full py-16 md:py-24">
        
        {/* Inner container */}
        <div className="flex flex-col items-center w-full px-6 text-center z-20 relative max-w-4xl mx-auto">
          
          {/* Logo SVG */}
          <svg className="mb-10 w-16 h-16 md:w-20 md:h-20" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" clipRule="evenodd" d="M60 120C26.8629 120 0 93.1371 0 60V0C22.5654 0 42.2213 12.4569 52.4662 30.8691C38.4788 34.2089 28.0787 46.7902 28.0787 61.8006V63.1443C28.0787 79.9648 41.7146 93.6006 58.5353 93.6006H59.8789L59.8785 61.8006C59.8785 79.3633 74.1159 93.6006 91.6787 93.6006L91.6787 61.8006C91.6787 44.2783 77.5071 30.0661 60 30.0008L60 0H62.5352C94.2722 0 120 25.7279 120 57.4648V60C120 93.1371 93.1371 120 60 120Z" fill="white"/>
          </svg>

          {/* Mission statement */}
          <h3 className="text-white font-display text-2xl md:text-4xl lg:text-5xl font-bold uppercase tracking-wide leading-tight">
            We built this platform with a single purpose to eliminate operational chaos and restore balance to your daily business routine
          </h3>

        </div>
      </div>

      {/* Bottom Video with Red Gradient Blend */}
      <div className="relative w-full mt-auto">
        {/* Gradient overlay to smoothly blend the video with the red background */}
        <div className="absolute top-0 left-0 w-full h-40 bg-gradient-to-b from-[#E10600] to-transparent z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-asphalt to-transparent z-10 pointer-events-none" />
        
        <video autoPlay loop muted playsInline className="w-full h-[400px] md:h-[600px] object-cover block opacity-80">
          <source
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
            type="video/mp4"
          />
        </video>
      </div>

    </section>
  );
}
