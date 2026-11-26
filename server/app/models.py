from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class Element(BaseModel):
    model_config = ConfigDict(strict=True, allow_inf_nan=False)

    id: str = Field(min_length=21, max_length=21)
    type: Literal["rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "text"]
    x: float | int
    y: float | int
    width: float | int
    height: float | int
    zIndex: float | int
    angle: float | int
    strokeColor: str
    backgroundColor: str
    fillStyle: Literal["solid", "hachure", "cross-hatch"]
    strokeWidth: Literal[1, 2, 4]
    strokeStyle: Literal["solid", "dashed", "dotted"]
    roughness: Literal[0, 1, 2]
    opacity: float | int = Field(ge=0, le=100)
    seed: int
    points: list[list[float | int]] | None = None
    text: str | None = None
    fontSize: Literal[16, 20, 28] | None = None
    fontFamily: Literal["hand", "normal", "code"] | None = None
    textAlign: Literal["left", "center", "right"] | None = None
    version: int = Field(ge=0)
    versionNonce: int = Field(ge=0, le=4_294_967_295)
    updated: int
    isDeleted: bool

    @field_validator("points")
    @classmethod
    def validate_points(
        cls, points: list[list[float | int]] | None
    ) -> list[list[float | int]] | None:
        if points is not None and any(len(point) != 2 for point in points):
            raise ValueError("each point must contain exactly two coordinates")
        return points


class AppStateSnapshot(BaseModel):
    model_config = ConfigDict(strict=True)

    viewBackgroundColor: str


class Scene(BaseModel):
    model_config = ConfigDict(strict=True)

    elements: list[Element]
    appState: AppStateSnapshot


class Peer(BaseModel):
    userId: str
    name: str
    color: str


def empty_scene() -> Scene:
    return Scene(elements=[], appState=AppStateSnapshot(viewBackgroundColor="#ffffff"))
