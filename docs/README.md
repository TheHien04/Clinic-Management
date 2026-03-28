# Tài liệu dự án — Clinic Management System

> **README chính (giới thiệu đầy đủ, ảnh từng module, cài đặt, Docker):** [README.md](../README.md)  
> **Repository:** [TheHien04/Clinic-Management](https://github.com/TheHien04/Clinic-Management)

Thư mục `docs/` chứa hướng dẫn chuyên sâu, playbook và báo cáo kỹ thuật bổ sung cho đồ án **Cơ sở dữ liệu nâng cao** và các tiêu chuẩn triển khai phần mềm.

---

## Cấu trúc repository

```
Clinic-Management/
├── backend/       # API Node.js / Express, migrations
├── frontend/      # React 19 + Vite
├── Data/          # Script SQL nâng cao (index, view, SP, partition, …)
├── assets/        # Ảnh minh họa cho README & báo cáo
├── docs/          # Tài liệu (file này và các guide)
├── scripts/       # Script dev ổn định (local)
├── .github/       # CI/CD
├── docker-compose.yml
└── README.md      # Cửa chính GitHub
```

---

## Mục lục tài liệu (chọn lọc)

| Tài liệu | Nội dung |
|----------|-----------|
| [SETUP_GUIDE.md](SETUP_GUIDE.md) | Cài đặt môi trường |
| [ADVANCED_DATABASE_FEATURES.md](ADVANCED_DATABASE_FEATURES.md) | Tính năng CSDL nâng cao trong đồ án |
| [BACKEND_API_GUIDE.md](BACKEND_API_GUIDE.md) | Hợp đồng / endpoint API |
| [SECURITY_GUIDE.md](SECURITY_GUIDE.md) | Hardening, kiểm tra bảo mật |
| [DEVOPS_DOCKER_CICD.md](DEVOPS_DOCKER_CICD.md) | Docker, CI/CD |
| [TESTING_PERFORMANCE_SECURITY.md](TESTING_PERFORMANCE_SECURITY.md) | Kiểm thử & hiệu năng |
| [CHANGELOG.md](CHANGELOG.md) | Nhật ký thay đổi |

*Các playbook khác (release train, sustainability, branch protection…) nằm cùng thư mục `docs/`.*

---

## Ghi chú học thuật

Dự án nhấn mạnh: **chuẩn hóa lược đồ**, **index & tối ưu truy vấn**, **stored procedure / trigger**, **migration có phiên bản**, và **báo cáo OLAP-style** trên SQL Server — kết hợp tầng ứng dụng hiện đại (REST + realtime) đúng hướng một **kỹ sư dữ liệu / backend** triển khai hệ thống thực tế.

Ảnh chụp màn hình theo từng trang nằm trong [`../assets/`](../assets/) và được nhúng trong [README.md](../README.md).
