from fastapi import APIRouter
from app.modules.deforestation_analysis.router import router

module_router = APIRouter()

module_router.include_router(
    router, prefix="/deforestation_analysis", tags=["Deforestation Analysis Module"]
)
