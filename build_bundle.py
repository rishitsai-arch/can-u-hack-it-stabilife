"""
build_bundle.py

Combines the NSFW model and the violence model's weights into a single .pth file:
content_moderator_bundle.pth
"""

import torch
from transformers import AutoModelForImageClassification, AutoConfig

NSFW_MODEL_ID = "Falconsai/nsfw_image_detection"
VIOLENCE_MODEL_ID = "locih/violence_classification"
OUTPUT_PATH = "content_moderator_bundle.pth"


def main():
    print(f"Downloading/loading NSFW model: {NSFW_MODEL_ID}")
    nsfw_model = AutoModelForImageClassification.from_pretrained(NSFW_MODEL_ID)
    nsfw_config = nsfw_model.config

    print(f"Downloading/loading Violence model: {VIOLENCE_MODEL_ID}")
    violence_model = AutoModelForImageClassification.from_pretrained(VIOLENCE_MODEL_ID)
    violence_config = violence_model.config

    bundle = {
        "nsfw_model_id": NSFW_MODEL_ID,
        "nsfw_state_dict": nsfw_model.state_dict(),
        "nsfw_id2label": nsfw_config.id2label,

        "violence_model_id": VIOLENCE_MODEL_ID,
        "violence_state_dict": violence_model.state_dict(),
        "violence_id2label": violence_config.id2label,
    }

    torch.save(bundle, OUTPUT_PATH)
    print(f"\nSaved combined bundle to: {OUTPUT_PATH}")
    print("Contents:")
    for key in bundle:
        if key.endswith("_state_dict"):
            print(f"  - {key}: {len(bundle[key])} tensors")
        else:
            print(f"  - {key}: {bundle[key]}")


if __name__ == "__main__":
    main()
