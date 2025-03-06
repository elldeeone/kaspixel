from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.base_class import Base

class Pixel(Base):
    __tablename__ = "pixels"
    
    id = Column(Integer, primary_key=True, index=True)
    x = Column(Integer, nullable=False)
    y = Column(Integer, nullable=False)
    color = Column(String, nullable=False)
    wallet_address = Column(String, nullable=False)
    transaction_id = Column(String, nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    class Config:
        orm_mode = True 