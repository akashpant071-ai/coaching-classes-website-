Genius Coaching Classes — Coaching Management & Attendance System

A full-stack web application built for Genius Coaching Classes, a Science & Mathematics coaching institute, to digitize student management and daily attendance tracking — replacing manual, paper-based record-keeping with a secure, role-based system.

🔗 Live Demo: geniuscoachingclassess.netlify.app 📂 Source Code: GitHub

📌 Overview

Coaching institutes often rely on registers and spreadsheets to track attendance and student data, which is error-prone and hard to maintain at scale. This project solves that by providing:

A public-facing landing page for prospective students
Secure, role-based portals for Teachers and Students
Real-time attendance marking and history tracking
Database-level security to ensure students can only access their own records
✨ Features
🌐 Public Landing Page
Overview of programs and courses offered
Fee structure
Contact information
👩‍🏫 Teacher Portal
Teacher onboarding and profile management
Daily attendance marking for students
Centralized view of student records
🎓 Student Portal
Personal attendance history
Date-wise attendance records
Attendance percentage calculation
🔐 Role-Based Access Control
Separate authenticated dashboards for Teachers and Students
Row Level Security (RLS) policies ensuring students can only view their own data
Custom SQL functions and triggers to prevent role escalation and enforce data integrity
🛠️ Tech Stack
Layer	Technology
Frontend	HTML, CSS, JavaScript
Backend / Database	Supabase (PostgreSQL, Auth, RLS)
Database Logic	SQL (custom functions & triggers)
Hosting	Netlify
Version Control	Git & GitHub
🏗️ Architecture
┌─────────────────────┐
│   Public Landing     │
│   Page (HTML/CSS/JS)│
└──────────┬───────────┘
           │
           ▼
   ┌───────────────┐
   │  Auth (Supabase)│
   └───────┬────────┘
           │
   ┌───────┴────────┐
   ▼                ▼
┌─────────┐    ┌──────────┐
│ Teacher │    │ Student  │
│Dashboard│    │Dashboard │
└────┬────┘    └────┬─────┘
     │              │
     └──────┬───────┘
            ▼
   ┌──────────────────┐
   │ Supabase Postgres │
   │  + RLS Policies   │
   └───────────────────┘
🔒 Security
Row Level Security (RLS): Enforced at the database level so students can only query their own attendance records, regardless of client-side logic.
Role Enforcement: Custom SQL triggers/functions validate role assignments server-side, preventing users from escalating their own privileges (e.g., a student marking themselves as a teacher).
Supabase Auth: Handles secure sign-up/login and session management.
🚀 Getting Started
Prerequisites
A Supabase account and project
A modern web browser
(Optional) Netlify CLI for local deployment testing
Setup
Clone the repository
bash
   git clone https://github.com/akashpant071-ai/<repo-name>.git
   cd <repo-name>
Configure Supabase
Create a new Supabase project
Set up the database schema (students, teachers, attendance tables)
Enable Row Level Security and add the relevant policies
Copy your Supabase project URL and public anon key
Add environment/config values
Update the Supabase config in the project's JS file(s) with your project URL and anon key
Run locally
Open index.html directly in your browser, or serve the folder with a local static server:
bash
     npx serve .
Deploy
Push to GitHub and connect the repo to Netlify for continuous deployment
📸 Screenshots

Add screenshots of the landing page, Teacher dashboard, and Student dashboard here.

🗺️ Roadmap
 Email/SMS notifications for low attendance
 Admin dashboard for institute-wide analytics
 Export attendance reports (CSV/PDF)
 Mobile-responsive UI improvements
👤 Author

Akash Pant

GitHub: @akashpant071-ai
LinkedIn: Akash Pant
Email: akashpant071@gmail.com
📄 License

This project is open for educational and demonstration purposes. Add a license (e.g., MIT) if you intend to open-source it for reuse.
