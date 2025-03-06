from sqlalchemy import Column, Integer, String, DateTime, Boolean, MetaData, Table, UniqueConstraint, func, text
from app.db.session import engine

metadata = MetaData()

def upgrade():
    # Create wallet_balances table
    wallet_balances = Table(
        'wallet_balances',
        metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('wallet_address', String, nullable=False),
        Column('pixel_balance', Integer, nullable=False, default=0),
        Column('last_updated', DateTime(timezone=True), server_default=func.now()),
        UniqueConstraint('wallet_address')
    )
    
    # Create transactions table
    transactions = Table(
        'transactions',
        metadata,
        Column('id', Integer, primary_key=True, index=True),
        Column('transaction_id', String, nullable=False),
        Column('wallet_address', String, nullable=False),
        Column('amount_sompi', Integer, nullable=False),
        Column('pixels_added', Integer, nullable=False),
        Column('verified', Boolean, default=False),
        Column('created_at', DateTime(timezone=True), server_default=func.now()),
        UniqueConstraint('transaction_id')
    )
    
    # Create the tables
    metadata.create_all(engine)
    print("Created wallet_balances and transactions tables")

def downgrade():
    # Connect to the database
    with engine.connect() as conn:
        # Drop the tables
        conn.execute(text("DROP TABLE IF EXISTS transactions"))
        conn.execute(text("DROP TABLE IF EXISTS wallet_balances"))
        conn.commit()
    print("Dropped wallet_balances and transactions tables") 