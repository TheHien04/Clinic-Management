# Documentation — Clinic Management System

> **Primary README** (full introduction, screenshots by module, setup, Docker): [README.md](../README.md)  
> **Repository:** [TheHien04/Clinic-Management](https://github.com/TheHien04/Clinic-Management)

The `docs/` folder contains deep-dive guides, playbooks, and technical notes supporting the **Advanced Database** course outcomes and professional delivery practices (security, testing, DevOps).

---

## Repository layout

```
Clinic-Management/
├── backend/       # Node.js / Express API, versioned migrations
├── frontend/      # React 19 + Vite SPA
├── Data/          # Extended SQL (indexes, views, procedures, partitioning, …)
├── assets/        # Screenshots for README and reports
├── docs/          # This index and technical guides
├── scripts/       # Local development helpers
├── .github/       # CI/CD workflows
├── docker-compose.yml
└── README.md      # GitHub landing page
```

---

## Documentation index

| Document | Description |
|----------|-------------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Environment setup |
| [ADVANCED_DATABASE_FEATURES.md](ADVANCED_DATABASE_FEATURES.md) | Advanced database features showcased in the project |
| [BACKEND_API_GUIDE.md](BACKEND_API_GUIDE.md) | API reference and integration notes |
| [SECURITY_GUIDE.md](SECURITY_GUIDE.md) | Security hardening and review checklist |
| [DEVOPS_DOCKER_CICD.md](DEVOPS_DOCKER_CICD.md) | Docker and CI/CD |
| [TESTING_PERFORMANCE_SECURITY.md](TESTING_PERFORMANCE_SECURITY.md) | Testing, performance, and security testing |
| [CHANGELOG.md](CHANGELOG.md) | Change history |

Additional playbooks (release train, sustainability, branch protection, etc.) live alongside these files in `docs/`.

---

## Academic and engineering focus

The project emphasizes **schema normalization**, **indexing and query optimization**, **stored procedures and triggers**, **versioned migrations**, and **OLAP-style reporting** on Microsoft SQL Server — combined with a modern **REST + real-time** application tier consistent with **backend / data engineering** delivery standards.

Screenshots are stored under [`../assets/`](../assets/) and embedded in the root [README.md](../README.md).
