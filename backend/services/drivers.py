import pandas as pd
import os
from fastapi import HTTPException

def get_drivers_data():
    # base_dir is grandPrix
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    csv_path = os.path.join(base_dir, "data", "drivers.csv")

    if not os.path.exists(csv_path):
        raise HTTPException(status_code=500, detail=f"drivers.csv not found at {csv_path}")

    try:
        df = pd.read_csv(csv_path)
        # We need specific columns expected by the frontend
        cols = ['driver_number', 'name_acronym', 'full_name', 'team_name', 'team_colour', 'headshot_url', 'country_code']

        # Convert driver_number to int (just to be sure, avoiding floats for integers)
        df['driver_number'] = df['driver_number'].astype(int)

        # Fill NaN for string columns to empty string so JSON serialization doesn't fail with nulls where strings are expected
        df[cols] = df[cols].fillna("")

        # Provide a fallback for empty headshot URLs to prevent broken <img> tags in the frontend
        FALLBACK_HEADSHOT = "https://media.formula1.com/image/upload/f_auto,c_limit,q_auto,w_1320/content/dam/fom-website/2018-redesign-assets/drivers/number-logos/MAXVER01"
        df.loc[df['headshot_url'] == "", 'headshot_url'] = FALLBACK_HEADSHOT

        drivers = df[cols].to_dict(orient="records")
        return drivers
    except Exception as e:
        print(f"Error reading drivers data: {e}")
        raise HTTPException(status_code=500, detail="Error reading driver data from CSV")
