from app.modules.deforestation_analysis.router import router as root_router
from fastapi import APIRouter

module_router = APIRouter()

module_router.include_router(
    root_router,
    prefix="/deforestation_analysis",
    tags=["Deforestation Analysis Module"],
)
