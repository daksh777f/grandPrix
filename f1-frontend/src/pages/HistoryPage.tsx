

export function HistoryPage() {
  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-[#07080B] pt-20">
      <div className="w-full h-full relative overflow-hidden bg-[#07080B]">
        <iframe
          src="https://www.espn.com/espn/feature/story?id=43832710"
          className="absolute -top-36 left-0 w-full h-[calc(100%+144px)] border-none"
          title="F1 Historical Race Context"
          allowFullScreen
        />
      </div>
    </div>
  );
}


