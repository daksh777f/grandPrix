

export function HistoryPage() {
  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-asphalt pt-20">
      <div className="w-full h-full relative bg-asphalt">
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


