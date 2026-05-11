# Interview Preperation Studio

Interview Preperation Studio is a dynamic web app that helps a candidate prepare for interviews by converting key inputs into a focused preparation brief.

## What this project does

The app is built to help a candidate prepare faster using four inputs:

- Resume
- Job Description
- Company details
- Hiring Manager details

Once these resources are added, the app generates a structured interview-prep view with:

- About the company
- Role alignment
- Role non-alignment
- Hiring Manager overview
- Prep focus checklist
- Research links for deeper follow-up

The app is designed as a broad two-panel workspace:

1. **Resources**
   - Used to add or update the input material
   - Includes Resume, JD, Company, and Hiring Manager
   - Can be expanded when editing and collapsed when reviewing

2. **Key Information**
   - Used to review generated output
   - Includes collapsible sections with grouped insights
   - Shows loading state while Codex is running
   - Supports reset and archive history

## Core use case

This project is useful when a candidate has an upcoming interview and wants one place to:

- compare their profile against the role
- understand the company quickly
- identify likely gaps
- understand the hiring manager better
- create a practical checklist before the interview

Example flow:

1. Paste your resume.
2. Paste the job description.
3. Add the company name, website, or company notes.
4. Add hiring manager details if available.
5. Click **Generate**.
6. Wait while Codex runs and fetches the insights.
7. Review the results in collapsible sections.
8. Mark prep checklist items complete.
9. Save the session to archive and reopen later if needed.

## Product behavior

### Resources panel
This section is used mainly for input, not reading. It should stay compact but also support an expanded mode when the user wants to work deeply on the inputs.

Fields:
- Resume
- JD
- Company
- Hiring Manager

### Key Information panel
This section displays the generated output in a more readable and attractive format.

It should include:

#### About Company
- Key Information
  - Main products/services
  - Business segments
  - Top line
  - Bottom line
  - Headcount
  - Headquarters
- Additional Information
  - Global presence
  - Top 3 customers
  - Top 3 competitors
- Presence in India
  - India main products/services
  - India business segments
  - India top line
  - India bottom line
  - India headcount
  - Locations in India
  - Bangalore-specific presence

#### Role Alignment
Grouped and collapsible highlights showing where the resume matches the JD.

#### Non Alignment
Grouped and collapsible gaps showing what is missing or weak compared to the JD.

#### Hiring Manager
- Name
- Experience
- Background
- Education
- Interests / passions
- Anything relevant to interview preparation

#### Prep Focus
A checklist-based to-do section where completed items are struck off.

## Design direction

The app should feel like a modern, black-and-white productivity workspace inspired by Notion, but more polished and intuitive.

Preferred UI characteristics:
- clean black and white base
- modern sans-serif font
- colorful project title: **Interview Preperation Studio**
- large readable section headers
- collapsible content blocks
- icons instead of emojis
- subtle animations
- explicit loading progress when Codex is running
- clickable URLs for further research
- mutually exclusive focus mode between Resources and Key Information

## How Codex should work here

This project should not require the user to manually paste an OpenAI API key into the UI.

Instead, when the user clicks **Generate** or **Regenerate Draft**, the app should trigger the Codex-backed generation flow already configured for the project runtime or local environment.

Expected behavior:
- user clicks Generate
- UI shows: Codex is running
- UI shows progress text such as:
  - Reading resume
  - Reading JD
  - Researching company
  - Researching hiring manager
  - Drafting alignment summary
- UI shows expected completion time
- final structured output appears in Key Information

## How to install and run locally

### 1. Download the project
Clone the repository:

```bash
git clone https://github.com/laxminarayan005-gg/interview-preperation-studio.git
cd interview-preperation-studio
```

Or download the ZIP from GitHub and extract it.

### 2. Install dependencies
Make sure Node.js is installed, then run:

```bash
npm install
```

### 3. Start the application
Run:

```bash
npm start
```

If your project uses a different script, check `package.json` and run the available start script shown there.

### 4. Open in browser
After the local server starts, open the local URL shown in the terminal, usually something like:

```bash
http://localhost:3000
```

## How to use the app

1. Open the app in your browser.
2. In **Resources**, fill in:
   - Resume
   - JD
   - Company
   - Hiring Manager
3. Click **Generate**.
4. Watch the status area while Codex processes the request.
5. Review the generated sections under **Key Information**.
6. Open any suggested research links for further preparation.
7. Use **Reset** for a new run.
8. Save the result to archive if you want to reopen it later.

## Expected output

After generation, the app should show a structured interview brief with:

- company summary
- business overview
- India and Bangalore relevance where available
- role alignment points
- role non-alignment points
- hiring manager background
- prep checklist
- further research links

## Archive and history

The app should support saving past searches so a user can:
- revisit previous interview prep sessions
- open archived records
- compare multiple opportunities over time

## Suggested future improvements

- add export to PDF
- add copy-to-clipboard for each section
- add confidence tags for each generated insight
- add timestamp for each archived run
- add editable generated notes before saving
