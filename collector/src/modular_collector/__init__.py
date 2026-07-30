"""Open-source Skill/Script collector for modular-catalog."""

from .models import AnalysisReport, Candidate, SearchQuery
from .pipeline import CollectionPipeline, PipelineConfig

__all__ = [
    "AnalysisReport",
    "Candidate",
    "CollectionPipeline",
    "PipelineConfig",
    "SearchQuery",
]

__version__ = "1.0.0"
