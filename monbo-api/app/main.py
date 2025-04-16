from app.modules import (
    deforestation_analysis_router,
    polygons_validation_router,
)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"version": "0.1.0", "status": "OK"}


app.include_router(polygons_validation_router)
app.include_router(deforestation_analysis_router)
