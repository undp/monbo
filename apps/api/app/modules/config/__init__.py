from fastapi import APIRouter

from app.modules.config.router import router

module_router = APIRouter()

module_router.include_router(router, prefix="/config", tags=["Config Module"])
