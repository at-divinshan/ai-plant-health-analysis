
import re
from typing import List, Literal, Optional

from pydantic import BaseModel, Field, field_validator


PlantType = Literal[
    "Vegetable",
    "Fruit",
    "Flower",
    "Herb",
    "Tree",
    "Indoor Plant",
    "Other",
]


# Common fake or meaningless test values
INVALID_WORDS = {
    "asdf",
    "asdfg",
    "asdfgh",
    "asdfghjkl",
    "qwerty",
    "qwertyuiop",
    "zxcv",
    "zxcvbn",
    "xyz",
    "xyzabc",
    "abc",
    "abcd",
    "abcde",
    "abcdef",
    "abc123",
    "xyz123",
    "xyzabc123",
    "test",
    "testing",
    "dummy",
    "random",
    "none",
    "nothing",
    "unknown",
    "null",
    "na",
    "n/a",
}


def is_meaningless(value: str) -> bool:
    """Detect obvious dummy or meaningless input."""

    text = value.strip().lower()

    if not text:
        return True

    compact = re.sub(r"\s+", "", text)

    # Reject numbers-only and symbols-only values.
    # Accept English and Tamil letters.
    if not re.search(r"[a-z\u00c0-\u024f\u0b80-\u0bff]", text):
        return True

    # Reject common fake values.
    if compact in INVALID_WORDS:
        return True

    # Reject repeated characters like aaaaa or xxxxx.
    if re.fullmatch(r"(.)\1{3,}", compact):
        return True

    # Reject obvious keyboard patterns.
    if re.match(r"^(asdf|qwer|zxcv|abcd|1234|xyzabc)", compact):
        return True

    return False


class PlantRequest(BaseModel):
    """Data sent from the React form."""

    plant_name: str = Field(
        ...,
        max_length=100,
    )

    plant_type: PlantType

    location: Optional[str] = Field(
        default=None,
        max_length=100,
    )

    symptom: str = Field(
        ...,
        max_length=1000,
    )

    @field_validator("plant_name")
    @classmethod
    def validate_plant_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Plant name is required.")

        if is_meaningless(value):
            raise ValueError(
                "Invalid Plant Information. Enter a valid plant name."
            )

        return value

    @field_validator("symptom")
    @classmethod
    def validate_symptom(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Please describe the symptoms.")

        if len(value) < 10:
            raise ValueError(
                "Please describe meaningful plant symptoms."
            )

        if is_meaningless(value):
            raise ValueError(
                "Invalid Plant Information. Enter meaningful symptoms."
            )

        return value

    @field_validator("location")
    @classmethod
    def validate_location(
        cls,
        value: Optional[str],
    ) -> Optional[str]:

        if value is None:
            return None

        value = value.strip()

        if not value:
            return None

        if is_meaningless(value):
            raise ValueError(
                "Please enter a valid location or leave it empty."
            )

        return value


class AnalysisResponse(BaseModel):
    """Structured JSON response from Gemini AI."""

    possible_issue: str = Field(
        ...,
        min_length=1,
    )

    explanation: str = Field(
        ...,
        min_length=1,
    )

    care_suggestions: List[str] = Field(
        ...,
        min_length=3,
        max_length=3,
    )

    expert_advice: str = Field(
        ...,
        min_length=1,
    )

    expert_advice_needed: bool = Field(
        ...,
        description=(
            "True when professional plant-care "
            "advice is recommended."
        ),
    )

    ideal_temperature: str = Field(
        ...,
        min_length=1,
        description=(
            "Approximate growing temperature "
            "range in °C, with relevant context."
        ),
    )

    sunlight_requirements: str = Field(
        ...,
        min_length=1,
        description=(
            "Approximate daily sunlight hours "
            "and suitable light exposure."
        ),
    )

    watering_frequency: str = Field(
        ...,
        min_length=1,
        description=(
            "Approximate watering frequency, "
            "adjusted using soil moisture and symptoms."
        ),
    )

    humidity_level: str = Field(
        ...,
        min_length=1,
        description=(
            "Approximate relative humidity "
            "range in percent."
        ),
    )

    @field_validator(
        "ideal_temperature",
        "sunlight_requirements",
        "watering_frequency",
        "humidity_level",
    )
    @classmethod
    def recommendation_text(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError(
                "A care recommendation is required."
            )

        return value
