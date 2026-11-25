
import io
import os

from dotenv import load_dotenv
from fastapi import (
    FastAPI,
    HTTPException,
    Request,
    Form,
    File,
    UploadFile,
)
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError

from ai_service import AIServiceError, analyze_plant
from schemas import AnalysisResponse, PlantRequest
from storage_api import router as storage_router


load_dotenv()

app = FastAPI(title="AI Plant Health Analysis")

MAX_IMAGE_SIZE = 5 * 1024 * 1024

ALLOWED_IMAGE_TYPES = {
    "JPEG": "image/jpeg",
    "PNG": "image/png",
    "WEBP": "image/webp",
}

origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in origins
        if origin.strip()
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

app.include_router(storage_router)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(
    request: Request,
    exc: RequestValidationError,
):
    fields = {}

    for error in exc.errors():
        name = str(error["loc"][-1])
        fields[name] = error["msg"].replace(
            "Value error, ", ""
        )

    return JSONResponse(
        status_code=422,
        content={
            "detail": "Please check the form fields and try again.",
            "fields": fields,
        },
    )


@app.get("/health")
def health():
    return {"status": "ok"}


async def validate_uploaded_image(image: UploadFile):
    """Validate image size, format and actual image content."""

    if image.content_type not in ALLOWED_IMAGE_TYPES.values():
        await image.close()
        raise HTTPException(
            status_code=400,
            detail="Only JPG, PNG and WebP images are allowed.",
        )

    try:
        image_bytes = await image.read(MAX_IMAGE_SIZE + 1)

        if not image_bytes:
            raise HTTPException(
                status_code=400,
                detail="The uploaded image is empty.",
            )

        if len(image_bytes) > MAX_IMAGE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="Image size must be 5 MB or less.",
            )

        with Image.open(io.BytesIO(image_bytes)) as img:
            image_format = img.format

            if image_format not in ALLOWED_IMAGE_TYPES:
                raise HTTPException(
                    status_code=400,
                    detail="Unsupported image format.",
                )

            if (
                ALLOWED_IMAGE_TYPES[image_format]
                != image.content_type
            ):
                raise HTTPException(
                    status_code=400,
                    detail="Image file type does not match its content.",
                )

            img.verify()

        return (
            image_bytes,
            ALLOWED_IMAGE_TYPES[image_format],
        )

    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(
            status_code=400,
            detail="Invalid or corrupted image. Upload a clear image.",
        )

    finally:
        await image.close()


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze(
    plant_name: str = Form(...),
    plant_type: str = Form(...),
    location: str | None = Form(None),
    symptom: str = Form(...),
    image: UploadFile | None = File(None),
):
    try:
        # Validate normal plant details
        request = PlantRequest(
            plant_name=plant_name,
            plant_type=plant_type,
            location=location,
            symptom=symptom,
        )

    except ValidationError as exc:
        raise HTTPException(
            status_code=422,
            detail=(
                "Invalid Plant Information. Please enter "
                "valid plant details and meaningful symptoms."
            ),
        ) from exc

    image_bytes = None
    image_mime_type = None

    if image is not None:
        image_bytes, image_mime_type = (
            await validate_uploaded_image(image)
        )

    try:
        return await run_in_threadpool(
            analyze_plant, request,
            image_bytes=image_bytes,
            image_mime_type=image_mime_type,
        )

    except AIServiceError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=exc.message,
        ) from exc
