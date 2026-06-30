"use strict";

const normalize = name => String(name || "").trim().toLocaleLowerCase();

const findDuplicateLeaveTypeName = names => {
  const seen = new Set();

  for (const name of names) {
    const normalized = normalize(name);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      return String(name).trim();
    }

    seen.add(normalized);
  }

  return null;
};

module.exports = {
  findDuplicateLeaveTypeName,
};
