from typing import List, Dict

JOB_DESCRIPTIONS: List[Dict] = [
    {
        "id": "jd_001",
        "title": "Backend Software Engineer",
        "company": "TechCorp Inc.",
        "department": "Engineering",
        "required_skills": [
            "Python", "FastAPI", "Django", "PostgreSQL", "REST APIs",
            "Docker", "Redis", "Microservices", "Git", "Linux"
        ],
        "preferred_skills": ["Kubernetes", "AWS", "Kafka", "Go", "GraphQL"],
        "description": """
We are looking for a skilled Backend Software Engineer to design and build scalable server-side applications.
You will work on high-performance APIs, database architecture, and cloud infrastructure.

Responsibilities:
- Design and implement RESTful APIs using Python (FastAPI/Django)
- Manage PostgreSQL databases, write optimized queries
- Build and maintain microservices architecture
- Deploy and monitor services using Docker and Kubernetes
- Collaborate with frontend teams and product managers
- Write unit and integration tests; maintain 80%+ code coverage

Requirements:
- 3+ years of backend development experience
- Strong Python skills with FastAPI or Django
- Experience with PostgreSQL, Redis
- Familiarity with Docker, CI/CD pipelines
- Knowledge of REST API design principles
- Strong problem-solving and communication skills
        """,
        "experience_years": "3-5",
        "education": "B.Tech/B.E. in Computer Science or related field",
        "location": "Bangalore, India (Hybrid)",
    },
    {
        "id": "jd_002",
        "title": "Frontend Software Engineer",
        "company": "WebSolutions Ltd.",
        "department": "Product",
        "required_skills": [
            "React", "TypeScript", "JavaScript", "HTML5", "CSS3",
            "Tailwind CSS", "Redux", "REST APIs", "Git", "Webpack"
        ],
        "preferred_skills": ["Next.js", "GraphQL", "Jest", "Figma", "Storybook"],
        "description": """
Join our product team as a Frontend Software Engineer to craft intuitive, responsive web interfaces.
You'll collaborate closely with designers and backend engineers to deliver pixel-perfect user experiences.

Responsibilities:
- Build responsive React applications using TypeScript
- Implement state management with Redux/Zustand
- Integrate with backend REST APIs and GraphQL endpoints
- Write component tests using Jest and React Testing Library
- Work with Figma designs and translate them into production-ready UI
- Optimize performance using lazy loading, code splitting

Requirements:
- 3+ years of frontend development experience
- Strong proficiency in React and TypeScript
- Experience with Tailwind CSS or styled-components
- Understanding of browser performance optimization
- Experience with version control (Git)
- Eye for design and attention to detail
        """,
        "experience_years": "3-5",
        "education": "B.Tech/B.E. in Computer Science or related field",
        "location": "Mumbai, India (Remote)",
    }
]


def get_all_jobs() -> List[Dict]:
    return JOB_DESCRIPTIONS


def get_job_by_id(job_id: str) -> Dict | None:
    return next((jd for jd in JOB_DESCRIPTIONS if jd["id"] == job_id), None)


def get_job_text(job: Dict) -> str:
    """Returns a consolidated text representation of a job for embedding."""
    skills = ", ".join(job["required_skills"] + job.get("preferred_skills", []))
    return f"""
Job Title: {job['title']}
Company: {job['company']}
Required Skills: {skills}
Experience: {job['experience_years']} years
Education: {job['education']}
Description: {job['description']}
    """.strip()
