"""Seed 20 employees + all HRMS-related data into Postgres.

Idempotent: wipes the employee tables (TRUNCATE ... CASCADE) then re-inserts.
Run from backend-python/:  .venv/bin/python -m scripts.seed_employees
"""
import asyncio

from sqlalchemy import text

from app.db import engine, get_session, init_db
from app.models.employee import (
    ClientReview, Education, Employee, Experience, PeerFeedback, PerformanceReview,
    ProjectReport, ReviewSection, Skill, TrainingRecord,
)
from scripts.generate_employee_data import generate

EMPLOYEE_TABLES = [
    "peer_feedback", "training_records", "client_reviews", "project_reports", "review_sections",
    "performance_reviews", "experience", "skills", "education", "employees",
]


async def seed() -> None:
    await init_db()
    data = generate()

    async with engine.begin() as conn:
        await conn.execute(text(f"TRUNCATE {', '.join(EMPLOYEE_TABLES)} CASCADE"))

    async with get_session() as s:
        # Pass 1: employees without manager (self-FK) so every id exists
        for e in data:
            s.add(Employee(
                id=e["id"], employee_id=e["employee_id"], name=e["name"], email=e["email"], phone=e["phone"],
                department=e["department"], role=e["role"], level=e["level"], hire_date=e["hire_date"],
                experience_years=e["experience_years"], status=e["status"], location=e["location"], bio=e["bio"],
            ))
        await s.flush()

        # Pass 2: managers + all child rows
        for e in data:
            emp = await s.get(Employee, e["id"])
            emp.manager_id = e["manager_id"]
            s.add_all(Education(employee_id=e["id"], **x) for x in e["education"])
            s.add_all(Skill(employee_id=e["id"], **x) for x in e["skills"])
            s.add_all(Experience(employee_id=e["id"], **x) for x in e["experience"])
            for r in e["performance_reviews"]:
                sections = r.pop("sections")
                s.add(PerformanceReview(employee_id=e["id"], **r,
                                        sections=[ReviewSection(**sec) for sec in sections]))
            for p in e["project_reports"]:
                reviews = p.pop("client_reviews")
                s.add(ProjectReport(employee_id=e["id"], **p,
                                    client_reviews=[ClientReview(**cr) for cr in reviews]))
            s.add_all(TrainingRecord(employee_id=e["id"], **x) for x in e["training_records"])
            s.add_all(PeerFeedback(employee_id=e["id"], **x) for x in e["peer_feedback"])
        await s.commit()

    async with engine.connect() as conn:
        for t in reversed(EMPLOYEE_TABLES):
            n = (await conn.execute(text(f"SELECT count(*) FROM {t}"))).scalar()
            print(f"{t:<22} {n}")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
