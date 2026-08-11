export const DRIVERS = [
  {
    driver_number: 1,
    full_name: "Max VERSTAPPEN",
    team_name: "Red Bull Racing",
    team_colour: "3671C6",
    headshot_url: "https://media.formula1.com/content/dam/fom-website/drivers/M/MAXVER01_Max_Verstappen/maxver01.png",
    country_code: "NED"
  },
  {
    driver_number: 16,
    full_name: "Charles LECLERC",
    team_name: "Ferrari",
    team_colour: "E8002D",
    headshot_url: "https://media.formula1.com/content/dam/fom-website/drivers/C/CHALEC01_Charles_Leclerc/chalec01.png",
    country_code: "MON"
  },
  {
    driver_number: 4,
    full_name: "Lando NORRIS",
    team_name: "McLaren",
    team_colour: "FF8000",
    headshot_url: "https://media.formula1.com/content/dam/fom-website/drivers/L/LANNOR01_Lando_Norris/lannor01.png",
    country_code: "GBR"
  },
  {
    driver_number: 44,
    full_name: "Lewis HAMILTON",
    team_name: "Mercedes",
    team_colour: "27F4D2",
    headshot_url: "https://media.formula1.com/content/dam/fom-website/drivers/L/LEWHAM01_Lewis_Hamilton/lewham01.png",
    country_code: "GBR"
  },
  {
    driver_number: 55,
    full_name: "Carlos SAINZ",
    team_name: "Ferrari",
    team_colour: "E8002D",
    headshot_url: "https://media.formula1.com/content/dam/fom-website/drivers/C/CARSAI01_Carlos_Sainz/carsai01.png",
    country_code: "ESP"
  },
  {
    driver_number: 81,
    full_name: "Oscar PIASTRI",
    team_name: "McLaren",
    team_colour: "FF8000",
    headshot_url: "https://media.formula1.com/content/dam/fom-website/drivers/O/OSCPIA01_Oscar_Piastri/oscpia01.png",
    country_code: "AUS"
  },
  {
    driver_number: 63,
    full_name: "George RUSSELL",
    team_name: "Mercedes",
    team_colour: "27F4D2",
    headshot_url: "https://media.formula1.com/content/dam/fom-website/drivers/G/GEORUS01_George_Russell/georus01.png",
    country_code: "GBR"
  },
  {
    driver_number: 14,
    full_name: "Fernando ALONSO",
    team_name: "Aston Martin",
    team_colour: "229971",
    headshot_url: "https://media.formula1.com/content/dam/fom-website/drivers/F/FERALO01_Fernando_Alonso/feralo01.png",
    country_code: "ESP"
  }
];

export const STRESS_EVENTS = [
  {
    eventId: "evt_0001",
    event_type: "stress_alert",
    event_meta: {
      driver_number: 1,
      lap_number: 29,
      elapsed_race_time: 2847.6,
      transcript: "Box this lap, box this lap, confirm.",
      mood_label: "Stressed",
      arousal_score: 0.78,
      message: "Elevated stress detected during pit call"
    }
  },
  {
    eventId: "evt_0002",
    event_type: "silence_flag",
    event_meta: {
      driver_number: 11,
      lap_number: 34,
      elapsed_race_time: 3390.1,
      message: "No radio contact for 4m12s during position loss"
    }
  },
  {
    eventId: "evt_0003",
    event_type: "stress_alert",
    event_meta: {
      driver_number: 1,
      lap_number: 15,
      elapsed_race_time: 1200.5,
      transcript: "I'm struggling with the rears, mates.",
      mood_label: "Calm",
      arousal_score: 0.35,
      message: "Routine tire degradation update"
    }
  }
];

export const LOCATION_SAMPLES = [
  { date: "2024-09-22T12:47:51.842Z", driver_number: 1, x: -6689, y: -1445, z: 199 },
  { date: "2024-09-22T12:47:52.842Z", driver_number: 1, x: -6750, y: -1500, z: 200 },
  { date: "2024-09-22T12:47:53.842Z", driver_number: 1, x: -6820, y: -1560, z: 200 },
  { date: "2024-09-22T12:47:54.842Z", driver_number: 1, x: -6880, y: -1600, z: 201 },
  { date: "2024-09-22T12:47:55.842Z", driver_number: 1, x: -6930, y: -1630, z: 200 }
];
