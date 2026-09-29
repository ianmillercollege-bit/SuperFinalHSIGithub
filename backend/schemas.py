"""Response models. Python uses snake_case; JSON uses camelCase (BACKEND_CONTRACT.md section 1)."""

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    """Base for every request and response model."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class HealthResponse(CamelModel):
    status: str
    mock_mode: bool
    version: str
