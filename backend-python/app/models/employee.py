"""Employee Profile System — SQLAlchemy Models (Normalized Schema)"""
import uuid
from datetime import date, datetime
from enum import Enum as PyEnum
from typing import Optional, List

from sqlalchemy import (
    Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint, Enum as SQLEnum
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base, Timestamps


class ReviewType(str, PyEnum):
    QUARTERLY = "quarterly"
    YEARLY = "yearly"
    QUARTERLY_YEARLY = "quarterly_yearly"


class ReviewPeriod(str, PyEnum):
    Q1 = "Q1"
    Q2 = "Q2"
    Q3 = "Q3"
    Q4 = "Q4"
    H1 = "H1"
    H2 = "H2"
    FY = "FY"


class ReviewStatus(str, PyEnum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    ACKNOWLEDGED = "acknowledged"
    FINALIZED = "finalized"


class SectionType(str, PyEnum):
    MANAGER_FEEDBACK = "manager_feedback"
    SELF_ASSESSMENT = "self_assessment"
    GOALS = "goals"
    ACHIEVEMENTS = "achievements"


class SkillCategory(str, PyEnum):
    TECHNICAL = "technical"
    SOFT = "soft"
    DOMAIN = "domain"
    LEADERSHIP = "leadership"


class ProficiencyLevel(int, PyEnum):
    NOVICE = 1
    BEGINNER = 2
    INTERMEDIATE = 3
    ADVANCED = 4
    EXPERT = 5


class ProjectOutcome(str, PyEnum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    ONGOING = "ongoing"


class TrainingStatus(str, PyEnum):
    COMPLETED = "completed"
    IN_PROGRESS = "in_progress"
    PLANNED = "planned"
    CANCELLED = "cancelled"


class PeerFeedbackCategory(str, PyEnum):
    COLLABORATION = "collaboration"
    TECHNICAL = "technical"
    COMMUNICATION = "communication"
    LEADERSHIP = "leadership"
    RELIABILITY = "reliability"


class EmployeeStatus(str, PyEnum):
    ACTIVE = "active"
    ON_LEAVE = "on_leave"
    TERMINATED = "terminated"


class EmployeeLevel(str, PyEnum):
    JUNIOR = "junior"
    MID = "mid"
    SENIOR = "senior"
    LEAD = "lead"
    PRINCIPAL = "principal"


class Department(str, PyEnum):
    ENGINEERING = "engineering"
    PRODUCT = "product"
    DESIGN = "design"
    DATA = "data"
    SALES = "sales"
    MARKETING = "marketing"
    OPERATIONS = "operations"
    HR = "hr"
    FINANCE = "finance"


class Employee(Timestamps, Base):
    __tablename__ = "employees"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    department: Mapped[Department] = mapped_column(SQLEnum(Department), index=True)
    role: Mapped[str] = mapped_column(String(100))
    level: Mapped[EmployeeLevel] = mapped_column(SQLEnum(EmployeeLevel), index=True)
    hire_date: Mapped[date] = mapped_column(Date, index=True)
    experience_years: Mapped[int] = mapped_column(Integer, default=0)
    manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True
    )
    status: Mapped[EmployeeStatus] = mapped_column(SQLEnum(EmployeeStatus), default=EmployeeStatus.ACTIVE, index=True)
    location: Mapped[str] = mapped_column(String(100), default="Remote")
    bio: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    manager: Mapped[Optional["Employee"]] = relationship(remote_side="Employee.id", back_populates="direct_reports")
    direct_reports: Mapped[List["Employee"]] = relationship(back_populates="manager")

    education: Mapped[List["Education"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    skills: Mapped[List["Skill"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    experience: Mapped[List["Experience"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    performance_reviews: Mapped[List["PerformanceReview"]] = relationship(back_populates="employee", foreign_keys="PerformanceReview.employee_id", cascade="all, delete-orphan")
    project_reports: Mapped[List["ProjectReport"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    training_records: Mapped[List["TrainingRecord"]] = relationship(back_populates="employee", cascade="all, delete-orphan")
    given_peer_feedback: Mapped[List["PeerFeedback"]] = relationship(foreign_keys="PeerFeedback.from_employee_id", back_populates="from_employee")
    received_peer_feedback: Mapped[List["PeerFeedback"]] = relationship(foreign_keys="PeerFeedback.employee_id", back_populates="employee")


class Education(Timestamps, Base):
    __tablename__ = "education"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    degree: Mapped[str] = mapped_column(String(100))
    field_of_study: Mapped[str] = mapped_column(String(100))
    institution: Mapped[str] = mapped_column(String(200))
    graduation_year: Mapped[int] = mapped_column(Integer)
    gpa: Mapped[Optional[float]] = mapped_column(nullable=True)
    honors: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship(back_populates="education")


class Skill(Timestamps, Base):
    __tablename__ = "skills"
    __table_args__ = (
        Index("ix_skills_employee_category", "employee_id", "category"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    skill_name: Mapped[str] = mapped_column(String(100), index=True)
    category: Mapped[SkillCategory] = mapped_column(SQLEnum(SkillCategory), index=True)
    proficiency: Mapped[ProficiencyLevel] = mapped_column(SQLEnum(ProficiencyLevel), default=ProficiencyLevel.BEGINNER)
    years_experience: Mapped[float] = mapped_column(default=0.0)
    last_used: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(default=True)

    employee: Mapped["Employee"] = relationship(back_populates="skills")


class Experience(Timestamps, Base):
    __tablename__ = "experience"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    company: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    is_current: Mapped[bool] = mapped_column(default=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    technologies: Mapped[List[str]] = mapped_column(ARRAY(String), default=list)
    achievements: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list)

    employee: Mapped["Employee"] = relationship(back_populates="experience")


class PerformanceReview(Timestamps, Base):
    __tablename__ = "performance_reviews"
    __table_args__ = (
        Index("ix_perf_reviews_employee_period", "employee_id", "review_period", "review_type"),
        Index("ix_perf_reviews_reviewer", "reviewer_id"),
        UniqueConstraint("employee_id", "review_period", "review_type", "period_start", name="uq_review_employee_period"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    review_period: Mapped[ReviewPeriod] = mapped_column(SQLEnum(ReviewPeriod), index=True)
    review_type: Mapped[ReviewType] = mapped_column(SQLEnum(ReviewType), index=True)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    review_date: Mapped[date] = mapped_column(Date, index=True)
    reviewer_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="SET NULL"), nullable=True)
    status: Mapped[ReviewStatus] = mapped_column(SQLEnum(ReviewStatus), default=ReviewStatus.DRAFT, index=True)
    overall_rating: Mapped[Optional[float]] = mapped_column(nullable=True)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    employee: Mapped["Employee"] = relationship(back_populates="performance_reviews", foreign_keys=[employee_id])
    reviewer: Mapped[Optional["Employee"]] = relationship(foreign_keys=[reviewer_id])
    sections: Mapped[List["ReviewSection"]] = relationship(back_populates="review", cascade="all, delete-orphan")


class ReviewSection(Timestamps, Base):
    __tablename__ = "review_sections"
    __table_args__ = (
        Index("ix_review_sections_review_type", "review_id", "section_type"),
        UniqueConstraint("review_id", "section_type", name="uq_review_section"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("performance_reviews.id", ondelete="CASCADE"), index=True)
    section_type: Mapped[SectionType] = mapped_column(SQLEnum(SectionType), index=True)
    content: Mapped[str] = mapped_column(Text)
    rating: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    review: Mapped["PerformanceReview"] = relationship(back_populates="sections")


class ProjectReport(Timestamps, Base):
    __tablename__ = "project_reports"
    __table_args__ = (
        Index("ix_projects_dates", "start_date", "end_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    project_name: Mapped[str] = mapped_column(String(200))
    client_name: Mapped[str] = mapped_column(String(200), index=True)
    role: Mapped[str] = mapped_column(String(100))
    start_date: Mapped[date] = mapped_column(Date, index=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    technologies: Mapped[List[str]] = mapped_column(ARRAY(String), default=list)
    team_size: Mapped[int] = mapped_column(Integer, default=1)
    outcome: Mapped[ProjectOutcome] = mapped_column(SQLEnum(ProjectOutcome), default=ProjectOutcome.ONGOING)
    project_value: Mapped[Optional[float]] = mapped_column(nullable=True)
    is_client_facing: Mapped[bool] = mapped_column(default=True)

    employee: Mapped["Employee"] = relationship(back_populates="project_reports")
    client_reviews: Mapped[List["ClientReview"]] = relationship(back_populates="project", cascade="all, delete-orphan")


class ClientReview(Timestamps, Base):
    __tablename__ = "client_reviews"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_report_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("project_reports.id", ondelete="CASCADE"), index=True)
    client_name: Mapped[str] = mapped_column(String(200))
    client_org: Mapped[str] = mapped_column(String(200))
    rating: Mapped[int] = mapped_column(Integer)
    feedback: Mapped[str] = mapped_column(Text)
    review_date: Mapped[date] = mapped_column(Date, index=True)
    would_recommend: Mapped[bool] = mapped_column(default=True)

    project: Mapped["ProjectReport"] = relationship(back_populates="client_reviews")


class TrainingRecord(Timestamps, Base):
    __tablename__ = "training_records"
    __table_args__ = (
        Index("ix_training_dates", "start_date", "completion_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    training_name: Mapped[str] = mapped_column(String(200))
    provider: Mapped[str] = mapped_column(String(200))
    category: Mapped[str] = mapped_column(String(100), index=True)
    start_date: Mapped[date] = mapped_column(Date)
    completion_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    hours: Mapped[float] = mapped_column(default=0.0)
    certification: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    score: Mapped[Optional[float]] = mapped_column(nullable=True)
    status: Mapped[TrainingStatus] = mapped_column(SQLEnum(TrainingStatus), default=TrainingStatus.PLANNED, index=True)

    employee: Mapped["Employee"] = relationship(back_populates="training_records")


class PeerFeedback(Timestamps, Base):
    __tablename__ = "peer_feedback"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    from_employee_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("employees.id", ondelete="CASCADE"), index=True)
    feedback_text: Mapped[str] = mapped_column(Text)
    rating: Mapped[int] = mapped_column(Integer)
    category: Mapped[PeerFeedbackCategory] = mapped_column(SQLEnum(PeerFeedbackCategory), index=True)
    feedback_date: Mapped[date] = mapped_column(Date, index=True)
    is_anonymous: Mapped[bool] = mapped_column(default=False)

    employee: Mapped["Employee"] = relationship(back_populates="received_peer_feedback", foreign_keys=[employee_id])
    from_employee: Mapped["Employee"] = relationship(back_populates="given_peer_feedback", foreign_keys=[from_employee_id])


