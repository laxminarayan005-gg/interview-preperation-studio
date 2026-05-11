import { createServer } from "node:http";
import { readFile, unlink } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

const root = process.cwd();
const publicDir = join(root, "public");
const schemaPath = join(root, "schema", "interview-prep.schema.json");
const preferredPort = Number(process.env.PORT || 4173);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/interview-prep/generate") {
      const body = await readJson(req);
      const result = await generateInterviewPrep(body);
      sendJson(res, 200, result);
      return;
    }

    if (req.method !== "GET") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    const filePath = safePublicPath(url.pathname === "/" ? "/index.html" : url.pathname);
    if (!filePath || !existsSync(filePath)) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    res.writeHead(200, { "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  }
});

listen(preferredPort);

function listen(nextPort, attempts = 0) {
  server.removeAllListeners("error");
  server.removeAllListeners("listening");

  server.once("error", error => {
    if (error.code === "EADDRINUSE" && attempts < 10 && !process.env.PORT) {
      listen(nextPort + 1, attempts + 1);
      return;
    }
    throw error;
  });

  server.once("listening", () => {
    console.log(`Interview Preperation Studio running at http://localhost:${nextPort}`);
  });

  server.listen(nextPort);
}

function safePublicPath(pathname) {
  const normalized = resolve(publicDir, `.${decodeURIComponent(pathname)}`);
  return normalized.startsWith(publicDir) ? normalized : null;
}

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error("Input is too large. Keep each resource concise.");
  }
  return JSON.parse(raw || "{}");
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function generateInterviewPrep(resources) {
  const resume = clean(resources.resume);
  const jd = clean(resources.jd);
  const company = clean(resources.company);
  const hiringManager = clean(resources.hiringManager);

  if (!resume || !jd) {
    return { source: "validation", error: "Resume and JD are required before generating." };
  }

  try {
    const analysis = await runCodexAnalysis({ resume, jd, company, hiringManager });
    return { source: "codex", analysis };
  } catch (error) {
    return {
      source: "local-draft",
      warning: `Codex generation was unavailable: ${error.message}`,
      analysis: buildLocalDraft({ resume, jd, company, hiringManager })
    };
  }
}

function clean(value) {
  return String(value || "").trim().slice(0, 18_000);
}

async function runCodexAnalysis({ resume, jd, company, hiringManager }) {
  const outputPath = join(tmpdir(), `interview-prep-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const prompt = buildCodexPrompt({ resume, jd, company, hiringManager });

  const args = [
    "--search",
    "--ask-for-approval",
    "never",
    "exec",
    "--cd",
    root,
    "--sandbox",
    "read-only",
    "--output-schema",
    schemaPath,
    "--output-last-message",
    outputPath,
    "--color",
    "never",
    "--ephemeral",
    "-"
  ];

  await runProcess("codex", args, prompt, 180_000);
  const raw = await readFile(outputPath, "utf8");
  await unlink(outputPath).catch(() => {});
  return parseJsonObject(raw);
}

function runProcess(command, args, input, timeoutMs) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Codex timed out while generating the brief"));
    }, timeoutMs);

    child.stderr.on("data", chunk => {
      stderr += chunk.toString();
    });

    child.on("error", error => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", code => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error(stderr.trim() || `Codex exited with code ${code}`));
    });

    child.stdin.end(input);
  });
}

function buildCodexPrompt({ resume, jd, company, hiringManager }) {
  return `Use the interview-prep-ai skill mindset, but do not edit files.

Act as an expert interview coach and hiring strategist. Analyze the resources below and return valid JSON only matching the provided schema.

Rules:
- Compare resume evidence against the JD. Do not give generic advice.
- Use the company resource as the source of company context. If it only contains a company name or URL, use web search to find current, relevant public facts.
- Do not invent candidate achievements, private company facts, compensation, timelines, or role details.
- Mark uncertain inferences in metadata.confidenceNotes.
- Keep every item concise and interview-ready.
- Fill aboutCompany with the exact requested fields: global key information, additional global information, and India/Bangalore presence.
- Fill hiringManager with the hiring manager's name, current role, experience, background, education, passions/interests, and what the candidate should know before the interview.
- Use hiring manager resource as the source for manager context. If it contains a name or URL, use web search to find relevant public information. If not confidently public, write "Not publicly available".
- For topCustomers and topCompetitors, return exactly 3 strings when publicly identifiable; otherwise use "Not publicly available" entries.
- If a company metric is private, unavailable, or not confidently sourced, write "Not publicly available" and add a confidence note instead of guessing.
- Include 5 to 8 roleAlignment items, 3 to 6 roleNonAlignment items, and 5 to 8 preparationFocus bullets.
- Include 5 to 8 researchLinks with live URLs for areas needing further research. Prefer official company pages, investor pages, careers pages, credible news, LinkedIn/company pages, and India office/location sources. Each link must explain why the candidate should open it.

Resume:
${resume}

Job description:
${jd}

Company:
${company || "No company resource provided."}

Hiring manager:
${hiringManager || "No hiring manager resource provided."}`;
}

function parseJsonObject(raw) {
  const text = raw.trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Codex did not return JSON");
    return JSON.parse(match[0]);
  }
}

function buildLocalDraft({ resume, jd, company, hiringManager }) {
  const role = firstMatch(jd, /(title|role|position)\s*[:\-]\s*(.+)/i) || firstLine(jd);
  const companyName = firstLine(company) || "Target company";
  const resumeSignals = pickSignals(resume);
  const jdSignals = pickSignals(jd);

  return {
    metadata: {
      candidateName: firstMatch(resume, /name\s*[:\-]\s*(.+)/i) || "",
      targetRole: role.slice(0, 90),
      companyName: companyName.slice(0, 90),
      confidenceNotes: ["This is a local draft because Codex generation did not complete."]
    },
    aboutCompany: {
      keyInformation: {
        mainProductsServices: company ? company.slice(0, 220) : "Add company notes, a company name, or a website to enrich this section.",
        businessSegments: "Not publicly available in local draft.",
        topLine: "Not publicly available in local draft.",
        bottomLine: "Not publicly available in local draft.",
        headcount: "Not publicly available in local draft.",
        headquarters: "Not publicly available in local draft."
      },
      additionalInformation: {
        globalPresence: "Not publicly available in local draft.",
        topCustomers: ["Not publicly available in local draft."],
        topCompetitors: ["Not publicly available in local draft."]
      },
      presenceInIndia: {
        mainProductsServices: "Not publicly available in local draft.",
        businessSegments: "Not publicly available in local draft.",
        topLine: "Not publicly available in local draft.",
        bottomLine: "Not publicly available in local draft.",
        headcount: "Not publicly available in local draft.",
        locationsInIndia: "Not publicly available in local draft.",
        bangaloreSpecifics: "Not publicly available in local draft."
      }
    },
    roleAlignment: jdSignals.slice(0, 6).map((signal, index) => ({
      requirement: signal,
      resumeEvidence: resumeSignals[index % Math.max(resumeSignals.length, 1)] || "Add resume evidence that maps directly to this requirement.",
      talkTrack: "Lead with the business problem, describe your action, and close with a measurable result."
    })),
    roleNonAlignment: [
      {
        gap: "Unclear evidence depth",
        risk: "The interviewer may not see proof for every JD requirement.",
        mitigation: "Prepare one STAR story for each top requirement and quantify outcomes wherever possible."
      }
    ],
    hiringManager: {
      name: firstLine(hiringManager) || "Not publicly available in local draft.",
      currentRole: "Not publicly available in local draft.",
      experience: "Not publicly available in local draft.",
      background: hiringManager ? hiringManager.slice(0, 220) : "Add hiring manager name, LinkedIn URL, or notes to enrich this section.",
      education: "Not publicly available in local draft.",
      passionsInterests: "Not publicly available in local draft.",
      interviewRelevance: "Use this section to tailor questions, examples, and communication style once Codex can research the manager."
    },
    preparationFocus: [
      "Prepare a 60-second role-fit pitch.",
      "Map three resume stories to the most repeated JD requirements.",
      "Prepare one answer for a likely gap or transition question.",
      "Write two company-specific questions for the interviewer."
    ],
    researchLinks: [
      {
        section: "Company",
        label: "Company research",
        url: company && /^https?:\/\//i.test(company) ? company : "https://www.google.com/search?q=company+interview+research",
        why: "Use this to validate company facts before the interview."
      },
      {
        section: "Role",
        label: "Role research",
        url: "https://www.google.com/search?q=role+interview+preparation",
        why: "Use this to benchmark expectations for similar roles."
      },
      {
        section: "Hiring Manager",
        label: "Hiring manager research",
        url: hiringManager && /^https?:\/\//i.test(hiringManager) ? hiringManager : "https://www.google.com/search?q=hiring+manager+interview+research",
        why: "Use this to understand the manager's background and priorities."
      }
    ]
  };
}

function firstLine(text) {
  return text.split(/\n+/).map(line => line.trim()).find(Boolean) || "";
}

function firstMatch(text, pattern) {
  const match = text.match(pattern);
  return match?.[2]?.trim() || match?.[1]?.trim() || "";
}

function pickSignals(text) {
  const lines = text
    .split(/\n+/)
    .map(line => line.replace(/^[-*•\d.\s]+/, "").trim())
    .filter(line => line.length > 35 && line.length < 220);
  return lines.length ? lines.slice(0, 8) : [firstLine(text)].filter(Boolean);
}
