from __future__ import annotations

import time

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def _upload(client, sample_csv_bytes, filename="sample_messy_data.csv"):
    resp = client.post("/upload", files={"file": (filename, sample_csv_bytes, "text/csv")})
    assert resp.status_code == 200, resp.text
    return resp.json()


def _wait_for_job(client, job_id, timeout=60.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        resp = client.get(f"/jobs/{job_id}")
        assert resp.status_code == 200, resp.text
        job = resp.json()
        if job["status"] in ("succeeded", "failed"):
            return job
        time.sleep(0.1)
    raise AssertionError("analysis job timed out")


def test_upload_rejects_unknown_extension(client, sample_csv_bytes):
    resp = client.post(
        "/upload", files={"file": ("data.exe", sample_csv_bytes, "application/octet-stream")}
    )
    assert resp.status_code == 400


def test_full_flow(client, sample_csv_bytes):
    """upload -> async analyze -> apply -> summary -> export -> preview"""
    upload = _upload(client, sample_csv_bytes)
    session_id = upload["session_id"]
    assert "quality" in upload["diagnosis"]
    assert upload["diagnosis"]["quality"]["overall_score"] >= 0

    # ── async analyze ──────────────────────────────────────────────────
    resp = client.post("/analyze", json={"session_id": session_id})
    assert resp.status_code == 202, resp.text
    job = resp.json()
    assert job["status"] in ("queued", "processing")
    job = _wait_for_job(client, job["job_id"])
    assert job["status"] == "succeeded", job.get("error")
    assert job["progress_pct"] == 100
    result = job["result"]
    assert result["semantic_types"]
    assert result["recommendations"]
    assert isinstance(result["warnings"], list)

    # ── apply a recommended numeric action ─────────────────────────────
    age_rec = next(r for r in result["recommendations"] if r["column"] == "age")
    assert age_rec["recommended_action"] == "impute_median"
    resp = client.post(
        "/apply-action",
        json={
            "session_id": session_id,
            "column": "age",
            "action": "impute_median",
            "justification": age_rec["justification"],
        },
    )
    assert resp.status_code == 200, resp.text
    applied = resp.json()
    assert applied["success"] is True
    assert applied["after"]["missing_pct"] == 0.0

    # ── summary ────────────────────────────────────────────────────────
    resp = client.get(f"/session/{session_id}/summary")
    assert resp.status_code == 200
    summary = resp.json()
    assert len(summary["actions_applied"]) == 1
    assert summary["actions_applied"][0]["column"] == "age"
    assert summary["export_ready"] is True

    # ── preview ────────────────────────────────────────────────────────
    resp = client.get(f"/preview/{session_id}")
    assert resp.status_code == 200
    preview = resp.json()
    assert preview["total_rows"] > 0
    assert preview["columns"]
    # JSON must be serializable without numpy objects
    assert resp.headers["content-type"].startswith("application/json")

    # ── export ─────────────────────────────────────────────────────────
    resp = client.get(f"/export/{session_id}")
    assert resp.status_code == 200
    assert "age" in resp.text

    # ── reset ──────────────────────────────────────────────────────────
    resp = client.post("/reset-session", json={"session_id": session_id})
    assert resp.status_code == 200
    assert resp.json()["success"] is True


def test_analyze_missing_session_returns_404(client):
    resp = client.post("/analyze", json={"session_id": "does-not-exist"})
    assert resp.status_code == 404


def test_job_not_found(client):
    resp = client.get("/jobs/does-not-exist")
    assert resp.status_code == 404


def test_apply_action_validation(client, sample_csv_bytes):
    upload = _upload(client, sample_csv_bytes)
    session_id = upload["session_id"]

    # numeric action on non-numeric column
    resp = client.post(
        "/apply-action",
        json={"session_id": session_id, "column": "city", "action": "impute_median"},
    )
    assert resp.status_code == 400

    # unknown column
    resp = client.post(
        "/apply-action",
        json={"session_id": session_id, "column": "nope", "action": "drop_column"},
    )
    assert resp.status_code == 400


def test_recipes_lifecycle(client, sample_csv_bytes):
    # Session A: clean it a bit, then save a recipe
    upload_a = _upload(client, sample_csv_bytes)
    session_a = upload_a["session_id"]

    resp = client.post(
        "/apply-action",
        json={"session_id": session_a, "column": "age", "action": "impute_median", "justification": "j"},
    )
    assert resp.status_code == 200

    resp = client.post(
        "/recipes/save",
        json={"name": "Churn Cleanup", "description": "for demo", "session_id": session_a},
    )
    assert resp.status_code == 200, resp.text
    saved = resp.json()
    assert saved["action_count"] == 1
    recipe_id = saved["id"]

    # List + get
    resp = client.get("/recipes/list")
    assert resp.status_code == 200
    assert any(r["id"] == recipe_id for r in resp.json()["recipes"])

    resp = client.get(f"/recipes/{recipe_id}")
    assert resp.status_code == 200
    recipe = resp.json()
    assert recipe["name"] == "Churn Cleanup"
    assert recipe["actions"][0]["column"] == "age"

    # Session B (fresh upload): apply the recipe to it
    upload_b = _upload(client, sample_csv_bytes)
    session_b = upload_b["session_id"]
    resp = client.post(
        "/recipes/apply", json={"recipe_id": recipe_id, "session_id": session_b}
    )
    assert resp.status_code == 200, resp.text
    result = resp.json()
    assert len(result["actions_applied"]) == 1
    assert result["actions_applied"][0]["column"] == "age"
    assert "full_diagnosis" in result

    # The age column in session B is now imputed
    missing = next(
        m for m in result["full_diagnosis"]["missingness"] if m["column"] == "age"
    )
    assert missing["missing_pct"] == 0.0

    # Save with zero actions must be rejected
    resp = client.post(
        "/recipes/save", json={"name": "Empty", "session_id": upload_b["session_id"]}
    )
    # After the recipe application session B HAS actions, so upload a virgin session C
    upload_c = _upload(client, sample_csv_bytes)
    resp = client.post(
        "/recipes/save", json={"name": "Empty", "session_id": upload_c["session_id"]}
    )
    assert resp.status_code == 400

    # Delete
    resp = client.delete(f"/recipes/{recipe_id}")
    assert resp.status_code == 200
    resp = client.get(f"/recipes/{recipe_id}")
    assert resp.status_code == 404
