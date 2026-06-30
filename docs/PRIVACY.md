# Privacy Policy & Data Processing

**LeavePilot**  
**Last updated:** 2026-06-29  
**Version:** 1.0  
**Effective date:** 2026-06-29

---

## 1. Introduction

This Privacy Policy describes how LeavePilot ("we", "the Software")
handles personal data when you use our leave management software.

This policy applies to both Community Edition (self-hosted) and
Premium Edition (self-hosted with commercial license).

---

## 2. Data Controller

For self-hosted deployments of LeavePilot:

- **Data Controller:** The organization deploying LeavePilot
- **Data Location:** Your infrastructure (your servers, your database)
- **Data Access:** Only your organization has access

LeavePilot (the software provider) does NOT access your data unless
you explicitly request technical support.

---

## 3. Personal Data Collected

The Software processes the following personal data for leave management:

| Data Category | Description | Purpose | Legal Basis |
|---------------|-------------|---------|-------------|
| **Employee Data** | Name, email, phone | User identification, notifications | Contract performance |
| **Employment Data** | Department, position, hire date | Leave calculation, approvals | Labor law compliance |
| **Leave Data** | Leave requests, approvals, balances | Leave management, payroll | Contract performance |
| **Authentication Data** | Login credentials (hashed) | System access | Security |
| **Audit Data** | Login logs, action history | Security, troubleshooting | Legitimate interest |

### Required vs. Optional Data

**Required:**
- Employee name
- Email address
- Employment information (department, position, hire date)

**Optional:**
- Phone number
- Profile photo
- Additional employee attributes

---

## 4. Data Processing Purposes

LeavePilot processes personal data for the following purposes:

1. **Leave Management** — Processing leave requests and approvals
2. **Payroll Integration** — Calculating leave balances and deductions
3. **Notifications** — Sending leave-related notifications
4. **Authentication** — Managing user access
5. **Audit** — Maintaining action history for security

---

## 5. Legal Basis (Russian Federation — 152-ФЗ)

Under Federal Law No. 152-ФЗ "On Personal Data":

| Processing Purpose | Legal Basis |
|--------------------|--------------|
| Leave request processing | Contract performance (трудовой договор) |
| Payroll calculations | Legal obligation (ТК РФ) |
| System authentication | Legitimate interest (security) |
| Notifications | Contract performance |
| Audit logging | Legitimate interest (security) |

---

## 6. Data Storage and Security

### Self-Hosted Deployments

For self-hosted deployments, YOU are responsible for:

- **Database security** — encryption at rest, backups, access controls
- **Network security** — firewalls, TLS/SSL encryption
- **Access controls** — password policies, 2FA where available
- **Backup security** — encrypted backups, secure storage
- **Retention** — compliance with data retention requirements

### Recommended Security Practices

- Enable HTTPS/TLS for all connections
- Use strong database passwords
- Regular security updates
- Encrypted backups
- Access logging and monitoring
- Secure password storage (bcrypt/argon2)

---

## 7. Data Retention

We recommend retaining leave data for:

- **Active employees:** Duration of employment + 3 years (tax audits)
- **Terminated employees:** 3 years after termination (ТК РФ requirements)
- **Audit logs:** 1 year (security investigation)
- **Failed login attempts:** 90 days (security)

You may adjust retention periods based on your legal requirements.

---

## 8. Data Subject Rights

Under 152-ФЗ, employees have the right to:

1. **Access** their personal data
2. **Rectify** inaccurate data
3. **Delete** their data (with limitations for employment records)
4. **Restrict** processing (with limitations for business operations)
5. **Object** to processing (with limitations)
6. **Data portability** — export their data

**How to exercise these rights:**

Employees should contact their HR department or system administrator.
LeavePilot (the software) provides export functionality but does not
directly handle employee data requests.

---

## 9. Third-Party Access

### For Self-Hosted Deployments

LeavePilot (software provider) does NOT have access to your data unless:

- You explicitly request technical support
- You grant temporary access for troubleshooting
- Required by law enforcement warrant

### Third-Party Services

You may integrate LeavePilot with third-party services:

- **Authentication providers** (LDAP, Active Directory, SAML IdPs)
- **Notification services** (email servers, Telegram)
- **Backup services** (your backup infrastructure)

You are responsible for ensuring these integrations comply with
152-ФЗ and your data protection obligations.

---

## 10. Cross-Border Data Transfer

For self-hosted deployments:

- **Data remains** in your infrastructure
- **You control** data location
- **You are responsible** for cross-border transfers if any

If you host outside Russia, ensure compliance with 152-ФZ requirements
for cross-border data transfers.

---

## 11. Cookies and Tracking

### Community/Premium Editions (Self-Hosted)

- **No marketing cookies**
- **No third-party analytics**
- **No tracking scripts**
- **Session cookies only** for authentication

The Software uses ONLY technical cookies required for:

- User session management
- CSRF protection
- UI preferences (if enabled)

---

## 12. Children's Data

This Software is for employee leave management. It is NOT intended for
children under 18. Employee data should only be collected for
individuals 18+ with employment contracts.

---

## 13. Data Breach Notification

For self-hosted deployments:

**You are responsible for:**

- Detecting data breaches
- Notifying affected individuals (within 72 hours per 152-ФЗ)
- Notifying Roskomnadzor (if applicable)
- Documenting breaches and response

**LeavePilot (software provider) is NOT responsible** for breaches on
your infrastructure.

---

## 14. Changes to This Privacy Policy

LeavePilot may update this Privacy Policy. Changes will be posted:

- In the Software repository
- On leavepilot.com (for Premium customers)
- Via email notification (major changes only)

---

## 15. Contact Information

**For privacy inquiries:**

- Email: privacy@leavepilot.com
- Web: https://leavepilot.com/privacy

**For data requests:**

Contact your organization's HR department or system administrator.
LeavePilot (software provider) does NOT handle employee data requests.

---

## 16. Russian Law Compliance

### 152-ФЗ Obligations

As data controller for your LeavePilot deployment, you must:

1. **Obtain consent** for personal data processing (employment contract)
2. **Inform employees** of data processing (employment agreement/privacy notice)
3. **Implement security** measures appropriate to data sensitivity
4. **Respond to requests** from data subjects (employees)
5. **Report breaches** within 72 hours to Roskomnadzor (if applicable)
6. **Maintain records** of processing activities

### Data Processing Register

You should maintain a record of:

- Data categories processed
- Processing purposes
- Data subjects (employees)
- Recipients (if any)
- Cross-border transfers (if any)
- Retention periods
- Security measures

---

## 17. Employee Privacy Notice Template

For your employees, use this template:

```
PRIVACY NOTICE FOR EMPLOYEES

[Company Name] processes your personal data for employment purposes
using the LeavePilot leave management system.

Data processed:
- Name, contact details
- Employment information
- Leave requests and approvals

Purposes:
- Leave management
- Payroll calculation
- Employment law compliance

Legal basis:
- Employment contract performance
- Legal obligations (Labor Code)

Your rights:
- Access to your data
- Correction of inaccurate data
- Data portability
- Complaint to data protection authority

For questions, contact: [HR/DPO contact]
```

---

## 18. Disclaimer

This Privacy Policy is a template for self-hosted deployments. You are
responsible for ensuring your deployment complies with applicable laws.
LeavePilot (software provider) is NOT responsible for your compliance.

For complex deployments or specific legal questions, consult with legal
counsel specializing in Russian data protection law.

---

**Last reviewed:** 2026-06-29  
**Next review:** 2027-06-29

---

*This Privacy Policy is provided as-is and should be reviewed by legal
counsel for your specific jurisdiction and use case.*
