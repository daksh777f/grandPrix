export function HistoryPage() {
  return (
    <div className="w-full h-screen pt-20 bg-asphalt overflow-hidden">
      <div className="w-full h-full relative overflow-hidden">
        <iframe
          src="https://www.espn.com/espn/feature/story?id=43832710"
          className="absolute top-[-64px] left-0 w-full h-[calc(100%+64px)] border-none"
          title="ESPN F1 History"
          allowFullScreen
        />
      </div>
    </div>
  );
}
