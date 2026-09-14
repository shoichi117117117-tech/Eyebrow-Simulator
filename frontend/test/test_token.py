import os
import io
import time
import numpy as np
import cv2
import replicate
from dotenv import load_dotenv

load_dotenv()

# API Token 設定
replicate_api_token = os.getenv("REPLICATE_API_TOKEN")

if not replicate_api_token:
    logger.warning("REPLICATE_API_TOKEN is not set in environment variables.")

os.environ["REPLICATE_API_TOKEN"] = replicate_api_token
print(f"Token Loaded: {token[:5]}...{token[-4:]}" if token else "Token NOT found!\n")

# メモリ上でテスト画像とマスクを作成 (256x256)
img = np.full((256, 256, 3), 200, dtype=np.uint8) # グレー画像
mask = np.zeros((256, 256), dtype=np.uint8)
cv2.circle(mask, (128, 128), 40, 255, -1)        # 中央に白い円マスク

_, img_encoded = cv2.imencode('.png', img)
_, mask_encoded = cv2.imencode('.png', mask)

CANDIDATE_MODELS = [
    "twn39/lama",
    "twn39/lama-fast",
    "zylim0702/remove-object",
    "lucataco/sdxl-inpainting",
]

print("🔍 メモリ直接送信（BytesIO）でモデル動作を検証中...\n")
valid_models = []

for model_name in CANDIDATE_MODELS:
    try:
        model = replicate.models.get(model_name)
        if not model.latest_version:
            continue

        model_id = f"{model_name}:{model.latest_version.id}"
        print(f"テスト実行中: {model_name}...")

        # URL ではなく BytesIO で直接データを渡す
        output = replicate.run(
            model_id,
            input={
                "image": io.BytesIO(img_encoded.tobytes()),
                "mask": io.BytesIO(mask_encoded.tobytes())
            }
        )

        print(f"✅ [成功・利用可能] {model_name}")
        print(f"   └ 実行モデルID: {model_id}")
        print(f"   └ レスポンス: {output}\n")
        valid_models.append((model_name, model_id))

    except Exception as e:
        print(f"❌ [実行失敗] {model_name}")
        print(f"   └ エラー内容: {e}\n")

    print("⏳ レート制限回避のため10秒待機中...\n")
    time.sleep(10)

print("="*60)
print(f"🎯 検証完了: {len(valid_models)} 件の実動モデルが見つかりました。")
if valid_models:
    print("\n【本番(main.py)で使用可能なモデルID】:")
    for name, m_id in valid_models:
        print(f" - {name}")
        print(f"   {m_id}")
print("="*60)