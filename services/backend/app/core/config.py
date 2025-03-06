from typing import List
import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Settings(BaseSettings):
    # API Settings
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Kaspa Pixel Canvas"
    
    # CORS Settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",  # Frontend local development
        "http://localhost:8000",  # Backend local development
        "http://localhost",       # Docker container access
        "http://127.0.0.1:3000",  # Alternative localhost
        "http://127.0.0.1:8000",  # Alternative localhost
        "*",                      # Allow all origins (for development only)
    ]
    
    # Database Settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@db:5432/kaspixel")
    
    # Canvas Settings
    CANVAS_WIDTH: int = int(os.getenv("CANVAS_WIDTH", "1000"))
    CANVAS_HEIGHT: int = int(os.getenv("CANVAS_HEIGHT", "1000"))
    # Convert KAS to sompi (1 KAS = 100,000,000 sompi)
    PIXEL_PACK_COST: float = float(os.getenv("PIXEL_PACK_COST", "0.2"))  # 0.2 KAS per pack
    PIXEL_PACK_COST_SOMPI: int = int(PIXEL_PACK_COST * 100000000)  # Convert to sompi
    PIXEL_PACK_SIZE: int = int(os.getenv("PIXEL_PACK_SIZE", "10"))  # Number of pixels per pack
    
    # Kaspa Network Settings
    # Using the consolidated environment variable that's shared with frontend
    KASPA_API_URL: str = os.getenv("NEXT_PUBLIC_KASPA_URL", "http://de4.kaspa.org:8000")
    
    # Payment Settings
    RECEIVER_ADDRESS: str = os.getenv("RECEIVER_ADDRESS", "")  # Default empty, must be set in .env
    
    # Transaction Verification Settings
    enable_transaction_verification: bool = os.getenv("VERIFY_TRANSACTIONS", "True").lower() == "true"
    TRANSACTION_CHECK_INTERVAL: int = int(os.getenv("TRANSACTION_CHECK_INTERVAL", "500"))  # milliseconds
    
    class Config:
        case_sensitive = True
        env_file = ".env"

# Create a global settings instance
settings = Settings() 