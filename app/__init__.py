# FILE: app/__init__.py
from flask import Flask
from flask_caching import Cache
from flask_cors import CORS  # Import CORS
from .config import Config

cache = Cache()


def create_app(config_class=Config):
    """Creates and configures the Flask application instance."""
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(config_class)

    # Logging config could go here if desired
    print("--- App Configuration (API Mode) ---")  # Indicate API Mode
    print(
        f"API Key Loaded: {'Yes' if app.config.get('CONGRESS_GOV_API_KEY') else 'NO (CRITICAL WARNING - API calls will fail)'}"
    )
    # ... (other config logging) ...
    print("-------------------------")

    # Initialize extensions
    cache.init_app(app)
    CORS(app)  # <<< ENABLE CORS for all routes (adjust for production)

    # Register Blueprints
    from .main.routes import main_bp

    app.register_blueprint(main_bp)  # Handles / and /api/members

    from .members.routes import members_bp

    app.register_blueprint(
        members_bp, url_prefix="/api/member"
    )  # Handles /api/member/*

    from .bills.routes import bills_bp

    # Adjust prefix for bills API routes
    app.register_blueprint(
        bills_bp, url_prefix="/api"
    )  # Handles /api/bills, /api/bill/*

    from .committees.routes import committees_bp

    # Adjust prefix for committees API routes
    app.register_blueprint(
        committees_bp, url_prefix="/api"
    )  # Handles /api/committees, /api/committee/*

    from .nominations.routes import nominations_bp

    # Adjust prefix for nominations API routes
    app.register_blueprint(
        nominations_bp, url_prefix="/api"
    )  # Handles /api/nominations, /api/nomination/*

    return app
