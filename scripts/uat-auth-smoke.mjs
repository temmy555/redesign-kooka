import { readFile } from "node:fs/promises";

import { readCredentials, uatEnvironmentPath } from "./lib/uat-environment.mjs";
import { parseEnvironmentFile } from "./lib/local-environment.mjs";

const credentials = await readCredentials();
if (!credentials) {
  throw new Error("UAT credentials are missing; run npm run uat:prepare");
}
const environment = parseEnvironmentFile(
  await readFile(uatEnvironmentPath, "utf8"),
);
const appUrl = environment.APP_URL;

const expectedLanding = {
  OWNER: "Hari ini",
  FRONT_OFFICE: "Hari ini",
  CLEANING: "Housekeeping",
  FNB: "F&amp;B",
};

const results = {};
for (const [role, account] of Object.entries(credentials.accounts)) {
  const response = await fetch(`${appUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: appUrl,
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      rememberMe: false,
      callbackURL: "/staff",
    }),
    redirect: "manual",
  });
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";", 1)[0])
    .join("; ");
  if (!response.ok || !cookie) {
    throw new Error(`${role} credential login failed with ${response.status}`);
  }

  const page = await fetch(`${appUrl}/staff`, {
    headers: { cookie },
    redirect: "manual",
  });
  const body = await page.text();
  if (!page.ok || !body.includes(expectedLanding[role])) {
    throw new Error(`${role} did not reach the expected permission landing`);
  }
  results[role] = {
    credentialLogin: "PASS",
    staffLanding: "PASS",
  };
}

console.log(JSON.stringify({ appUrl, results }, null, 2));
