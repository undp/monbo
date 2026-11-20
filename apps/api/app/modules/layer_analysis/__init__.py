from fastapi import APIRouter

from app.modules.layer_analysis.router import router as root_router

module_router = APIRouter()

module_router.include_router(
    root_router,
    prefix="/layer_analysis",
    tags=["Layer Analysis Module"],
)
