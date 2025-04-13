# FILE: app/config.py
import os


class Config:
    """Flask configuration variables."""

    SECRET_KEY = os.environ.get("SECRET_KEY") or "dev-secret-key-please-change"

    # Cache Config
    CACHE_TYPE = "FileSystemCache"
    CACHE_DIR = "flask_cache"  # Relative path within instance folder
    CACHE_DEFAULT_TIMEOUT = 3600  # 1 hour default

    # API Key and Base URL
    CONGRESS_GOV_API_KEY = os.environ.get("CONGRESS_GOV_API_KEY")
    API_BASE_URL = "https://api.congress.gov/v3"

    # --- Constants ---
    AMENDMENT_TYPES = {"samdt", "hamdt", "sa", "ha", "suamdt"}
    BILL_TYPES = {"hr", "s", "hres", "sres", "hjres", "sjres", "hconres", "sconres"}

    BILL_TYPE_PATHS = {
        "HR": "house-bill",
        "S": "senate-bill",
        "HRES": "house-resolution",
        "SRES": "senate-resolution",
        "HJRES": "house-joint-resolution",
        "SJRES": "senate-joint-resolution",
        "HCONRES": "house-concurrent-resolution",
        "SCONRES": "senate-concurrent-resolution",
        "SAMDT": "senate-amendment",
        "HAMDT": "house-amendment",
        "SA": "senate-amendment",
        "HA": "house-amendment",
        "SUAMDT": "senate-unamendable-amendment",
    }

    STATES_LIST = sorted(
        [
            "Alabama",
            "Alaska",
            "Arizona",
            "Arkansas",
            "California",
            "Colorado",
            "Connecticut",
            "Delaware",
            "Florida",
            "Georgia",
            "Hawaii",
            "Idaho",
            "Illinois",
            "Indiana",
            "Iowa",
            "Kansas",
            "Kentucky",
            "Louisiana",
            "Maine",
            "Maryland",
            "Massachusetts",
            "Michigan",
            "Minnesota",
            "Mississippi",
            "Missouri",
            "Montana",
            "Nebraska",
            "Nevada",
            "New Hampshire",
            "New Jersey",
            "New Mexico",
            "New York",
            "North Carolina",
            "North Dakota",
            "Ohio",
            "Oklahoma",
            "Oregon",
            "Pennsylvania",
            "Rhode Island",
            "South Carolina",
            "South Dakota",
            "Tennessee",
            "Texas",
            "Utah",
            "Vermont",
            "Virginia",
            "Washington",
            "West Virginia",
            "Wisconsin",
            "Wyoming",
            "American Samoa",
            "District of Columbia",
            "Federated States of Micronesia",
            "Guam",
            "Marshall Islands",
            "Northern Mariana Islands",
            "Palau",
            "Puerto Rico",
            "Virgin Islands",
        ]
    )
