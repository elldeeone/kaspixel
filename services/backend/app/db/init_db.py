from sqlalchemy.orm import Session

from app.db.base_class import Base
from app.db.session import engine
from app.db.migrations.add_wallet_balance_tables import upgrade as add_wallet_balance_tables

# Create all tables
def init_db():
    Base.metadata.create_all(bind=engine)
    
    # Run migrations directly
    try:
        add_wallet_balance_tables()
        print("Successfully applied wallet balance tables migration")
    except Exception as e:
        print(f"Error applying wallet balance tables migration: {e}")
        # Continue even if migration fails, as tables might already exist 