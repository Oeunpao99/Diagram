"""Seed the built-in template library.

    uv run python -m scripts.seed_templates

Re-running is safe: templates are upserted by slug.
"""

import asyncio

from sqlalchemy import select

from app.db.session import SessionLocal
from app.models import Template

TEMPLATES: list[dict] = [
    {
        "slug": "import-cargo-clearance",
        "name": "Import cargo clearance",
        "category": "logistics",
        "diagram_type": "swimlane",
        "description": "Documents received through to cargo release, with customs inspection.",
        "keywords": ["import", "cargo", "customs", "clearance", "release"],
        "data": {
            "title": "Import cargo clearance",
            "diagram_type": "swimlane",
            "direction": "LR",
            "lanes": [
                {"id": "lane_customer", "label": "Customer / agent", "order": 0},
                {"id": "lane_ops", "label": "Operations", "order": 1},
                {"id": "lane_customs", "label": "Customs", "order": 2},
                {"id": "lane_warehouse", "label": "Warehouse", "order": 3},
            ],
            "nodes": [
                {"id": "start", "label": "Documents received", "kind": "start", "lane": "lane_customer"},
                {"id": "check_docs", "label": "Check document set", "kind": "process", "lane": "lane_ops"},
                {"id": "docs_ok", "label": "Documents complete?", "kind": "decision", "lane": "lane_ops"},
                {"id": "request_docs", "label": "Request missing documents", "kind": "process", "lane": "lane_customer"},
                {"id": "declare", "label": "Submit customs declaration", "kind": "process", "lane": "lane_ops"},
                {"id": "inspect", "label": "Customs inspection", "kind": "process", "lane": "lane_customs"},
                {"id": "cleared", "label": "Cleared?", "kind": "decision", "lane": "lane_customs"},
                {"id": "hold", "label": "Hold and raise query", "kind": "process", "lane": "lane_customs"},
                {"id": "duty", "label": "Pay duty and taxes", "kind": "process", "lane": "lane_customer"},
                {"id": "release_order", "label": "Issue release order", "kind": "document", "lane": "lane_ops"},
                {"id": "pickup", "label": "Release cargo", "kind": "process", "lane": "lane_warehouse"},
                {"id": "end", "label": "Cargo delivered", "kind": "end", "lane": "lane_warehouse"},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "check_docs"},
                {"id": "e2", "source": "check_docs", "target": "docs_ok"},
                {"id": "e3", "source": "docs_ok", "target": "request_docs", "label": "No"},
                {"id": "e4", "source": "request_docs", "target": "check_docs", "style": "dashed"},
                {"id": "e5", "source": "docs_ok", "target": "declare", "label": "Yes"},
                {"id": "e6", "source": "declare", "target": "inspect"},
                {"id": "e7", "source": "inspect", "target": "cleared"},
                {"id": "e8", "source": "cleared", "target": "hold", "label": "No"},
                {"id": "e9", "source": "hold", "target": "inspect", "style": "dashed"},
                {"id": "e10", "source": "cleared", "target": "duty", "label": "Yes"},
                {"id": "e11", "source": "duty", "target": "release_order"},
                {"id": "e12", "source": "release_order", "target": "pickup"},
                {"id": "e13", "source": "pickup", "target": "end"},
            ],
        },
    },
    {
        "slug": "approval-flow",
        "name": "Approval flow",
        "category": "business",
        "diagram_type": "process_flow",
        "description": "Request, review, approve or reject, with a rework loop.",
        "keywords": ["approval", "review", "sign off", "request"],
        "data": {
            "title": "Approval flow",
            "diagram_type": "process_flow",
            "direction": "LR",
            "nodes": [
                {"id": "start", "label": "Request submitted", "kind": "start"},
                {"id": "review", "label": "Review request", "kind": "process"},
                {"id": "decide", "label": "Approved?", "kind": "decision"},
                {"id": "rework", "label": "Return for changes", "kind": "process"},
                {"id": "approve", "label": "Record approval", "kind": "process"},
                {"id": "end", "label": "Request closed", "kind": "end"},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "review"},
                {"id": "e2", "source": "review", "target": "decide"},
                {"id": "e3", "source": "decide", "target": "approve", "label": "Yes"},
                {"id": "e4", "source": "decide", "target": "rework", "label": "No"},
                {"id": "e5", "source": "rework", "target": "review", "style": "dashed"},
                {"id": "e6", "source": "approve", "target": "end"},
            ],
        },
    },
    {
        "slug": "web-app-architecture",
        "name": "Web application architecture",
        "category": "it",
        "diagram_type": "architecture",
        "description": "Client, API gateway, services, cache and database tiers.",
        "keywords": ["architecture", "system", "api", "service", "database"],
        "data": {
            "title": "Web application architecture",
            "diagram_type": "architecture",
            "direction": "LR",
            "nodes": [
                {"id": "browser", "label": "Browser", "kind": "actor"},
                {"id": "cdn", "label": "CDN", "kind": "cloud"},
                {"id": "gateway", "label": "API gateway", "kind": "service"},
                {"id": "auth", "label": "Auth service", "kind": "service"},
                {"id": "core", "label": "Core API", "kind": "service"},
                {"id": "worker", "label": "Background worker", "kind": "service"},
                {"id": "queue", "label": "Job queue", "kind": "queue"},
                {"id": "cache", "label": "Redis cache", "kind": "database"},
                {"id": "db", "label": "PostgreSQL", "kind": "database"},
            ],
            "edges": [
                {"id": "e1", "source": "browser", "target": "cdn"},
                {"id": "e2", "source": "cdn", "target": "gateway"},
                {"id": "e3", "source": "gateway", "target": "auth"},
                {"id": "e4", "source": "gateway", "target": "core"},
                {"id": "e5", "source": "core", "target": "cache"},
                {"id": "e6", "source": "core", "target": "db"},
                {"id": "e7", "source": "core", "target": "queue"},
                {"id": "e8", "source": "queue", "target": "worker"},
                {"id": "e9", "source": "worker", "target": "db"},
            ],
        },
    },
    {
        "slug": "uat-process",
        "name": "UAT process",
        "category": "project",
        "diagram_type": "swimlane",
        "description": "Test case preparation through sign-off, including defect handling.",
        "keywords": ["uat", "testing", "defect", "sign off", "acceptance"],
        "data": {
            "title": "UAT process",
            "diagram_type": "swimlane",
            "direction": "LR",
            "lanes": [
                {"id": "lane_vendor", "label": "Vendor", "order": 0},
                {"id": "lane_customer", "label": "Customer", "order": 1},
                {"id": "lane_pm", "label": "Project manager", "order": 2},
            ],
            "nodes": [
                {"id": "start", "label": "UAT scope agreed", "kind": "start", "lane": "lane_pm"},
                {"id": "cases", "label": "Prepare test cases", "kind": "document", "lane": "lane_vendor"},
                {"id": "deploy", "label": "Deploy to UAT", "kind": "process", "lane": "lane_vendor"},
                {"id": "execute", "label": "Execute test cases", "kind": "process", "lane": "lane_customer"},
                {"id": "passed", "label": "All cases passed?", "kind": "decision", "lane": "lane_customer"},
                {"id": "defect", "label": "Log defect", "kind": "document", "lane": "lane_customer"},
                {"id": "fix", "label": "Fix and retest", "kind": "process", "lane": "lane_vendor"},
                {"id": "signoff", "label": "Sign off UAT", "kind": "process", "lane": "lane_pm"},
                {"id": "end", "label": "Ready for go-live", "kind": "end", "lane": "lane_pm"},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "cases"},
                {"id": "e2", "source": "cases", "target": "deploy"},
                {"id": "e3", "source": "deploy", "target": "execute"},
                {"id": "e4", "source": "execute", "target": "passed"},
                {"id": "e5", "source": "passed", "target": "defect", "label": "No"},
                {"id": "e6", "source": "defect", "target": "fix"},
                {"id": "e7", "source": "fix", "target": "execute", "style": "dashed"},
                {"id": "e8", "source": "passed", "target": "signoff", "label": "Yes"},
                {"id": "e9", "source": "signoff", "target": "end"},
            ],
        },
    },
    {
        "slug": "etl-pipeline",
        "name": "ETL pipeline",
        "category": "data",
        "diagram_type": "data_flow",
        "description": "Source extraction, staging, transformation, warehouse load.",
        "keywords": ["etl", "pipeline", "data", "warehouse", "ingestion"],
        "data": {
            "title": "ETL pipeline",
            "diagram_type": "data_flow",
            "direction": "LR",
            "nodes": [
                {"id": "src", "label": "Source systems", "kind": "database"},
                {"id": "extract", "label": "Extract", "kind": "process"},
                {"id": "staging", "label": "Staging area", "kind": "data"},
                {"id": "quality", "label": "Quality checks pass?", "kind": "decision"},
                {"id": "quarantine", "label": "Quarantine bad records", "kind": "data"},
                {"id": "transform", "label": "Transform", "kind": "process"},
                {"id": "load", "label": "Load to warehouse", "kind": "process"},
                {"id": "dw", "label": "Data warehouse", "kind": "database"},
            ],
            "edges": [
                {"id": "e1", "source": "src", "target": "extract"},
                {"id": "e2", "source": "extract", "target": "staging"},
                {"id": "e3", "source": "staging", "target": "quality"},
                {"id": "e4", "source": "quality", "target": "quarantine", "label": "No"},
                {"id": "e5", "source": "quality", "target": "transform", "label": "Yes"},
                {"id": "e6", "source": "transform", "target": "load"},
                {"id": "e7", "source": "load", "target": "dw"},
            ],
        },
    },
    {
        "slug": "customer-onboarding",
        "name": "Customer onboarding",
        "category": "business",
        "diagram_type": "process_flow",
        "description": "Lead through to first successful transaction, with KYC.",
        "keywords": ["onboarding", "customer", "kyc", "account"],
        "data": {
            "title": "Customer onboarding",
            "diagram_type": "process_flow",
            "direction": "LR",
            "nodes": [
                {"id": "start", "label": "Application received", "kind": "start"},
                {"id": "kyc", "label": "Run KYC checks", "kind": "process"},
                {"id": "pass", "label": "KYC cleared?", "kind": "decision"},
                {"id": "reject", "label": "Decline and notify", "kind": "end"},
                {"id": "account", "label": "Create account", "kind": "process"},
                {"id": "train", "label": "Onboarding session", "kind": "process"},
                {"id": "first", "label": "First transaction", "kind": "process"},
                {"id": "end", "label": "Customer active", "kind": "end"},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "kyc"},
                {"id": "e2", "source": "kyc", "target": "pass"},
                {"id": "e3", "source": "pass", "target": "reject", "label": "No"},
                {"id": "e4", "source": "pass", "target": "account", "label": "Yes"},
                {"id": "e5", "source": "account", "target": "train"},
                {"id": "e6", "source": "train", "target": "first"},
                {"id": "e7", "source": "first", "target": "end"},
            ],
        },
    },
]


async def main() -> None:
    async with SessionLocal() as db:
        for spec in TEMPLATES:
            existing = (
                await db.execute(select(Template).where(Template.slug == spec["slug"]))
            ).scalar_one_or_none()
            if existing:
                for key, value in spec.items():
                    setattr(existing, key, value)
                print(f"updated  {spec['slug']}")
            else:
                db.add(Template(**spec, is_builtin=True))
                print(f"inserted {spec['slug']}")
        await db.commit()
    print(f"\n{len(TEMPLATES)} templates ready.")


if __name__ == "__main__":
    asyncio.run(main())
