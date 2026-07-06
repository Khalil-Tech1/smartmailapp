import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listMailGroups from "./tools/list-mail-groups";
import createMailGroup from "./tools/create-mail-group";
import listGroupMembers from "./tools/list-group-members";
import listSentEmails from "./tools/list-sent-emails";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "smartmail-mcp",
  title: "SmartMail",
  version: "0.1.0",
  instructions:
    "Tools for the signed-in SmartMail user: list and create mail groups, list group members, and list sent emails.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listMailGroups, createMailGroup, listGroupMembers, listSentEmails],
});
