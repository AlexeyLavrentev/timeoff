"use strict";

const fs = require("fs");
const path = require("path");

const REQUIRED_ENV = [
  "TIMEOFF_BASE_URL",
  "TIMEOFF_TOKEN",
  "JIRA_BASE_URL",
  "JIRA_USER",
  "JIRA_TOKEN",
];

const getEnv = (name, defaultValue = "") => {
  const value = process.env[name];
  return value === undefined || value === null || value === "" ? defaultValue : value;
};

const asBool = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

const assertRequiredEnv = () => {
  const missing = REQUIRED_ENV.filter((name) => !getEnv(name));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

const getToday = () => {
  const forcedDate = getEnv("TIMEOFF_DATE");
  if (forcedDate) {
    return forcedDate;
  }

  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const normalizeBaseUrl = (value) => value.replace(/\/+$/, "");

const fetchWithTimeout = async (url, options = {}, timeoutMs = 20000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const parseJsonSafe = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (_error) {
    return { raw: text };
  }
};

const loadUserMap = () => {
  const mappingPath = getEnv("USER_MAPPING_FILE", "");
  if (!mappingPath) {
    return {};
  }

  const mappingFile = path.resolve(mappingPath);
  if (!fs.existsSync(mappingFile)) {
    log("User mapping file was not found, continue with automatic mapping", {
      mappingFile,
    });
    return {};
  }

  const stat = fs.statSync(mappingFile);
  if (!stat.isFile()) {
    log("User mapping path is not a file, continue with automatic mapping", {
      mappingFile,
    });
    return {};
  }

  const raw = fs.readFileSync(mappingFile, "utf8");
  const parsed = JSON.parse(raw);

  return Object.keys(parsed).reduce((memo, key) => {
    memo[String(key).toLowerCase()] = String(parsed[key]);
    return memo;
  }, {});
};

const log = (message, payload = null) => {
  const ts = new Date().toISOString();
  if (payload === null) {
    console.log(`[${ts}] ${message}`);
    return;
  }
  console.log(`[${ts}] ${message}`, payload);
};

const jiraAuthHeaders = () => {
  const user = getEnv("JIRA_USER");
  const token = getEnv("JIRA_TOKEN");
  const credentials = Buffer.from(`${user}:${token}`).toString("base64");

  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
};

const escapeJql = (value) => String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');

const pickJiraIdentity = (user) => {
  if (!user) {
    return "";
  }

  return user.name || user.key || user.accountId || "";
};

const fetchTimeoffReplacements = async ({ date }) => {
  const baseUrl = normalizeBaseUrl(getEnv("TIMEOFF_BASE_URL"));
  const token = getEnv("TIMEOFF_TOKEN");
  const leaveStatuses = getEnv("TIMEOFF_LEAVE_STATUSES", "Approved");

  const url = `${baseUrl}/integration/v1/report/replacements?date=${encodeURIComponent(date)}&leave_statuses=${encodeURIComponent(leaveStatuses)}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
    Number(getEnv("HTTP_TIMEOUT_MS", "20000"))
  );

  if (!response.ok) {
    const body = await parseJsonSafe(response);
    throw new Error(`TimeOff request failed [${response.status}]: ${JSON.stringify(body)}`);
  }

  return parseJsonSafe(response);
};

const searchIssuesByAssignee = async ({ assigneeName, extraJql }) => {
  const baseUrl = normalizeBaseUrl(getEnv("JIRA_BASE_URL"));
  const maxResults = Number(getEnv("JIRA_SEARCH_PAGE_SIZE", "100"));

  const allIssues = [];
  let startAt = 0;
  let total = 0;

  do {
    const jql = [
      `assignee = "${escapeJql(assigneeName)}"`,
      "statusCategory != Done",
      extraJql ? `(${extraJql})` : "",
    ]
      .filter(Boolean)
      .join(" AND ");

    const url = `${baseUrl}/rest/api/2/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=assignee,key`;

    const response = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: jiraAuthHeaders(),
      },
      Number(getEnv("HTTP_TIMEOUT_MS", "20000"))
    );

    if (!response.ok) {
      const body = await parseJsonSafe(response);
      throw new Error(`Jira search failed [${response.status}] for assignee ${assigneeName}: ${JSON.stringify(body)}`);
    }

    const data = await parseJsonSafe(response);
    const issues = data.issues || [];
    total = Number(data.total || 0);
    startAt += issues.length;
    allIssues.push(...issues);
  } while (startAt < total);

  return allIssues;
};

const reassignIssue = async ({ issueKey, replacementName }) => {
  const baseUrl = normalizeBaseUrl(getEnv("JIRA_BASE_URL"));
  const assignField = getEnv("JIRA_ASSIGN_FIELD", "name");

  const response = await fetchWithTimeout(
    `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/assignee`,
    {
      method: "PUT",
      headers: jiraAuthHeaders(),
      body: JSON.stringify({
        [assignField]: replacementName,
      }),
    },
    Number(getEnv("HTTP_TIMEOUT_MS", "20000"))
  );

  if (!response.ok) {
    const body = await parseJsonSafe(response);
    throw new Error(`Jira reassign failed [${response.status}] for ${issueKey}: ${JSON.stringify(body)}`);
  }
};

const getIssueAssigneeIdentity = (issue) => {
  const assignee = issue && issue.fields ? issue.fields.assignee : null;
  if (!assignee) {
    return "";
  }

  return assignee.name || assignee.accountId || assignee.key || "";
};

const fetchJiraUserByUsername = async ({ username }) => {
  const baseUrl = normalizeBaseUrl(getEnv("JIRA_BASE_URL"));
  const url = `${baseUrl}/rest/api/2/user?username=${encodeURIComponent(username)}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: jiraAuthHeaders(),
    },
    Number(getEnv("HTTP_TIMEOUT_MS", "20000"))
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const body = await parseJsonSafe(response);
    throw new Error(`Jira user lookup failed [${response.status}] for ${username}: ${JSON.stringify(body)}`);
  }

  return parseJsonSafe(response);
};

const searchJiraUsers = async ({ query }) => {
  const baseUrl = normalizeBaseUrl(getEnv("JIRA_BASE_URL"));
  const url = `${baseUrl}/rest/api/2/user/search?username=${encodeURIComponent(query)}`;

  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: jiraAuthHeaders(),
    },
    Number(getEnv("HTTP_TIMEOUT_MS", "20000"))
  );

  if (!response.ok) {
    const body = await parseJsonSafe(response);
    throw new Error(`Jira user search failed [${response.status}] for ${query}: ${JSON.stringify(body)}`);
  }

  const data = await parseJsonSafe(response);
  return Array.isArray(data) ? data : [];
};

const createUserResolver = ({ userMap }) => {
  const cache = {};
  const autoMapByEmail = asBool(getEnv("AUTO_MAP_BY_EMAIL", "true"), true);

  return async ({ email }) => {
    const normalizedEmail = String(email || "").toLowerCase();
    if (!normalizedEmail) {
      return "";
    }

    if (cache[normalizedEmail] !== undefined) {
      return cache[normalizedEmail];
    }

    if (userMap[normalizedEmail]) {
      const value = userMap[normalizedEmail];
      cache[normalizedEmail] = value;
      return value;
    }

    if (!autoMapByEmail) {
      cache[normalizedEmail] = "";
      return "";
    }

    // Fast path: Jira username is equal to email.
    const direct = await fetchJiraUserByUsername({ username: normalizedEmail });
    if (direct) {
      const identity = pickJiraIdentity(direct);
      cache[normalizedEmail] = identity;
      return identity;
    }

    // Fallback path: search user and match by email/name.
    const candidates = await searchJiraUsers({ query: normalizedEmail });

    const byEmail = candidates.find((user) => String(user.emailAddress || "").toLowerCase() === normalizedEmail);
    if (byEmail) {
      const identity = pickJiraIdentity(byEmail);
      cache[normalizedEmail] = identity;
      return identity;
    }

    const byName = candidates.find((user) => String(user.name || "").toLowerCase() === normalizedEmail);
    if (byName) {
      const identity = pickJiraIdentity(byName);
      cache[normalizedEmail] = identity;
      return identity;
    }

    cache[normalizedEmail] = "";
    return "";
  };
};

const main = async () => {
  assertRequiredEnv();

  const dryRun = asBool(getEnv("DRY_RUN", "true"), true);
  const extraJql = getEnv("JIRA_EXTRA_JQL", "");
  const date = getToday();
  const userMap = loadUserMap();
  const resolveJiraUser = createUserResolver({ userMap });

  log("Starting TimeOff -> Jira sync", {
    date,
    dryRun,
  });

  const report = await fetchTimeoffReplacements({ date });
  const rows = report.data || [];

  const stats = {
    absentEmployees: rows.length,
    employeesWithReplacement: 0,
    employeesSkipped: 0,
    issuesFound: 0,
    issuesUpdated: 0,
    issuesSkippedAlreadyAssigned: 0,
    issuesFailed: 0,
  };

  for (const entry of rows) {
    const employeeEmail = entry.user && entry.user.email ? String(entry.user.email).toLowerCase() : "";
    const selectedReplacement = entry.selectedReplacement;

    if (!employeeEmail || !selectedReplacement || !selectedReplacement.email || !selectedReplacement.available) {
      stats.employeesSkipped += 1;
      log("Skipping absent employee: missing or unavailable replacement", {
        employee: entry.user ? entry.user.fullName : "unknown",
      });
      continue;
    }

    const replacementEmail = String(selectedReplacement.email).toLowerCase();
    const jiraAbsentUser = await resolveJiraUser({ email: employeeEmail });
    const jiraReplacementUser = await resolveJiraUser({ email: replacementEmail });

    if (!jiraAbsentUser || !jiraReplacementUser) {
      stats.employeesSkipped += 1;
      log("Skipping absent employee: no Jira mapping (manual or automatic)", {
        employeeEmail,
        replacementEmail,
      });
      continue;
    }

    stats.employeesWithReplacement += 1;

    const issues = await searchIssuesByAssignee({
      assigneeName: jiraAbsentUser,
      extraJql,
    });

    stats.issuesFound += issues.length;

    log("Issues found for absent employee", {
      employeeEmail,
      jiraAbsentUser,
      jiraReplacementUser,
      issues: issues.length,
    });

    for (const issue of issues) {
      const issueKey = issue.key;
      const currentAssignee = getIssueAssigneeIdentity(issue);

      if (currentAssignee === jiraReplacementUser) {
        stats.issuesSkippedAlreadyAssigned += 1;
        continue;
      }

      if (dryRun) {
        log("DRY_RUN: would reassign issue", {
          issueKey,
          from: currentAssignee,
          to: jiraReplacementUser,
        });
        stats.issuesUpdated += 1;
        continue;
      }

      try {
        await reassignIssue({
          issueKey,
          replacementName: jiraReplacementUser,
        });
        stats.issuesUpdated += 1;
        log("Issue reassigned", {
          issueKey,
          to: jiraReplacementUser,
        });
      } catch (error) {
        stats.issuesFailed += 1;
        log("Failed to reassign issue", {
          issueKey,
          error: String(error),
        });
      }
    }
  }

  log("Sync completed", stats);
};

main().catch((error) => {
  log("Sync failed", { error: String(error), stack: error.stack });
  process.exit(1);
});
