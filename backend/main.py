import os
import io
import base64
import logging
import cv2
import requests
import numpy as np
import replicate
import mediapipe as mp
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Configure logging to print error details
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# Enable Cross-Origin Resource Sharing (CORS) for external frontend clients
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set Replicate API authentication token strictly from environment variable
replicate_api_token = os.getenv("REPLICATE_API_TOKEN")

if not replicate_api_token:
    logger.warning("REPLICATE_API_TOKEN is not set in environment variables.")

# Verified active model ID (twn39/lama-fast) for image inpainting
LAMA_MODEL_ID = "twn39/lama-fast:14f2bd2709155a572ba4de44e4bb7aabec6c8b4a80c6cec957b6741ec3833a99"

# MediaPipe FaceLandmarker configuration initialization
BaseOptions = mp.tasks.BaseOptions
FaceLandmarker = mp.tasks.vision.FaceLandmarker
FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
VisionRunningMode = mp.tasks.vision.RunningMode

MODEL_PATH = os.path.join(os.path.dirname(__file__), "face_landmarker.task")

# Verify model file existence
if not os.path.exists(MODEL_PATH):
    logger.error(f"MediaPipe task model file NOT found at: {MODEL_PATH}")

options = FaceLandmarkerOptions(
    base_options=BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=VisionRunningMode.IMAGE,
    num_faces=1
)

# MediaPipe 468/478 landmark index mapping
LEFT_EYEBROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46]
RIGHT_EYEBROW = [300, 293, 334, 296, 336, 285, 295, 282, 283, 276]

EYEBROW_ANCHORS = {
    "screen_left_head": 70,
    "screen_left_tail": 46,
    "screen_right_head": 300,
    "screen_right_tail": 276
}

LEFT_EYE = [33, 160, 158, 133, 153, 144, 33]
RIGHT_EYE = [362, 385, 387, 263, 373, 380, 362]
NOSE_TIP = 1


def create_eyebrow_mask(image_shape: tuple, face_landmarks) -> np.ndarray:
    """
    Generates a binary mask covering eyebrow regions with morphological expansion
    and Gaussian blur for smooth AI inpainting blending.
    """
    h, w = image_shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)

    left_pts = np.array([[int(face_landmarks[i].x * w), int(face_landmarks[i].y * h)] for i in LEFT_EYEBROW], dtype=np.int32)
    right_pts = np.array([[int(face_landmarks[i].x * w), int(face_landmarks[i].y * h)] for i in RIGHT_EYEBROW], dtype=np.int32)

    cv2.fillPoly(mask, [left_pts], 255)
    cv2.fillPoly(mask, [right_pts], 255)

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))
    mask = cv2.dilate(mask, kernel, iterations=3)
    mask = cv2.GaussianBlur(mask, (5, 5), 0)

    return mask


@app.post("/remove-eyebrows")
async def remove_eyebrows(file: UploadFile = File(...)):
    """
    Endpoint that accepts an uploaded face image, extracts precise pre-erasure landmark 
    coordinates, generates an eyebrow mask, executes AI inpainting via Replicate, 
    and returns both the eyebrow-less image and landmark mapping.
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            logger.error("Failed to decode uploaded image.")
            return JSONResponse(status_code=400, content={"error": "Invalid image format"})

        h, w, _ = image.shape
        rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_image)

        # Detect facial landmarks
        with FaceLandmarker.create_from_options(options) as landmarker:
            result = landmarker.detect(mp_image)

            if not result.face_landmarks:
                logger.warning("No face detected in the image.")
                return JSONResponse(status_code=400, content={"error": "No face detected in image"})

            face = result.face_landmarks[0]

            left_pts = [{"x": face[i].x * w, "y": face[i].y * h} for i in LEFT_EYEBROW]
            right_pts = [{"x": face[i].x * w, "y": face[i].y * h} for i in RIGHT_EYEBROW]
            left_eye_pts = [{"x": face[i].x * w, "y": face[i].y * h} for i in LEFT_EYE]
            right_eye_pts = [{"x": face[i].x * w, "y": face[i].y * h} for i in RIGHT_EYE]
            nose_pt = {"x": face[NOSE_TIP].x * w, "y": face[NOSE_TIP].y * h}

            screen_left_eyebrow = {
                "head": {"x": face[EYEBROW_ANCHORS["screen_left_head"]].x * w, "y": face[EYEBROW_ANCHORS["screen_left_head"]].y * h},
                "tail": {"x": face[EYEBROW_ANCHORS["screen_left_tail"]].x * w, "y": face[EYEBROW_ANCHORS["screen_left_tail"]].y * h}
            }
            screen_right_eyebrow = {
                "head": {"x": face[EYEBROW_ANCHORS["screen_right_head"]].x * w, "y": face[EYEBROW_ANCHORS["screen_right_head"]].y * h},
                "tail": {"x": face[EYEBROW_ANCHORS["screen_right_tail"]].x * w, "y": face[EYEBROW_ANCHORS["screen_right_tail"]].y * h}
            }

            mask_np = create_eyebrow_mask((h, w), face)

            _, img_encoded = cv2.imencode('.png', image)
            _, mask_encoded = cv2.imencode('.png', mask_np)

            # Replicate API call
            try:
                output = replicate.run(
                    LAMA_MODEL_ID,
                    input={
                        "image": io.BytesIO(img_encoded.tobytes()),
                        "mask": io.BytesIO(mask_encoded.tobytes())
                    }
                )

                if hasattr(output, "read"):
                    inpainted_bytes = output.read()
                elif isinstance(output, str):
                    inpainted_bytes = requests.get(output).content
                elif isinstance(output, list) and len(output) > 0:
                    target = output[0]
                    inpainted_bytes = target.read() if hasattr(target, "read") else requests.get(str(target)).content
                else:
                    inpainted_bytes = requests.get(str(output)).content

                base64_image = base64.b64encode(inpainted_bytes).decode('utf-8')

                return {
                    "image": f"data:image/png;base64,{base64_image}",
                    "landmarks": {
                        "image_width": w,
                        "image_height": h,
                        "left_eyebrow": left_pts,
                        "right_eyebrow": right_pts,
                        "left_eye": left_eye_pts,
                        "right_eye": right_eye_pts,
                        "nose_tip": nose_pt,
                        "screen_left_eyebrow": screen_left_eyebrow,
                        "screen_right_eyebrow": screen_right_eyebrow
                    }
                }

            except Exception as e:
                logger.error(f"Replicate API execution failed: {e}", exc_info=True)
                return JSONResponse(status_code=500, content={"error": f"Replicate API error: {str(e)}"})

    except Exception as e:
        logger.error(f"Unhandled server error: {e}", exc_info=True)
        return JSONResponse(status_code=500, content={"error": f"Internal server error: {str(e)}"})