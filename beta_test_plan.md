---
title:          Beta Test Plan
subtitle:       Medflow – AI-powered learning platform
author:         Medflow Team
module:         G-EIP-700
version:        1.0
---

# BETA TEST PLAN – Medflow

## 1. Project context

Medflow is an AI-powered learning platform designed to help users learn efficiently from their own educational content.  
The core concept of Medflow is to transform learning materials (such as PDF documents) into structured, interactive learning paths enhanced by artificial intelligence.

The application is primarily designed for mobile usage, as learning on-the-go is a key objective of the project. A web version is also available, providing access to the same learning content with an adapted interface.

Medflow works as follows:
- The user creates an account and logs in.
- The user uploads a PDF document.
- The backend processes the document and generates learning content.
- The user follows a gamified learning path composed of lesson nodes.
- The user interacts with an AI assistant (text and voice) to reinforce understanding.
- The user’s progression is tracked and saved.

The beta version focuses on demonstrating the core learning flow, from authentication to progression tracking, while ensuring stability and usability.

---

## 2. User roles

The following roles will be involved in beta testing.

| **Role Name** | **Description** |
|--------------|------------------|
| Guest | A user who has not yet logged in and can only access authentication screens |
| User | A registered user who can upload content, follow lessons, interact with the AI and track progression |
| Admin | A technical role used internally to monitor backend behavior and data consistency |

---

## 3. Feature table

The following features will be demonstrated during the beta presentation.  
They are organized following a typical user flow.

| **Feature ID** | **User role** | **Feature name** | **Short description** |
|--------------|---------------|------------------|------------------------|
| F1 | Guest | Register an account | Create a new user account using email and password |
| F2 | Guest | Log in | Authenticate using email/password or Google login |
| F3 | User | Access mobile navigation | Navigate through main sections (Home, Path, Upload, AI chat, Profile) |
| F4 | User | Upload a PDF document | Upload a PDF file from the mobile application |
| F5 | User | Process learning content | Backend parses the PDF and prepares learning data |
| F6 | User | View learning path | Display a gamified learning path composed of lesson nodes |
| F7 | User | Access a lesson node | Open a lesson from the learning path |
| F8 | User | Track learning progression | Save and display the user’s progression through lessons |
| F9 | User | Interact with AI assistant | Ask questions to the AI via text or voice |
| F10 | User | View profile information | Access profile data and account settings |
| F11 | User | Log out | Securely disconnect from the application |

---

## 4. Success criteria

The following table summarizes the success criteria used to evaluate the beta version maturity.

| **Feature ID** | **Key success criteria** | **Indicator / metric** | **Result** |
|--------------|---------------------------|------------------------|------------|
| F1 | A user can create an account without errors | 10 registrations, 0 blocking errors |  |
| F2 | A user can log in and access the application | 20 login attempts, success rate ≥ 95% |  |
| F3 | Navigation allows access to all main sections | 15 navigation flows tested, no dead-end |  |
| F4 | A PDF can be uploaded from mobile | 10 PDF uploads, supported formats only |  |
| F5 | Uploaded PDFs are processed without crash | 10 documents processed, no backend crash |  |
| F6 | Learning path is displayed correctly | Path visible after processing, 100% consistency |  |
| F7 | Lesson nodes open and display content | 20 lesson openings, no loading failure |  |
| F8 | Progression is saved and restored | Progress persisted after logout/login |  |
| F9 | AI responds to user queries | 30 questions, response time < 3 seconds |  |
| F10 | Profile data is accessible and correct | 10 profile checks, data consistent |  |
| F11 | Logout clears user session properly | 10 logouts, no residual access |  |
