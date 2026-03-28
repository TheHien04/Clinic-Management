# 🔒 Security & Penetration Testing Guide

## 1. Enabling HTTPS/TLS (Production)
- **Always deploy with HTTPS in production.**
- Use Nginx or a cloud load balancer to terminate SSL.
- Example Nginx config:
  ```nginx
  server {
    listen 443 ssl;
    server_name your-domain.com;
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    ...
    location / {
      proxy_pass http://backend:5000;
      ...
    }
  }
  ```
- For local testing, use [mkcert](https://github.com/FiloSottile/mkcert) to generate self-signed certs.

## 2. SQL Injection Testing
- **All queries use parameterized statements.**
- To test, try sending payloads like:
  - `' OR 1=1--`
  - `'; DROP TABLE Patients;--`
- API should return error or sanitized result, never execute raw SQL.
- Use tools: [sqlmap](https://sqlmap.org/), Postman, Burp Suite.

## 3. XSS (Cross-Site Scripting) Testing
- **All user input is sanitized on backend and frontend.**
- Try submitting payloads:
  - `<script>alert('xss')</script>`
  - `<img src=x onerror=alert(1)>`
- App should display as plain text, not execute scripts.
- Use browser dev tools, Burp Suite, or [XSS Hunter](https://xsshunter.com/).

## 4. CSRF (Cross-Site Request Forgery) Testing
- **CSRF protection enabled via double-submit cookie and/or strict origin check.**
- Try sending POST/PUT/DELETE requests from another domain or without CSRF token.
- API should reject with 403 Forbidden.
- Use tools: Postman, Burp Suite, custom HTML forms.

## 5. 2FA/MFA (Two-Factor Authentication)
- **OTP-based 2FA is implemented for login.**
- After login, user must enter OTP sent via email/SMS.
- Test: Attempt login with/without OTP, try brute-force OTP.
- API should rate limit and lock out after several failed attempts.

## 6. Security Checklist
- [x] HTTPS enforced in production
- [x] Parameterized SQL queries
- [x] Input sanitization (backend & frontend)
- [x] CSRF protection
- [x] Rate limiting
- [x] 2FA/OTP for login
- [x] Secure password hashing (bcrypt)
- [x] JWT with strong secret
- [x] CORS with allowlist
- [x] Helmet security headers
- [x] Regular npm audit & dependency updates

## 7. Useful Tools
- [OWASP ZAP](https://owasp.org/www-project-zap/): Automated security scanner
- [sqlmap](https://sqlmap.org/): SQL injection testing
- [Burp Suite](https://portswigger.net/burp): Web security testing
- [npm audit](https://docs.npmjs.com/cli/v8/commands/npm-audit): Dependency vulnerability scan

---

**See also:** `docs/TESTING_PERFORMANCE_SECURITY.md`, `docs/DEVOPS_DOCKER_CICD.md` for more details on security in deployment and testing.
