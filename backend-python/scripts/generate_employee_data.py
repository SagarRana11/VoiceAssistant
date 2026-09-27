"""Deterministic HRMS-style data factory for 20 employees.

Each employee gets a persistent "persona" (strengths, concerns, career goal, rating trend) so that
3 years of reviews, peer feedback and training read coherently — the RAG layer needs real signal
to answer "what skills were demonstrated repeatedly" or "what concerns keep coming up".

Pure stdlib (seeded `random`) so output is reproducible and needs no extra dependency.
Returns plain dicts keyed by model field names; `seed_employees.py` turns them into ORM rows.
"""
import random
import uuid
from datetime import date, timedelta

from app.models.employee import (
    Department, EmployeeLevel, EmployeeStatus, PeerFeedbackCategory, ProficiencyLevel,
    ProjectOutcome, ReviewPeriod, ReviewStatus, ReviewType, SectionType, SkillCategory, TrainingStatus,
)

SEED = 42
TODAY = date(2026, 9, 25)
REVIEW_YEARS = [2024, 2025, 2026]

# ---------------------------------------------------------------------------------------------
# Roster: (name, department, level, experience_years). John Smith first — demo subject for RAG.
# Eng 8, Product 4, Design 3, Data 3, Sales 2 | Junior 5, Mid 7, Senior 5, Lead 2, Principal 1
# ---------------------------------------------------------------------------------------------
ROSTER = [
    ("John Smith", Department.ENGINEERING, EmployeeLevel.SENIOR, 8),
    ("Priya Sharma", Department.ENGINEERING, EmployeeLevel.PRINCIPAL, 15),
    ("Marcus Chen", Department.ENGINEERING, EmployeeLevel.LEAD, 11),
    ("Aisha Khan", Department.ENGINEERING, EmployeeLevel.MID, 4),
    ("Diego Alvarez", Department.ENGINEERING, EmployeeLevel.MID, 5),
    ("Emily Walker", Department.ENGINEERING, EmployeeLevel.JUNIOR, 1),
    ("Rahul Verma", Department.ENGINEERING, EmployeeLevel.JUNIOR, 2),
    ("Sofia Rossi", Department.ENGINEERING, EmployeeLevel.SENIOR, 9),
    ("Nina Patel", Department.PRODUCT, EmployeeLevel.LEAD, 12),
    ("Tom Becker", Department.PRODUCT, EmployeeLevel.SENIOR, 7),
    ("Grace Liu", Department.PRODUCT, EmployeeLevel.MID, 5),
    ("Omar Haddad", Department.PRODUCT, EmployeeLevel.JUNIOR, 2),
    ("Hannah Kim", Department.DESIGN, EmployeeLevel.SENIOR, 8),
    ("Lucas Moreau", Department.DESIGN, EmployeeLevel.MID, 4),
    ("Zara Ahmed", Department.DESIGN, EmployeeLevel.JUNIOR, 1),
    ("Arjun Nair", Department.DATA, EmployeeLevel.SENIOR, 7),
    ("Mei Tanaka", Department.DATA, EmployeeLevel.MID, 3),
    ("Samuel Okafor", Department.DATA, EmployeeLevel.MID, 6),
    ("Olivia Brown", Department.SALES, EmployeeLevel.MID, 3),
    ("Ethan Wright", Department.SALES, EmployeeLevel.JUNIOR, 3),
]

LOCATIONS = ["Bengaluru", "Gurugram", "London", "Berlin", "New York", "Remote", "Singapore", "Toronto"]

ROLE_BY_DEPT_LEVEL = {
    Department.ENGINEERING: {"junior": "Software Engineer I", "mid": "Software Engineer II", "senior": "Senior Software Engineer",
                             "lead": "Engineering Lead", "principal": "Principal Engineer"},
    Department.PRODUCT: {"junior": "Associate Product Manager", "mid": "Product Manager", "senior": "Senior Product Manager",
                         "lead": "Group Product Manager", "principal": "Director of Product"},
    Department.DESIGN: {"junior": "Product Designer I", "mid": "Product Designer II", "senior": "Senior Product Designer",
                        "lead": "Design Lead", "principal": "Principal Designer"},
    Department.DATA: {"junior": "Data Analyst", "mid": "Data Scientist", "senior": "Senior Data Scientist",
                      "lead": "Data Science Lead", "principal": "Principal Data Scientist"},
    Department.SALES: {"junior": "Sales Development Rep", "mid": "Account Executive", "senior": "Senior Account Executive",
                       "lead": "Sales Lead", "principal": "VP Sales"},
}

# Skill pools per department: (name, category)
SKILLS = {
    Department.ENGINEERING: [("Python", "technical"), ("TypeScript", "technical"), ("PostgreSQL", "technical"),
                             ("AWS", "technical"), ("Kubernetes", "technical"), ("System Design", "technical"),
                             ("FastAPI", "technical"), ("React", "technical"), ("CI/CD", "technical"), ("Go", "technical")],
    Department.PRODUCT: [("Roadmapping", "domain"), ("User Research", "domain"), ("SQL", "technical"),
                         ("A/B Testing", "domain"), ("Jira", "technical"), ("Market Analysis", "domain"),
                         ("PRD Writing", "domain")],
    Department.DESIGN: [("Figma", "technical"), ("Design Systems", "domain"), ("Prototyping", "technical"),
                        ("Usability Testing", "domain"), ("Accessibility", "domain"), ("Motion Design", "technical")],
    Department.DATA: [("Python", "technical"), ("SQL", "technical"), ("Machine Learning", "technical"),
                      ("dbt", "technical"), ("Statistics", "domain"), ("Airflow", "technical"), ("Tableau", "technical")],
    Department.SALES: [("Salesforce", "technical"), ("Negotiation", "soft"), ("Account Planning", "domain"),
                       ("Pipeline Management", "domain"), ("Solution Selling", "domain")],
}
SOFT_SKILLS = [("Communication", "soft"), ("Mentoring", "leadership"), ("Stakeholder Management", "soft"),
               ("Problem Solving", "soft"), ("Ownership", "leadership"), ("Time Management", "soft")]

# Persona building blocks. Each strength/concern ties to a skill so the RAG can connect them.
STRENGTHS = {
    Department.ENGINEERING: ["system design and scalable architecture", "API design with FastAPI and Python",
                             "debugging production incidents quickly", "code review quality and mentoring juniors",
                             "cloud infrastructure on AWS and Kubernetes", "shipping frontend features in React"],
    Department.PRODUCT: ["crisp PRD writing", "running user research interviews", "data-driven prioritization",
                         "cross-team alignment on roadmaps", "A/B experiment design"],
    Department.DESIGN: ["building and maintaining the design system", "rapid high-fidelity prototyping",
                        "accessibility-first design", "running usability studies"],
    Department.DATA: ["building reliable ML pipelines", "clear statistical analysis for stakeholders",
                      "dbt data modelling", "dashboarding in Tableau"],
    Department.SALES: ["closing enterprise deals", "consultative solution selling", "account expansion",
                       "accurate pipeline forecasting"],
}
CONCERNS = [
    ("underestimates task effort, leading to missed sprint commitments", "Time Management"),
    ("documentation is often incomplete or written after the fact", "Technical Writing"),
    ("hesitant to delegate and tends to take on too much work alone", "Delegation"),
    ("communication with non-technical stakeholders can be too detailed", "Stakeholder Communication"),
    ("inconsistent test coverage on new features", "Testing Practices"),
    ("slow to escalate blockers", "Proactive Communication"),
    ("needs more visibility in cross-team forums", "Executive Presence"),
    ("struggles to say no to scope creep", "Prioritization"),
]
CAREER_GOALS = {
    EmployeeLevel.JUNIOR: ["get promoted to the mid level within two years", "own a feature end to end",
                           "deepen core technical skills and gain a certification"],
    EmployeeLevel.MID: ["grow into a senior role and lead a project", "become the go-to expert for a core area",
                        "start mentoring new joiners"],
    EmployeeLevel.SENIOR: ["move into a lead role managing a small team", "become a technical/domain architect",
                           "drive a cross-team initiative from strategy to delivery"],
    EmployeeLevel.LEAD: ["grow into a principal / director position", "scale the team and build a hiring pipeline",
                         "shape the department's multi-year strategy"],
    EmployeeLevel.PRINCIPAL: ["set org-wide technical direction", "build an internal technical community",
                              "represent the company at external conferences"],
}
TRAININGS = {
    "Time Management": ("Getting Things Done: Productivity Workshop", "LinkedIn Learning", "soft_skills", None),
    "Technical Writing": ("Technical Writing One & Two", "Google Developers", "communication", None),
    "Delegation": ("Delegating for Leaders", "Coursera", "leadership", None),
    "Stakeholder Communication": ("Communicating with Impact", "Dale Carnegie", "communication", None),
    "Testing Practices": ("Test-Driven Development in Python", "Pluralsight", "technical", None),
    "Proactive Communication": ("Crucial Conversations", "VitalSmarts", "communication", "Crucial Conversations Certified"),
    "Executive Presence": ("Executive Presence Program", "Harvard ManageMentor", "leadership", None),
    "Prioritization": ("Agile Prioritization Techniques", "Scrum.org", "process", "Professional Scrum Master I"),
}
TECH_TRAININGS = {
    Department.ENGINEERING: [("AWS Solutions Architect Associate", "AWS", "AWS Certified Solutions Architect – Associate"),
                             ("Certified Kubernetes Application Developer", "CNCF", "CKAD"),
                             ("Advanced System Design", "Educative", None), ("Go Fundamentals", "Pluralsight", None)],
    Department.PRODUCT: [("Product Management Certification", "Pragmatic Institute", "PMC-III"),
                         ("SQL for Product Managers", "Mode", None), ("Certified Scrum Product Owner", "Scrum Alliance", "CSPO")],
    Department.DESIGN: [("Google UX Design Certificate", "Coursera", "Google UX Design Certificate"),
                        ("Accessibility Fundamentals (WCAG 2.2)", "Deque", "IAAP CPACC"), ("Advanced Figma", "Figma", None)],
    Department.DATA: [("Machine Learning Specialization", "Coursera", "DeepLearning.AI ML Specialization"),
                      ("dbt Fundamentals", "dbt Labs", "dbt Analytics Engineering Certification"),
                      ("TensorFlow Developer", "Google", "TensorFlow Developer Certificate")],
    Department.SALES: [("MEDDICC Sales Methodology", "MEDDICC", "MEDDICC Certified"),
                       ("Salesforce Administrator", "Salesforce", "Salesforce Certified Administrator"),
                       ("Negotiation Mastery", "Harvard Online", None)],
}
COMPANIES = ["Infosys", "TCS", "Accenture", "Thoughtworks", "Zoho", "Freshworks", "Flipkart", "Razorpay",
             "Atlassian", "Shopify", "Deloitte", "Capgemini", "Swiggy", "Paytm"]
CLIENTS = [("Acme Retail", "Acme Corp"), ("Globex Logistics", "Globex"), ("Initech Banking", "Initech"),
           ("Umbrella Health", "Umbrella Group"), ("Stark Energy", "Stark Industries"), ("Wayne Finance", "Wayne Enterprises"),
           ("Hooli Cloud", "Hooli"), ("Soylent Foods", "Soylent")]
PROJECT_THEMES = ["Customer Portal Revamp", "Payments Gateway Migration", "Analytics Dashboard", "Mobile App v2",
                  "Recommendation Engine", "Inventory Forecasting", "Onboarding Redesign", "Data Lake Consolidation",
                  "Loyalty Program", "Claims Automation", "Chatbot Assistant", "Pricing Optimization"]
DEGREES = [("B.Tech", "Computer Science"), ("B.E.", "Information Technology"), ("M.Tech", "Software Engineering"),
           ("MBA", "Marketing"), ("B.Des", "Interaction Design"), ("M.Sc", "Statistics"), ("B.Sc", "Mathematics"),
           ("BBA", "Business Administration"), ("M.S.", "Data Science")]
DEGREE_BY_DEPT = {Department.ENGINEERING: [0, 1, 2], Department.PRODUCT: [0, 3, 7], Department.DESIGN: [4, 4, 1],
                  Department.DATA: [5, 6, 8], Department.SALES: [7, 3, 6]}
INSTITUTIONS = ["IIT Delhi", "IIT Bombay", "BITS Pilani", "NIT Trichy", "Delhi University", "NID Ahmedabad",
                "IIM Bangalore", "University of Toronto", "TU Munich", "University of Manchester"]

QUARTERS = [(ReviewPeriod.Q1, 1, 3), (ReviewPeriod.Q2, 4, 6), (ReviewPeriod.Q3, 7, 9), (ReviewPeriod.Q4, 10, 12)]


def _month_end(y: int, m: int) -> date:
    return (date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1))


def _slug(name: str) -> str:
    return name.lower().replace(" ", ".")


def _rating_for(persona: dict, year_idx: int, q_idx: int, rng: random.Random) -> float:
    """Base + trend over time + noise, clamped to 1..5."""
    t = year_idx + q_idx / 4
    r = persona["base_rating"] + persona["trend"] * t + rng.uniform(-0.3, 0.3)
    return round(max(1.0, min(5.0, r)), 1)


def _persona(dept: Department, level: EmployeeLevel, rng: random.Random) -> dict:
    strengths = rng.sample(STRENGTHS[dept], 2)
    concerns = rng.sample(CONCERNS, 2)
    return {
        "strengths": strengths,
        "concerns": concerns,  # [(text, training_key)]
        "goal": rng.choice(CAREER_GOALS[level]),
        "base_rating": rng.uniform(3.0, 3.9),
        "trend": rng.choice([0.25, 0.15, 0.05, -0.1]),  # improving / steady / declining
    }


def _review_sections(first: str, persona: dict, rating: float, period_label: str, is_yearly: bool, rng: random.Random) -> list[dict]:
    s1, s2 = persona["strengths"]
    c1, c2 = persona["concerns"][0][0], persona["concerns"][1][0]
    concern = c1 if rng.random() < 0.65 else c2
    tone = "exceeded expectations" if rating >= 4.2 else "met expectations" if rating >= 3.4 else "fell short of expectations"
    scope = "this year" if is_yearly else "this quarter"
    mgr = (f"{first} {tone} {scope} ({period_label}). Consistently strong in {s1}; also showed real impact in {s2}. "
           f"Area to work on: {concern}. "
           + ("Overall trajectory is positive and I would support a stretch assignment."
              if persona["trend"] > 0.1 else
              "Performance is steady; would like to see more initiative on the growth areas."
              if persona["trend"] >= 0 else
              "Output has dipped compared to earlier periods; we agreed on a focused improvement plan."))
    self_a = (f"I'm most proud of my work in {s1} {scope}. I know {concern.split(',')[0]} is something I need to improve "
              f"and I've started addressing it. I'd rate myself around {min(5, round(rating + rng.choice([0, 0.3, 0.5]), 1))}/5.")
    goals = (f"Career goal: {persona['goal']}. Next period I plan to: "
             f"1) deepen {s2}, 2) address feedback on {concern.split(',')[0]}, "
             f"3) {'take ownership of a larger initiative' if persona['trend'] > 0 else 'deliver committed work on time'}.")
    ach = (f"Delivered key milestones leveraging {s1}; "
           f"{rng.choice(['reduced p95 latency by 30%', 'shipped the release two weeks early', 'onboarded two new teammates', 'closed a critical client escalation', 'cut cloud cost by 18%', 'improved NPS by 6 points', 'automated a manual weekly report'])}; "
           f"{rng.choice(['presented at the internal tech talk', 'led the quarterly retro', 'contributed to the hiring panel', 'wrote the team playbook section'])}.")
    r = lambda: max(1, min(5, round(rating + rng.uniform(-0.6, 0.6))))  # noqa: E731
    return [
        {"section_type": SectionType.MANAGER_FEEDBACK, "content": mgr, "rating": r()},
        {"section_type": SectionType.SELF_ASSESSMENT, "content": self_a, "rating": r()},
        {"section_type": SectionType.GOALS, "content": goals, "rating": None},
        {"section_type": SectionType.ACHIEVEMENTS, "content": ach, "rating": r()},
    ]


def generate(seed: int = SEED) -> list[dict]:
    rng = random.Random(seed)
    employees: list[dict] = []

    for i, (name, dept, level, exp) in enumerate(ROSTER, start=1):
        first = name.split()[0]
        persona = _persona(dept, level, rng)
        tenure = min(exp, rng.randint(3, 6)) if exp >= 3 else exp  # years at this company
        hire_date = date(TODAY.year - tenure, rng.randint(1, 12), rng.randint(1, 28))
        # juniors hired recently still get 3 years of reviews for demo density; clamp hire date
        hire_date = min(hire_date, date(2023, 12, 1))

        emp = {
            "id": uuid.uuid4(), "employee_id": f"EMP{1000 + i}", "name": name,
            "email": f"{_slug(name)}@company.com", "phone": f"+91-9{rng.randint(100000000, 999999999)}",
            "department": dept, "role": ROLE_BY_DEPT_LEVEL[dept][level.value], "level": level,
            "hire_date": hire_date, "experience_years": exp, "status": EmployeeStatus.ACTIVE,
            "location": rng.choice(LOCATIONS),
            "bio": f"{name} is a {ROLE_BY_DEPT_LEVEL[dept][level.value]} with {exp} years of experience, "
                   f"known for {persona['strengths'][0]}. Career goal: {persona['goal']}.",
            "persona": persona,
        }

        # Education: 1 degree, +1 postgrad for senior+ half the time
        opts = DEGREE_BY_DEPT[dept]
        grad_year = TODAY.year - exp - rng.randint(0, 1)
        edu = [{"degree": DEGREES[opts[0]][0], "field_of_study": DEGREES[opts[0]][1],
                "institution": rng.choice(INSTITUTIONS), "graduation_year": grad_year,
                "gpa": round(rng.uniform(6.8, 9.6), 2), "honors": rng.choice([None, None, "Dean's List", "Gold Medalist"])}]
        if level in (EmployeeLevel.SENIOR, EmployeeLevel.LEAD, EmployeeLevel.PRINCIPAL) and rng.random() < 0.5:
            d = DEGREES[rng.choice(opts[1:])]
            edu.append({"degree": d[0], "field_of_study": d[1], "institution": rng.choice(INSTITUTIONS),
                        "graduation_year": grad_year + 2, "gpa": round(rng.uniform(7, 9.5), 2),
                        "honors": None})
        emp["education"] = edu

        # Skills: dept skills + 2 soft
        pool = SKILLS[dept]
        n = min(len(pool), rng.randint(4, 7))
        lvl_bonus = {"junior": 0, "mid": 1, "senior": 2, "lead": 2, "principal": 3}[level.value]
        emp["skills"] = [
            {"skill_name": s, "category": SkillCategory(c),
             "proficiency": ProficiencyLevel(max(1, min(5, 2 + lvl_bonus + rng.choice([-1, 0, 0, 1])))),
             "years_experience": round(min(exp, rng.uniform(0.5, exp)), 1),
             "last_used": TODAY - timedelta(days=rng.randint(0, 200)), "is_current": rng.random() < 0.9}
            for s, c in rng.sample(pool, n)
        ] + [
            {"skill_name": s, "category": SkillCategory(c),
             "proficiency": ProficiencyLevel(max(1, min(5, 2 + lvl_bonus // 2 + rng.choice([0, 1])))),
             "years_experience": round(rng.uniform(1, max(1.5, exp)), 1), "last_used": TODAY, "is_current": True}
            for s, c in rng.sample(SOFT_SKILLS, 2)
        ]

        # Prior experience: career before hire_date, back to (exp) years ago
        prior_years = exp - (TODAY.year - hire_date.year)
        jobs, cursor = [], hire_date - timedelta(days=rng.randint(15, 60))
        remaining = max(0, prior_years)
        while remaining > 0:
            span = min(remaining, rng.randint(1, 4))
            start = cursor - timedelta(days=365 * span)
            tech = [s for s, _ in rng.sample(pool, min(3, len(pool)))]
            jobs.append({"company": rng.choice(COMPANIES), "role": ROLE_BY_DEPT_LEVEL[dept][
                "junior" if remaining == prior_years else "mid"], "start_date": start, "end_date": cursor,
                "is_current": False, "description": f"Worked on {rng.choice(PROJECT_THEMES).lower()} using {', '.join(tech)}.",
                "technologies": tech, "achievements": [f"Recognized for {rng.choice(STRENGTHS[dept])}"]})
            cursor = start - timedelta(days=rng.randint(10, 45))
            remaining -= span
        jobs.append({"company": "Company (current)", "role": emp["role"], "start_date": hire_date, "end_date": None,
                     "is_current": True, "description": f"Current role focusing on {persona['strengths'][0]}.",
                     "technologies": [s for s, _ in pool[:3]], "achievements": []})
        emp["experience"] = jobs

        # Performance reviews: 3 years × (Q1..Q4 + FY)
        reviews = []
        for yi, y in enumerate(REVIEW_YEARS):
            q_ratings = []
            for qi, (period, m0, m1) in enumerate(QUARTERS):
                p_start, p_end = date(y, m0, 1), _month_end(y, m1)
                rating = _rating_for(persona, yi, qi, rng)
                q_ratings.append(rating)
                review_date = p_end + timedelta(days=rng.randint(7, 20))
                status = ReviewStatus.FINALIZED if review_date < TODAY else ReviewStatus.DRAFT
                reviews.append({"review_period": period, "review_type": ReviewType.QUARTERLY,
                                "period_start": p_start, "period_end": p_end, "review_date": review_date,
                                "status": status, "overall_rating": rating if status != ReviewStatus.DRAFT else None,
                                "summary": f"{period.value} {y} quarterly review for {name}.",
                                "sections": _review_sections(first, persona, rating, f"{period.value} {y}", False, rng)})
            fy_rating = round(sum(q_ratings) / 4, 1)
            fy_date = date(y + 1, 1, rng.randint(15, 31))
            status = ReviewStatus.FINALIZED if fy_date < TODAY else ReviewStatus.DRAFT
            reviews.append({"review_period": ReviewPeriod.FY, "review_type": ReviewType.YEARLY,
                            "period_start": date(y, 1, 1), "period_end": date(y, 12, 31), "review_date": fy_date,
                            "status": status, "overall_rating": fy_rating if status != ReviewStatus.DRAFT else None,
                            "summary": f"FY{y} annual review for {name}. Average quarterly rating {fy_rating}/5.",
                            "sections": _review_sections(first, persona, fy_rating, f"FY{y}", True, rng)})
        emp["performance_reviews"] = reviews

        # Projects: 2-8, 60% with client review
        projects = []
        for _ in range(rng.randint(2, 8)):
            client, org = rng.choice(CLIENTS)
            start = date(rng.choice([2022, 2023, 2024, 2025, 2026]), rng.randint(1, 12), 1)
            start = max(start, hire_date)
            end = start + timedelta(days=rng.randint(60, 400))
            ongoing = end > TODAY
            outcome = ProjectOutcome.ONGOING if ongoing else rng.choices(
                [ProjectOutcome.SUCCESS, ProjectOutcome.PARTIAL, ProjectOutcome.FAILED], [7, 2, 1])[0]
            proj = {"project_name": f"{client} — {rng.choice(PROJECT_THEMES)}", "client_name": client,
                    "role": emp["role"], "start_date": start, "end_date": None if ongoing else end,
                    "description": f"{first} contributed {persona['strengths'][0]} to the engagement.",
                    "technologies": [s for s, _ in rng.sample(pool, min(3, len(pool)))], "team_size": rng.randint(3, 15),
                    "outcome": outcome, "project_value": float(rng.randrange(50_000, 1_500_000, 10_000)),
                    "is_client_facing": True, "client_reviews": []}
            if rng.random() < 0.6 and not ongoing:
                cr = {ProjectOutcome.SUCCESS: rng.randint(4, 5), ProjectOutcome.PARTIAL: 3, ProjectOutcome.FAILED: rng.randint(1, 2)}[outcome]
                proj["client_reviews"].append({
                    "client_name": f"{rng.choice(['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan'])} {rng.choice(['Reed', 'Hale', 'Park', 'Singh', 'Lopez'])}",
                    "client_org": org, "rating": cr, "review_date": end + timedelta(days=rng.randint(5, 30)),
                    "would_recommend": cr >= 4,
                    "feedback": (f"{first} was excellent — especially {persona['strengths'][0]}." if cr >= 4 else
                                 f"Solid work by {first}, though {persona['concerns'][0][0]}." if cr == 3 else
                                 f"Delivery issues on this project; {persona['concerns'][0][0]}.")})
            projects.append(proj)
        emp["project_reports"] = projects

        # Training: 3-12, concern-driven remedial + dept certifications
        trainings = []
        for _, key in persona["concerns"]:
            tname, prov, cat, cert = TRAININGS[key]
            s = date(rng.choice([2025, 2026]), rng.randint(1, 9), 1)
            trainings.append((tname, prov, cat, cert, s))
        for tname, prov, cert in TECH_TRAININGS[dept]:
            trainings.append((tname, prov, "technical", cert, date(rng.choice([2023, 2024, 2025, 2026]), rng.randint(1, 12), 1)))
        extra = ["Security Awareness", "Diversity & Inclusion", "Leading Effective 1:1s", "Presentation Skills",
                 "Agile Fundamentals", "GenAI for Professionals", "Design Thinking", "Financial Acumen"]
        for tname in rng.sample(extra, rng.randint(1, 7)):
            trainings.append((tname, "Internal L&D", "general", None, date(rng.choice([2023, 2024, 2025, 2026]), rng.randint(1, 12), 1)))
        trainings = trainings[:12]
        recs = []
        for tname, prov, cat, cert, s in trainings:
            s = max(s, hire_date)
            done = s + timedelta(days=rng.randint(14, 90))
            status = (TrainingStatus.COMPLETED if done < TODAY else
                      TrainingStatus.IN_PROGRESS if s < TODAY else TrainingStatus.PLANNED)
            if rng.random() < 0.05:
                status = TrainingStatus.CANCELLED
            recs.append({"training_name": tname, "provider": prov, "category": cat, "start_date": s,
                         "completion_date": done if status == TrainingStatus.COMPLETED else None,
                         "hours": float(rng.choice([4, 8, 12, 16, 24, 40])),
                         "certification": cert if status == TrainingStatus.COMPLETED else None,
                         "score": round(rng.uniform(70, 99), 1) if status == TrainingStatus.COMPLETED else None,
                         "status": status})
        emp["training_records"] = recs
        employees.append(emp)

    _assign_managers(employees)
    _add_peer_feedback(employees, rng)
    return employees


def _assign_managers(employees: list[dict]) -> None:
    """Principal manages leads & seniors without a lead; leads manage their dept; others report to dept senior/principal."""
    principal = next(e for e in employees if e["level"] == EmployeeLevel.PRINCIPAL)
    leads = {e["department"]: e for e in employees if e["level"] == EmployeeLevel.LEAD}
    seniors = {}
    for e in employees:
        if e["level"] == EmployeeLevel.SENIOR:
            seniors.setdefault(e["department"], e)
    for e in employees:
        if e is principal:
            e["manager_id"] = None
        elif e["level"] == EmployeeLevel.LEAD:
            e["manager_id"] = principal["id"]
        else:
            boss = leads.get(e["department"]) or (seniors.get(e["department"]) if e["level"] != EmployeeLevel.SENIOR else None) or principal
            e["manager_id"] = boss["id"] if boss is not e else principal["id"]
    # Reviewer of every performance review = manager
    for e in employees:
        for r in e["performance_reviews"]:
            r["reviewer_id"] = e["manager_id"]


PEER_TEMPLATES = {
    PeerFeedbackCategory.COLLABORATION: ["Great to pair with — {s}.", "Always willing to help unblock the team."],
    PeerFeedbackCategory.TECHNICAL: ["Deep expertise in {s}; learned a lot from them.", "Their work on {s} raised the bar."],
    PeerFeedbackCategory.COMMUNICATION: ["Clear in standups, but {c}.", "Explains complex topics well."],
    PeerFeedbackCategory.LEADERSHIP: ["Steps up during incidents and keeps everyone calm.", "Would benefit from more delegation; {c}."],
    PeerFeedbackCategory.RELIABILITY: ["Dependable on commitments.", "Sometimes {c}."],
}


def _add_peer_feedback(employees: list[dict], rng: random.Random) -> None:
    """2-5 peer feedback entries per review cycle (15 cycles), from colleagues (prefer same dept)."""
    for e in employees:
        same = [o for o in employees if o is not e and o["department"] == e["department"]]
        others = [o for o in employees if o is not e]
        fb = []
        for r in e["performance_reviews"]:
            if r["review_date"] >= TODAY:
                continue
            for _ in range(rng.randint(2, 5)):
                giver = rng.choice(same if same and rng.random() < 0.7 else others)
                cat = rng.choice(list(PeerFeedbackCategory))
                text = rng.choice(PEER_TEMPLATES[cat]).format(
                    s=rng.choice(e["persona"]["strengths"]), c=rng.choice(e["persona"]["concerns"])[0])
                rating = max(1, min(5, round(e["persona"]["base_rating"] + rng.uniform(-0.8, 1.0))))
                fb.append({"from_employee_id": giver["id"], "feedback_text": text, "rating": rating,
                           "category": cat, "feedback_date": r["period_end"] - timedelta(days=rng.randint(0, 20)),
                           "is_anonymous": rng.random() < 0.3})
        e["peer_feedback"] = fb


if __name__ == "__main__":
    data = generate()
    for e in data:
        print(f"{e['employee_id']} {e['name']:<16} {e['department'].value:<12} {e['level'].value:<9} "
              f"exp={e['experience_years']:<2} reviews={len(e['performance_reviews'])} projects={len(e['project_reports'])} "
              f"training={len(e['training_records'])} peer_fb={len(e['peer_feedback'])}")
