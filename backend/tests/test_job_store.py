"""Tests for the in-memory job store."""
from app.services.job_store import (
    create_job,
    get_job,
    update_job,
    report_progress,
)


def test_create_job():
    job_id = create_job("session-123", target_column="age", target_purpose="prediction")
    job = get_job(job_id)
    assert job is not None
    assert job["session_id"] == "session-123"
    assert job["target_column"] == "age"
    assert job["target_purpose"] == "prediction"
    assert job["status"] == "queued"
    assert job["progress_pct"] == 0


def test_get_job():
    job_id = create_job("session-456", target_column=None, target_purpose=None)
    found = get_job(job_id)
    assert found is not None
    assert found["job_id"] == job_id


def test_get_job_not_found():
    assert get_job("nonexistent") is None


def test_update_job():
    job_id = create_job("session-update", target_column=None, target_purpose=None)
    update_job(job_id, status="processing", progress_pct=50, message="Halfway there")
    updated = get_job(job_id)
    assert updated["status"] == "processing"
    assert updated["progress_pct"] == 50
    assert updated["message"] == "Halfway there"


def test_report_progress():
    job_id = create_job("session-progress", target_column=None, target_purpose=None)
    report_progress(job_id, 75, "Classifying columns")
    job = get_job(job_id)
    assert job["status"] == "processing"
    assert job["progress_pct"] == 75
    assert job["message"] == "Classifying columns"


def test_report_progress_clamps():
    job_id = create_job("session-clamp", target_column=None, target_purpose=None)
    report_progress(job_id, 150, "Over 100")
    job = get_job(job_id)
    assert job["progress_pct"] == 100

    report_progress(job_id, -10, "Negative")
    job = get_job(job_id)
    assert job["progress_pct"] == 0


def test_job_has_timestamps():
    job_id = create_job("session-ts", target_column=None, target_purpose=None)
    job = get_job(job_id)
    assert "created_at" in job
    assert "updated_at" in job


def test_get_job_returns_copy():
    job_id = create_job("session-copy", target_column=None, target_purpose=None)
    job1 = get_job(job_id)
    job2 = get_job(job_id)
    assert job1 is not job2
    assert job1 == job2
