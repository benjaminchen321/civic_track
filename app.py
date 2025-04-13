# FILE: civic_track/app.py
import os
from app import create_app  # Import the factory function

# Create the Flask app instance using the factory
app = create_app()

if __name__ == "__main__":
    # Ensure cache directory exists within the instance folder
    cache_dir_name = app.config.get("CACHE_DIR", "flask_cache")
    instance_cache_dir = os.path.join(app.instance_path, cache_dir_name)
    try:
        os.makedirs(instance_cache_dir, exist_ok=True)
        print(f"Flask Instance Path: {app.instance_path}")
        print(f"Flask Cache directory: {os.path.abspath(instance_cache_dir)}")
    except OSError as e:
        print(f"Error creating cache directory {instance_cache_dir}: {e}")
        print("Caching might not work correctly.")

    # Run the development server
    app.run(debug=True, host="127.0.0.1", port=5000)
