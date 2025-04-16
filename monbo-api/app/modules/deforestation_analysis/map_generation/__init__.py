from fastapi import APIRouter
from app.modules.deforestation_analysis.map_generation.router import router

module_router = APIRouter()

module_router.include_router(
    router, prefix="/map-generation", tags=["Map Generation Module"]
)
