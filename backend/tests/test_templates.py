"""The three reference templates are the quality bar for AI generation.

They represent what "good" looks like — if a re-seed or a schema change ever
breaks their layout or validation, the reference output degrades silently
behind a model call. Keep them presentable.

Run with:  uv run pytest -q
"""

import pytest

from app.layout.engine import apply_layout
from app.schemas.diagram import DiagramDoc
from app.services.validator import validate
from scripts.seed_templates import TEMPLATES

REFERENCE = ["import-cargo-clearance", "customs-declaration-platform", "shipment-data-pipeline"]


@pytest.fixture(scope="module")
def templates():
    by_slug = {t["slug"]: t for t in TEMPLATES}
    return [by_slug[slug] for slug in REFERENCE]


def test_reference_templates_are_seeded(templates):
    assert len(templates) == len(REFERENCE)


def test_reference_templates_validate_after_layout(templates):
    for spec in templates:
        doc = DiagramDoc.model_validate(spec["data"])
        apply_layout(doc, doc.direction)
        report = validate(doc)
        problems = [i for i in report.issues if i.level in ("error", "warning")]
        assert not problems, f"{spec['slug']}: {[i.message for i in problems]}"


def test_reference_templates_do_not_overlap(templates):
    for spec in templates:
        doc = DiagramDoc.model_validate(spec["data"])
        apply_layout(doc, doc.direction)
        for i, a in enumerate(doc.nodes):
            for b in doc.nodes[i + 1 :]:
                overlap = (
                    a.position.x < b.position.x + b.size.width
                    and a.position.x + a.size.width > b.position.x
                    and a.position.y < b.position.y + b.size.height
                    and a.position.y + a.size.height > b.position.y
                )
                assert not overlap, f"{spec['slug']}: '{a.id}' overlaps '{b.id}'"


def test_architecture_template_is_layered(templates):
    spec = next(t for t in templates if t["slug"] == "customs-declaration-platform")
    doc = DiagramDoc.model_validate(spec["data"])
    apply_layout(doc, doc.direction)
    x = {n.id: n.position.x for n in doc.nodes}
    assert x["portal"] < x["gateway"] < x["pg"]
