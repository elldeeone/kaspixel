import sqlite3
import os
from pathlib import Path

def run_migrations():
    """
    Run all migration scripts in the migrations directory.
    """
    # Get the database path
    db_path = os.environ.get("DATABASE_URL", "sqlite:///./app.db")
    
    # If it's a SQLite database, extract the path
    if db_path.startswith("sqlite:///"):
        db_path = db_path.replace("sqlite:///", "")
    
    # Connect to the database
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create migrations table if it doesn't exist
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    # Get all applied migrations
    cursor.execute("SELECT name FROM migrations")
    applied_migrations = {row[0] for row in cursor.fetchall()}
    
    # Get all migration scripts
    migrations_dir = Path(__file__).parent / "migrations"
    migration_files = sorted([f for f in migrations_dir.glob("*.py") if f.name != "__init__.py"])
    
    # Apply each migration that hasn't been applied yet
    for migration_file in migration_files:
        migration_name = migration_file.stem
        
        if migration_name in applied_migrations:
            print(f"Migration {migration_name} already applied, skipping...")
            continue
        
        print(f"Applying migration {migration_name}...")
        
        # Import the migration module
        import importlib.util
        spec = importlib.util.spec_from_file_location(migration_name, migration_file)
        migration_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(migration_module)
        
        # Run the upgrade function
        migration_module.upgrade()
        
        # Mark the migration as applied
        cursor.execute("INSERT INTO migrations (name) VALUES (?)", (migration_name,))
        conn.commit()
        
        print(f"Migration {migration_name} applied successfully.")
    
    conn.close()
    print("All migrations applied successfully.")

if __name__ == "__main__":
    run_migrations() 