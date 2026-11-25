
from datetime import datetime, timezone

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class StoredPlant(BaseModel):
    plant_name: str = Field(min_length=1, max_length=150)
    plant_type: str = Field(min_length=1, max_length=100)
    location: str | None = Field(default=None, max_length=255)
    symptom: str = Field(min_length=1, max_length=16000)

    @field_validator("plant_name", "plant_type", "symptom")
    @classmethod
    def required_text(cls, value):
        if not value.strip():
            raise ValueError("This field is required")
        return value


class StoredResult(BaseModel):
    model_config = ConfigDict(extra="allow")

    possible_issue: str = Field(min_length=1, max_length=16000)
    explanation: str = Field(min_length=1, max_length=16000)

    care_suggestions: list[str] = Field(
        min_length=1,
        max_length=100,
    )

    expert_advice: str = Field(min_length=1, max_length=16000)

    # New structured AI field
    # None supports older saved analyses.
    expert_advice_needed: bool | None = Field(
        default=None,
        description="Whether professional plant-care advice is recommended.",
    )

    # Older browser saves can predate these recommendations.
    ideal_temperature: str | None = Field(
        default=None,
        max_length=16000,
    )

    sunlight_requirements: str | None = Field(
        default=None,
        max_length=16000,
    )

    watering_frequency: str | None = Field(
        default=None,
        max_length=16000,
    )

    humidity_level: str | None = Field(
        default=None,
        max_length=16000,
    )


class SaveAnalysisRequest(BaseModel):
    person_id: int | None = Field(default=None, gt=0)
    id: str = Field(min_length=1, max_length=150)
    analyzedAt: datetime
    plant: StoredPlant
    result: StoredResult

    @field_validator("analyzedAt")
    @classmethod
    def normalize_date(cls, value):
        if value.tzinfo is None:
            raise ValueError("Analysis date must include a timezone")

        value = value.astimezone(timezone.utc)

        if not 1971 <= value.year <= 2037:
            raise ValueError(
                "Analysis date is outside the database timestamp range"
            )

        return value


class PersonRequest(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr | None = None

    @field_validator("name")
    @classmethod
    def clean_name(cls, value):
        value = value.strip()

        if not value:
            raise ValueError("Name is required")

        return value

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, value):
        return (
            value.strip().lower() or None
            if isinstance(value, str)
            else value
        )

    @field_validator("email")
    @classmethod
    def limit_email(cls, value):
        if value is not None and len(value) > 255:
            raise ValueError("Email must be 255 characters or less")

        return value


class ShareRequest(BaseModel):
    person_ids: list[int] = Field(max_length=500)

    @field_validator("person_ids")
    @classmethod
    def unique_ids(cls, values):
        if any(value < 1 for value in values):
            raise ValueError("Invalid person ID")

        return sorted(set(values))
