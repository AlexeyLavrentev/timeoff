"use strict";

const fs = require("fs");
const path = require("path");

const REQUIRED_ENV = [
  "TIMEOFF_BASE_URL",
  "TIMEOFF_TOKEN",
  "JIRA_BASE_URL",
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
  const authMode = getJiraAuthMode();
  const required = [...REQUIRED_ENV];

  if (authMode === "basic") {
    required.push("JIRA_USER");
  }

  const missing = required.filter((name) => !getEnv(name));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
};

const getJiraAuthMode = () => {
  const mode = String(getEnv("JIRA_AUTH_MODE", "basic")).toLowerCase();
  if (mode !== "basic" && mode !== "bearer") {
    throw new Error(`Unsupported JIRA_AUTH_MODE='${mode}', use 'basic' or 'bearer'`);
  }

  return mode;
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
const nowIso = () => new Date().toISOString();

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
  const ts = nowIso();
  if (payload === null) {
    console.log(`[${ts}] ${message}`);
    return;
  }
  console.log(`[${ts}] ${message}`, payload);
};

const jiraAuthHeaders = () => {
  const token = getEnv("JIRA_TOKEN");
  const authMode = getJiraAuthMode();

  let authorization = "";
  if (authMode === "bearer") {
    authorization = `Bearer ${token}`;
  } else {
    const user = getEnv("JIRA_USER");
    const credentials = Buffer.from(`${user}:${token}`).toString("base64");
    authorization = `Basic ${credentials}`;
  }

  return {
    Authorization: authorization,
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

const ensureParentDirectory = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const writeJsonFileSafe = ({ filePath, data }) => {
  try {
    ensureParentDirectory(filePath);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (error) {
    log("Failed to write JSON report file", {
      filePath,
      error: String(error),
    });
    return false;
  }
};

const readJsonFileSafe = ({ filePath, fallback }) => {
  try {
    if (!fs.existsSync(filePath)) {
      return fallback;
    }

    const raw = fs.readFileSync(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    log("Failed to read JSON file, using fallback", {
      filePath,
      error: String(error),
    });
    return fallback;
  }
};

const buildMappingSummary = ({ mappingAudit }) => {
  const values = Object.values(mappingAudit || {});

  const byStatus = {};
  const bySource = {};

  for (const item of values) {
    const status = item.status || "unknown";
    const source = item.source || "unknown";

    byStatus[status] = (byStatus[status] || 0) + 1;
    bySource[source] = (bySource[source] || 0) + 1;
  }

  return {
    total: values.length,
    byStatus,
    bySource,
  };
};

const assertMappingThresholds = ({ summary }) => {
  const notFoundThresholdRaw = getEnv("MAPPING_NOT_FOUND_THRESHOLD", "");
  if (!notFoundThresholdRaw) {
    return;
  }

  const threshold = Number(notFoundThresholdRaw);
  if (!Number.isFinite(threshold) || threshold < 0) {
    throw new Error(`MAPPING_NOT_FOUND_THRESHOLD should be non-negative number, got: ${notFoundThresholdRaw}`);
  }

  const notFound = Number((summary.byStatus && summary.byStatus.not_found) || 0);
  if (notFound > threshold) {
    throw new Error(
      `Mapping not_found threshold exceeded: ${notFound} > ${threshold}. Check mapping-report.json and user identities in Jira.`
    );
  }
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

const addWatcherToIssue = async ({ issueKey, watcherUser }) => {
  const baseUrl = normalizeBaseUrl(getEnv("JIRA_BASE_URL"));
  const response = await fetchWithTimeout(
    `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/watchers`,
    {
      method: "POST",
      headers: jiraAuthHeaders(),
      body: JSON.stringify(watcherUser),
    },
    Number(getEnv("HTTP_TIMEOUT_MS", "20000"))
  );

  if (!response.ok) {
    const body = await parseJsonSafe(response);
    throw new Error(`Jira add watcher failed [${response.status}] for ${issueKey}: ${JSON.stringify(body)}`);
  }
};

const removeWatcherFromIssue = async ({ issueKey, watcherUser }) => {
  const baseUrl = normalizeBaseUrl(getEnv("JIRA_BASE_URL"));
  const response = await fetchWithTimeout(
    `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}/watchers?username=${encodeURIComponent(watcherUser)}`,
    {
      method: "DELETE",
      headers: jiraAuthHeaders(),
    },
    Number(getEnv("HTTP_TIMEOUT_MS", "20000"))
  );

  if (!response.ok) {
    const body = await parseJsonSafe(response);
    throw new Error(`Jira remove watcher failed [${response.status}] for ${issueKey}: ${JSON.stringify(body)}`);
  }
};

const getIssueAssigneeIdentity = (issue) => {
  const assignee = issue && issue.fields ? issue.fields.assignee : null;
  if (!assignee) {
    return "";
  }

  return assignee.name || assignee.accountId || assignee.key || "";
};

const isIssueDone = (issue) => {
  const statusCategoryKey = issue && issue.fields && issue.fields.status && issue.fields.status.statusCategory
    ? String(issue.fields.status.statusCategory.key || "").toLowerCase()
    : "";

  return statusCategoryKey === "done";
};

const fetchIssueByKey = async ({ issueKey }) => {
  const baseUrl = normalizeBaseUrl(getEnv("JIRA_BASE_URL"));
  const url = `${baseUrl}/rest/api/2/issue/${encodeURIComponent(issueKey)}?fields=assignee,status`;

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
    throw new Error(`Jira issue lookup failed [${response.status}] for ${issueKey}: ${JSON.stringify(body)}`);
  }

  return parseJsonSafe(response);
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
  const mappingAudit = {};

  const setAudit = ({ email, status, source, jiraUser = "", details = "", error = "" }) => {
    if (!email) {
      return;
    }

    mappingAudit[email] = {
      email,
      status,
      source,
      jiraUser,
      details,
      error,
      updatedAt: nowIso(),
    };
  };

  const resolve = async ({ email }) => {
    const normalizedEmail = String(email || "").toLowerCase();
    if (!normalizedEmail) {
      return "";
    }

    if (cache[normalizedEmail] !== undefined) {
      if (!mappingAudit[normalizedEmail]) {
        setAudit({
          email: normalizedEmail,
          status: cache[normalizedEmail] ? "resolved" : "not_found",
          source: "cache",
          jiraUser: cache[normalizedEmail] || "",
        });
      }
      return cache[normalizedEmail];
    }

    if (userMap[normalizedEmail]) {
      const value = userMap[normalizedEmail];
      cache[normalizedEmail] = value;
      setAudit({
        email: normalizedEmail,
        status: "resolved",
        source: "override_file",
        jiraUser: value,
      });
      return value;
    }

    if (!autoMapByEmail) {
      cache[normalizedEmail] = "";
      setAudit({
        email: normalizedEmail,
        status: "not_found",
        source: "auto_mapping_disabled",
        details: "AUTO_MAP_BY_EMAIL=false",
      });
      return "";
    }

    try {
      // Fast path: Jira username is equal to email.
      const direct = await fetchJiraUserByUsername({ username: normalizedEmail });
      if (direct) {
        const identity = pickJiraIdentity(direct);
        cache[normalizedEmail] = identity;
        setAudit({
          email: normalizedEmail,
          status: "resolved",
          source: "auto_user_lookup",
          jiraUser: identity,
        });
        return identity;
      }

      // Fallback path: search user and match by email/name.
      const candidates = await searchJiraUsers({ query: normalizedEmail });

      const byEmail = candidates.find((user) => String(user.emailAddress || "").toLowerCase() === normalizedEmail);
      if (byEmail) {
        const identity = pickJiraIdentity(byEmail);
        cache[normalizedEmail] = identity;
        setAudit({
          email: normalizedEmail,
          status: "resolved",
          source: "auto_search_email",
          jiraUser: identity,
        });
        return identity;
      }

      const byName = candidates.find((user) => String(user.name || "").toLowerCase() === normalizedEmail);
      if (byName) {
        const identity = pickJiraIdentity(byName);
        cache[normalizedEmail] = identity;
        setAudit({
          email: normalizedEmail,
          status: "resolved",
          source: "auto_search_name",
          jiraUser: identity,
        });
        return identity;
      }
    } catch (error) {
      cache[normalizedEmail] = "";
      setAudit({
        email: normalizedEmail,
        status: "error",
        source: "auto_mapping_error",
        error: String(error),
      });
      return "";
    }

    cache[normalizedEmail] = "";
    setAudit({
      email: normalizedEmail,
      status: "not_found",
      source: "auto_mapping_not_found",
    });
    return "";
  };

  return {
    resolve,
    mappingAudit,
  };
};

const main = async () => {
  assertRequiredEnv();

  const dryRun = asBool(getEnv("DRY_RUN", "true"), true);
  const extraJql = getEnv("JIRA_EXTRA_JQL", "");
  const date = getToday();
  const userMap = loadUserMap();
  const resolver = createUserResolver({ userMap });
  const resolveJiraUser = resolver.resolve || resolver;
  const enableAutoRestore = asBool(getEnv("ENABLE_AUTO_RESTORE", "false"), false);
  const enableWatchers = asBool(getEnv("ENABLE_WATCHERS", "false"), false);
  const removeWatcherOnRestore = asBool(getEnv("REMOVE_WATCHER_ON_RESTORE", "false"), false);
  const reassignStateFile = path.resolve(
    getEnv("REASSIGN_STATE_FILE", "/app/integrations/jira-timeoff-worker/reports/reassignment-state.json")
  );
  const reassignState = readJsonFileSafe({
    filePath: reassignStateFile,
    fallback: {
      version: 1,
      updatedAt: nowIso(),
      issues: {},
    },
  });
  let reassignStateDirty = false;

  log("Starting TimeOff -> Jira sync", {
    date,
    dryRun,
    jiraAuthMode: getJiraAuthMode(),
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
    restoreCandidates: 0,
    restoreDone: 0,
    restoreSkippedStillAbsent: 0,
    restoreSkippedManualOverride: 0,
    restoreSkippedDone: 0,
    restoreFailed: 0,
    watchersAddAttempted: 0,
    watchersAdded: 0,
    watchersAddFailed: 0,
    watchersRemoveAttempted: 0,
    watchersRemoved: 0,
    watchersRemoveFailed: 0,
  };
  const restoreEvents = [];
  const absentJiraUsers = {};

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

    absentJiraUsers[jiraAbsentUser] = true;
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
        if (enableWatchers) {
          stats.watchersAddAttempted += 1;
          log("DRY_RUN: would add watcher", {
            issueKey,
            watcher: jiraAbsentUser,
          });
        }
        stats.issuesUpdated += 1;
        continue;
      }

      try {
        await reassignIssue({
          issueKey,
          replacementName: jiraReplacementUser,
        });
        reassignState.issues[issueKey] = {
          issueKey,
          originalAssignee: jiraAbsentUser,
          replacementAssignee: jiraReplacementUser,
          employeeEmail,
          replacementEmail,
          watcherUser: jiraAbsentUser,
          updatedAt: nowIso(),
        };
        reassignStateDirty = true;
        stats.issuesUpdated += 1;
        log("Issue reassigned", {
          issueKey,
          to: jiraReplacementUser,
        });

        if (enableWatchers) {
          stats.watchersAddAttempted += 1;
          try {
            await addWatcherToIssue({
              issueKey,
              watcherUser: jiraAbsentUser,
            });
            stats.watchersAdded += 1;
            log("Watcher added", {
              issueKey,
              watcher: jiraAbsentUser,
            });
          } catch (watcherError) {
            stats.watchersAddFailed += 1;
            log("Failed to add watcher", {
              issueKey,
              watcher: jiraAbsentUser,
              error: String(watcherError),
            });
          }
        }
      } catch (error) {
        stats.issuesFailed += 1;
        log("Failed to reassign issue", {
          issueKey,
          error: String(error),
        });
      }
    }
  }

  const mappingSummaryForDecision = buildMappingSummary({
    mappingAudit: resolver.mappingAudit || {},
  });

  if (enableAutoRestore) {
    const hasMappingErrors = Number(mappingSummaryForDecision.byStatus.error || 0) > 0;

    if (hasMappingErrors) {
      log("Skip auto-restore because mapping has errors in this cycle", {
        mappingSummary: mappingSummaryForDecision,
      });
    } else {
      for (const issueKey of Object.keys(reassignState.issues || {})) {
        const stateItem = reassignState.issues[issueKey];
        if (!stateItem) {
          continue;
        }

        stats.restoreCandidates += 1;

        if (absentJiraUsers[stateItem.originalAssignee]) {
          stats.restoreSkippedStillAbsent += 1;
          restoreEvents.push({
            issueKey,
            action: "skip_still_absent",
            originalAssignee: stateItem.originalAssignee,
            replacementAssignee: stateItem.replacementAssignee,
          });
          continue;
        }

        try {
          const issue = await fetchIssueByKey({ issueKey });

          if (!issue) {
            delete reassignState.issues[issueKey];
            reassignStateDirty = true;
            restoreEvents.push({
              issueKey,
              action: "skip_issue_not_found",
            });
            continue;
          }

          if (isIssueDone(issue)) {
            delete reassignState.issues[issueKey];
            reassignStateDirty = true;
            stats.restoreSkippedDone += 1;
            restoreEvents.push({
              issueKey,
              action: "skip_issue_done",
            });
            continue;
          }

          const currentAssignee = getIssueAssigneeIdentity(issue);

          if (currentAssignee === stateItem.originalAssignee) {
            delete reassignState.issues[issueKey];
            reassignStateDirty = true;
            restoreEvents.push({
              issueKey,
              action: "skip_already_restored",
            });
            continue;
          }

          if (currentAssignee !== stateItem.replacementAssignee) {
            // Someone reassigned issue manually; do not override it.
            delete reassignState.issues[issueKey];
            reassignStateDirty = true;
            stats.restoreSkippedManualOverride += 1;
            restoreEvents.push({
              issueKey,
              action: "skip_manual_override",
              currentAssignee,
              expectedReplacement: stateItem.replacementAssignee,
            });
            log("Skip auto-restore due to manual assignee change", {
              issueKey,
              currentAssignee,
              expectedReplacement: stateItem.replacementAssignee,
            });
            continue;
          }

          if (dryRun) {
            stats.restoreDone += 1;
            restoreEvents.push({
              issueKey,
              action: "dry_run_restore",
              from: stateItem.replacementAssignee,
              to: stateItem.originalAssignee,
            });
            if (enableWatchers && removeWatcherOnRestore && stateItem.watcherUser) {
              stats.watchersRemoveAttempted += 1;
              restoreEvents.push({
                issueKey,
                action: "dry_run_remove_watcher",
                watcher: stateItem.watcherUser,
              });
            }
            log("DRY_RUN: would restore issue assignee", {
              issueKey,
              from: stateItem.replacementAssignee,
              to: stateItem.originalAssignee,
            });
            continue;
          }

          await reassignIssue({
            issueKey,
            replacementName: stateItem.originalAssignee,
          });

          delete reassignState.issues[issueKey];
          reassignStateDirty = true;
          stats.restoreDone += 1;
          restoreEvents.push({
            issueKey,
            action: "restored",
            from: stateItem.replacementAssignee,
            to: stateItem.originalAssignee,
          });

          log("Issue assignee restored", {
            issueKey,
            to: stateItem.originalAssignee,
          });

          if (enableWatchers && removeWatcherOnRestore && stateItem.watcherUser) {
            stats.watchersRemoveAttempted += 1;
            try {
              await removeWatcherFromIssue({
                issueKey,
                watcherUser: stateItem.watcherUser,
              });
              stats.watchersRemoved += 1;
              restoreEvents.push({
                issueKey,
                action: "watcher_removed",
                watcher: stateItem.watcherUser,
              });
              log("Watcher removed after restore", {
                issueKey,
                watcher: stateItem.watcherUser,
              });
            } catch (watcherError) {
              stats.watchersRemoveFailed += 1;
              restoreEvents.push({
                issueKey,
                action: "watcher_remove_failed",
                watcher: stateItem.watcherUser,
                error: String(watcherError),
              });
              log("Failed to remove watcher after restore", {
                issueKey,
                watcher: stateItem.watcherUser,
                error: String(watcherError),
              });
            }
          }
        } catch (error) {
          stats.restoreFailed += 1;
          restoreEvents.push({
            issueKey,
            action: "restore_failed",
            error: String(error),
          });
          log("Failed to restore issue assignee", {
            issueKey,
            error: String(error),
          });
        }
      }
    }
  }

  const mappingReportFile = getEnv("MAPPING_REPORT_FILE", "");
  let mappingSummary = {
    total: 0,
    byStatus: {},
    bySource: {},
  };

  if (mappingReportFile) {
    const mapping = resolver.mappingAudit || {};
    mappingSummary = buildMappingSummary({ mappingAudit: mapping });

    writeJsonFileSafe({
      filePath: path.resolve(mappingReportFile),
      data: {
        generatedAt: nowIso(),
        date,
        dryRun,
        summary: mappingSummary,
        mapping,
      },
    });
  } else {
    mappingSummary = buildMappingSummary({ mappingAudit: resolver.mappingAudit || {} });
  }

  if (reassignStateDirty && !dryRun) {
    reassignState.updatedAt = nowIso();
    writeJsonFileSafe({
      filePath: reassignStateFile,
      data: reassignState,
    });
  }

  const restoreReportFile = getEnv("RESTORE_REPORT_FILE", "");
  if (restoreReportFile) {
    writeJsonFileSafe({
      filePath: path.resolve(restoreReportFile),
      data: {
        generatedAt: nowIso(),
        date,
        dryRun,
        autoRestoreEnabled: enableAutoRestore,
        summary: {
          restoreCandidates: stats.restoreCandidates,
          restoreDone: stats.restoreDone,
          restoreSkippedStillAbsent: stats.restoreSkippedStillAbsent,
          restoreSkippedManualOverride: stats.restoreSkippedManualOverride,
          restoreSkippedDone: stats.restoreSkippedDone,
          restoreFailed: stats.restoreFailed,
          watchersAddAttempted: stats.watchersAddAttempted,
          watchersAdded: stats.watchersAdded,
          watchersAddFailed: stats.watchersAddFailed,
          watchersRemoveAttempted: stats.watchersRemoveAttempted,
          watchersRemoved: stats.watchersRemoved,
          watchersRemoveFailed: stats.watchersRemoveFailed,
        },
        trackedIssuesAfterRun: Object.keys(reassignState.issues || {}).length,
        events: restoreEvents,
      },
    });
  }

  assertMappingThresholds({ summary: mappingSummary });

  log("Sync completed", stats);
};

main().catch((error) => {
  log("Sync failed", { error: String(error), stack: error.stack });
  process.exit(1);
});
