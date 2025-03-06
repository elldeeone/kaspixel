from sqlalchemy import Column, Integer, String, DateTime, Boolean
from sqlalchemy.sql import func
from app.db.base_class import Base

class Transaction(Base):
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    transaction_id = Column(String, nullable=False, unique=True)
    wallet_address = Column(String, nullable=False)
    amount_sompi = Column(Integer, nullable=False)
    pixels_added = Column(Integer, nullable=False)
    verified = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    class Config:
        orm_mode = True 