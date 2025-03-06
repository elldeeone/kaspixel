from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.db.base_class import Base

class WalletBalance(Base):
    __tablename__ = "wallet_balances"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String, nullable=False, unique=True)
    pixel_balance = Column(Integer, default=0, nullable=False)
    last_updated = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    class Config:
        orm_mode = True 