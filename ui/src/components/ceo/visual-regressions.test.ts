import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../index.css", import.meta.url), "utf8");
const skillsSource = readFileSync(new URL("../../pages/CompanySkills.tsx", import.meta.url), "utf8");
const issueDetailSource = readFileSync(new URL("../../pages/IssueDetail.tsx", import.meta.url), "utf8");
const issueThreadSource = readFileSync(new URL("../IssueChatThread.tsx", import.meta.url), "utf8");
const propertiesPanelSource = readFileSync(new URL("../PropertiesPanel.tsx", import.meta.url), "utf8");
const issueDocumentsSource = readFileSync(new URL("../IssueDocumentsSection.tsx", import.meta.url), "utf8");
const approvalCardSource = readFileSync(new URL("../ApprovalCard.tsx", import.meta.url), "utf8");
const agentsSource = readFileSync(new URL("../../pages/Agents.tsx", import.meta.url), "utf8");
const orgChartSource = readFileSync(new URL("../../pages/OrgChart.tsx", import.meta.url), "utf8");
const scrollToBottomSource = readFileSync(new URL("../ScrollToBottom.tsx", import.meta.url), "utf8");
const costsSource = readFileSync(new URL("../../pages/Costs.tsx", import.meta.url), "utf8");

describe("CEO visual containment contracts", () => {
  it("loads Inter from the application public root rather than a route-relative path", () => {
    expect(css).toContain('url("/fonts/InterVariable.woff2")');
    expect(css).toContain('url("/fonts/InterVariable-Italic.woff2")');
  });

  it("contains Agent Studio inside the application viewport", () => {
    expect(css).toMatch(/\.ceo-agent-studio\s*\{[^}]*min-width:\s*0;/s);
    expect(css).toMatch(/\.ceo-agent-studio__technical-grid[^}]*min-width:\s*0;/s);
  });

  it("keeps the company name readable in the dark Agent Studio intro", () => {
    expect(css).toMatch(/\.ceo-agent-studio__intro strong\s*\{[^}]*color:\s*inherit;/s);
  });

  it("does not stretch a single CRM plugin to match a taller audit panel", () => {
    expect(css).toMatch(/\.ceo-command-center__plugin-grid\s*\{[^}]*align-self:\s*start;/s);
  });

  it("allows long skill names to wrap instead of hiding their identity", () => {
    expect(skillsSource).toContain('line-clamp-2 break-words font-mono text-sm font-medium');
    expect(skillsSource).not.toContain('className="truncate font-mono text-sm font-medium text-foreground"');
  });

  it("uses the mobile properties drawer through tablet widths", () => {
    expect(issueDetailSource).toContain('className="ml-auto flex items-center gap-0.5 lg:hidden shrink-0"');
    expect(issueDetailSource).toContain('className="hidden lg:flex items-center lg:ml-auto shrink-0"');
    expect(propertiesPanelSource).toContain('className="hidden lg:block shrink-0"');
  });

  it("stacks completed-run metadata instead of squeezing it into mobile columns", () => {
    expect(issueThreadSource).toContain("flex-wrap items-center gap-x-2 gap-y-0.5 py-0.5 text-left sm:flex-nowrap");
    expect(issueThreadSource).toContain("order-3 basis-full text-xs text-muted-foreground/80 sm:order-none sm:basis-auto");
    expect(issueThreadSource).toContain('className="text-(length:--text-micro) text-muted-foreground/70"');
  });

  it("keeps issue document actions explicit on mobile", () => {
    expect(issueDetailSource).toContain("Upload attachment");
    expect(issueDocumentsSource).toContain("New document");
    expect(issueDetailSource).not.toContain('<span className="sm:hidden">Upload</span>');
    expect(issueDocumentsSource).not.toContain('<span className="sm:hidden">New</span>');
  });

  it("fits all skill tabs inside narrow viewports", () => {
    expect(skillsSource).toContain('TabsList variant="line" className="grid w-full grid-cols-4 p-0"');
    expect(skillsSource).toContain('className="min-w-0 px-1 text-xs sm:px-3 sm:text-sm"');
  });

  it("fits the five Costs sections inside a narrow viewport without a horizontal spill", () => {
    expect(costsSource).toContain('TabsList variant="line" className="grid w-full grid-cols-5 p-0"');
    expect(costsSource).toContain('className="min-w-0 px-0.5 text-(length:--text-micro) sm:px-2 sm:text-sm"');
  });

  it("preserves full requester and agent identities below desktop widths", () => {
    expect(approvalCardSource).toContain("[&>span:last-child]:!whitespace-normal");
    expect(approvalCardSource).toContain("flex flex-col items-start gap-3 sm:flex-row");
    expect(agentsSource).toContain('className="hidden lg:flex items-center gap-3"');
    expect(agentsSource).toContain('className="min-w-0 flex-1 space-y-0.5"');
    expect(agentsSource).not.toContain('className="min-w-(--sz-7rem) truncate"');
  });

  it("makes panning discoverable and keeps the generic scroll control away from right-aligned actions", () => {
    expect(orgChartSource).toContain("Drag to pan");
    expect(orgChartSource).toContain("Scroll or pinch to zoom");
    expect(scrollToBottomSource).toContain("left-1/2 -translate-x-1/2");
    expect(scrollToBottomSource).toContain("lg:left-auto lg:right-6 lg:translate-x-0");
    expect(issueDetailSource).toContain("<ScrollToBottom hideOnMobile />");
    expect(scrollToBottomSource).toContain("hideOnMobile && \"hidden lg:flex\"");
  });
});
