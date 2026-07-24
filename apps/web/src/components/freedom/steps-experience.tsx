"use client";

import { useEffect, useMemo, useState } from "react";
import { aftercareSections, lockedSourceRule, openingDeclaration, openingPrayer, openingSections, sourceNotice, stepsSections, type ChecklistPrompt, type FreeformPrompt, type ReadingBlock, type StepPrompt } from "@/lib/freedom/steps-content";
import { Check, ChevronLeft, ChevronRight, Download, Eraser, EyeOff, FileText, Mail, Plus, Printer, Save, ShieldCheck, Users } from "lucide-react";

type SelectedState = Record<string, string[]>;
type TextState = Record<string, string>;
type ForgivenessRow = { id: string; person: string; hurt: string };
type ForgivenessState = Record<string, ForgivenessRow[]>;
type GeneratedPrayerState = Record<string, boolean>;
type JourneyPrayer = { stepLabel: string; stepTitle: string; promptTitle: string; item: string; body: string };
type ExperienceMode = "digital" | "printable" | "facilitator";
type EmailTarget = "created" | "journey";
type EmailSendState = { status: "idle" | "sending" | "sent" | "error"; message: string };
type PersistedSession = {
  hasStarted: boolean;
  activeIndex: number;
  selected: SelectedState;
  text: TextState;
  forgiveness: ForgivenessState;
  completed: string[];
  generatedPrayers: GeneratedPrayerState;
  blankRows: number;
  mode: ExperienceMode;
  privateMode: boolean;
  participantName: string;
};

const STORAGE_KEY = "steps-to-freedom-public-session-v1";
const STEPS_EMAIL_ENDPOINT = process.env.NEXT_PUBLIC_STEPS_EMAIL_ENDPOINT ?? "/api/email";
const attributionNotice = "Hosted by yournamehere.vip. Guided from Steps to Freedom in Christ by Neil Anderson and Freedom in Christ Ministries.";
const modeOptions: Array<{ id: ExperienceMode; title: string; description: string }> = [
  { id: "digital", title: "Digital", description: "Work here and create prayers as you go." },
  { id: "printable", title: "Printable", description: "Start with paper worksheets and write by hand." },
  { id: "facilitator", title: "Facilitator", description: "Keep the flow visible while supporting someone else." },
];
const stepBriefings: Record<string, { title: string; paragraphs: string[]; care?: string }> = {
  preparation: {
    title: "Begin by noticing patterns",
    paragraphs: [
      "This first section is not a confession step. It helps you slow down and notice life history, family history, and areas that may need attention later.",
      "You can mark only what seems relevant. Leave anything blank if you are unsure.",
    ],
  },
  "step-1": {
    title: "Renounce counterfeit spiritual involvement",
    paragraphs: [
      "This step asks you to identify spiritual practices, groups, or experiences that need to be renounced aloud.",
      "After you mark an item, the app can show the renunciation prayer for that one item.",
    ],
    care: "If a memory or experience feels overwhelming, pause and continue with a trusted helper.",
  },
  "step-2": {
    title: "Agree with truth",
    paragraphs: [
      "This step focuses on self-deception and self-defense patterns.",
      "The goal is not self-condemnation; it is to agree with truth and bring each named area into prayer.",
    ],
  },
  "step-3": {
    title: "Forgive one person and hurt at a time",
    paragraphs: [
      "This step can be tender. Add one person and one hurt at a time, then pray the forgiveness prayer for that individual entry.",
      "Include yourself and thoughts against God when appropriate.",
    ],
    care: "Forgiveness does not excuse harm or remove wise boundaries. It releases the person to God.",
  },
  "step-4": {
    title: "Submit where the Steps ask you to submit",
    paragraphs: [
      "This step reviews lines of authority and any rebelliousness toward them.",
      "Select only what applies, then create individual prayers for those areas.",
    ],
  },
  "step-5": {
    title: "Name pride specifically",
    paragraphs: [
      "This step helps move pride from a general idea into specific areas that can be confessed and renounced.",
      "Each selected item remains its own prayer.",
    ],
  },
  "step-6": {
    title: "Confess habitual sin and bondage specifically",
    paragraphs: [
      "This step asks you to name deeds of the flesh and other bondage areas without merging them together.",
      "Specific entries can become specific prayers, which is the point.",
    ],
    care: "For abuse, trauma, addiction, or self-harm concerns, do this with appropriate pastoral or professional support.",
  },
  "step-7": {
    title: "Renounce ancestral sin and curses",
    paragraphs: [
      "This final step names what has come to mind, then leads into the declaration and closing prayer.",
      "After this step, the final journey page gathers your individual prayers for review, email, or print.",
    ],
  },
};

function applyTemplate(template: string, value: string) {
  return template.replaceAll("{{item}}", value).replaceAll("{{person}}", value);
}

function fillOpeningDeclaration(body: string, participantName: string) {
  const name = participantName.trim();
  if (!name) return body;
  return body.replace(/_{6,}/g, name);
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Reading({ block }: { block: ReadingBlock }) {
  return (
    <section className="space-y-3">
      {block.title ? <h3 className="text-lg font-black text-[#15284B]">{block.title}</h3> : null}
      <div className="space-y-3 text-[17px] font-medium leading-8 text-[#15284B] sm:text-[15px] sm:font-normal sm:leading-7 sm:text-slate-700">
        {block.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </section>
  );
}

function PrayerCard({ title, body, privateMode = false }: { title: string; body: string; privateMode?: boolean }) {
  return (
    <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
      <div className={cx("mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#3B9189]", privateMode && "blur-sm transition hover:blur-none")}>{title}</div>
      <p className={cx("text-[17px] font-medium leading-8 text-[#15284B] sm:text-[16px] sm:font-normal", privateMode && "blur-sm transition hover:blur-none")}>{body}</p>
    </div>
  );
}

function OpeningDeclarationNameField({
  value,
  onChange,
  privateMode,
}: {
  value: string;
  onChange: (value: string) => void;
  privateMode: boolean;
}) {
  return (
    <section className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#3B9189]">Fill the declaration blanks</div>
      <label className="block space-y-2">
        <span className="text-base font-black text-[#15284B]">Name or initials</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cx(
            "h-12 w-full rounded-md border border-[#9B9B96] bg-white px-3 text-base font-semibold text-slate-950 shadow-sm outline-none transition focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40 sm:h-10 sm:text-sm",
            privateMode && "blur-sm focus:blur-none",
          )}
          placeholder="Example: Mark, M., or my name"
        />
      </label>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#294782]">This fills the blanks in the declaration below.</p>
    </section>
  );
}

function CreatePrayerButton({
  disabled,
  generated,
  actionLabel = "Create prayer",
  generatedLabel = "Prayer created",
  onClick,
}: {
  disabled: boolean;
  generated: boolean;
  actionLabel?: string;
  generatedLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-45",
        generated ? "bg-[#7DCAC2] text-[#15284B]" : "bg-[#3B9189] text-white hover:bg-[#294782]",
      )}
    >
      {generated ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
      {generated ? generatedLabel : actionLabel}
    </button>
  );
}

function ChecklistPromptView({
  prompt,
  selected,
  customText,
  prayerCreated,
  onToggle,
  onCustomText,
  onCreatePrayer,
  privateMode,
}: {
  prompt: ChecklistPrompt;
  selected: string[];
  customText: string;
  prayerCreated: boolean;
  onToggle: (value: string) => void;
  onCustomText: (value: string) => void;
  onCreatePrayer: () => void;
  privateMode: boolean;
}) {
  const customItems = useMemo(
    () =>
      customText
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    [customText],
  );
  const generatedItems = [...selected, ...customItems];
  const reviewOnly = !prompt.prayerTemplate;

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-[#15284B]">{prompt.title}</h3>
        {prompt.instruction ? <p className="mt-1 text-base font-semibold leading-7 text-[#294782] sm:text-sm sm:leading-6 sm:text-slate-600">{prompt.instruction}</p> : null}
        {reviewOnly ? (
          <p className="mt-1 text-base font-semibold leading-7 text-[#294782] sm:text-sm sm:leading-6 sm:text-slate-600">
            Mark any area that may need attention later. This preparation list is for review, not a prayer or confession yet.
          </p>
        ) : null}
      </div>

      <div className={cx("grid gap-2", reviewOnly ? "xl:grid-cols-2" : "md:grid-cols-2")}>
        {prompt.items.map((item) => {
          const checked = selected.includes(item);
          return (
            <button
              key={item}
              type="button"
              onClick={() => onToggle(item)}
              className={cx(
                "flex min-h-12 items-start gap-3 rounded-md border px-3 py-3 text-left text-[15px] font-bold leading-6 transition sm:text-sm sm:leading-5",
                checked
                  ? "border-[#3B9189] bg-[#7DCAC2]/20 text-[#15284B]"
                  : "border-[#D6D6D2] bg-white text-[#15284B] hover:border-[#5A81CF] sm:text-slate-700",
              )}
            >
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={cx(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border",
                    checked ? "border-[#3B9189] bg-[#3B9189] text-white" : "border-[#9B9B96] bg-white",
                  )}
                >
                  {checked ? <Check className="h-3.5 w-3.5" /> : null}
                </span>
                <span>{item}</span>
              </span>
              {reviewOnly ? (
                <span className={cx("ml-auto hidden shrink-0 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] sm:inline-flex", checked ? "bg-[#15284B] text-white" : "bg-[#F6F6F5] text-[#294782]")}>
                  {checked ? "Marked" : "Review"}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {prompt.allowCustom ? (
        <label className="block space-y-2">
          <span className="text-sm font-black text-[#15284B]">Other</span>
          <textarea
            value={customText}
            onChange={(event) => onCustomText(event.target.value)}
            className={cx(
              "min-h-24 w-full rounded-md border border-[#D6D6D2] bg-white px-3 py-2 text-base leading-7 text-slate-950 shadow-sm outline-none transition focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40 sm:text-sm sm:leading-6",
              privateMode && "blur-sm focus:blur-none",
            )}
            placeholder="Add one item per line"
          />
        </label>
      ) : null}

      {prompt.prayerTemplate ? (
        <CreatePrayerButton disabled={!generatedItems.length} generated={prayerCreated && !!generatedItems.length} onClick={onCreatePrayer} />
      ) : null}

      {prompt.prayerTemplate && prayerCreated && generatedItems.length ? (
        <div className="space-y-3">
          <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#294782]">Pray aloud</h4>
          {generatedItems.map((item) => (
            <PrayerCard key={`${prompt.id}-${item}`} title={item} body={applyTemplate(prompt.prayerTemplate!, item)} privateMode={privateMode} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ForgivenessPromptView({
  prompt,
  rows,
  prayerCreated,
  onRows,
  onCreatePrayer,
  privateMode,
}: {
  prompt: Extract<StepPrompt, { kind: "forgiveness" }>;
  rows: ForgivenessRow[];
  prayerCreated: boolean;
  onRows: (rows: ForgivenessRow[]) => void;
  onCreatePrayer: () => void;
  privateMode: boolean;
}) {
  function updateRow(id: string, field: "person" | "hurt", value: string) {
    onRows(rows.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    onRows([...rows, { id: crypto.randomUUID(), person: "", hurt: "" }]);
  }

  function removeEmptyRows() {
    onRows(rows.filter((row) => row.person.trim() || row.hurt.trim()));
  }

  const activeRows = rows.filter((row) => row.person.trim() && row.hurt.trim());

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-[#15284B]">{prompt.title}</h3>
        <p className="mt-1 text-base font-semibold leading-7 text-[#294782] sm:text-sm sm:leading-6 sm:text-slate-600">{prompt.instruction}</p>
      </div>

      <div className="space-y-3">
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-3 rounded-md border border-[#D6D6D2] bg-white p-3 md:grid-cols-[0.7fr_1.3fr]">
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#294782]">Person {index + 1}</span>
              <input
                value={row.person}
                onChange={(event) => updateRow(row.id, "person", event.target.value)}
                className={cx(
                  "h-11 w-full rounded-md border border-[#D6D6D2] px-3 text-base outline-none transition focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40 sm:h-10 sm:text-sm",
                  privateMode && "blur-sm focus:blur-none",
                )}
                placeholder="person’s name"
              />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[#294782]">For</span>
              <input
                value={row.hurt}
                onChange={(event) => updateRow(row.id, "hurt", event.target.value)}
                className={cx(
                  "h-11 w-full rounded-md border border-[#D6D6D2] px-3 text-base outline-none transition focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40 sm:h-10 sm:text-sm",
                  privateMode && "blur-sm focus:blur-none",
                )}
                placeholder="verbally state every hurt and pain"
              />
            </label>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={addRow} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#15284B] px-4 text-sm font-black text-white">
          <Plus className="h-4 w-4" /> Add
        </button>
        <button type="button" onClick={removeEmptyRows} className="inline-flex h-10 items-center rounded-md border border-[#D6D6D2] bg-white px-4 text-sm font-black text-[#15284B]">
          Remove blanks
        </button>
      </div>

      <CreatePrayerButton disabled={!activeRows.length} generated={prayerCreated && !!activeRows.length} onClick={onCreatePrayer} />

      {prayerCreated && activeRows.length ? (
        <div className="space-y-3">
          <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#294782]">Pray aloud</h4>
          {activeRows.map((row) => (
            <PrayerCard key={`prayer-${row.id}`} title={row.person} body={prompt.prayerTemplate.replace("{{person}}", row.person).replace("{{hurt}}", row.hurt)} privateMode={privateMode} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function FreeformPromptView({
  prompt,
  value,
  prayerCreated,
  onChange,
  onCreatePrayer,
  privateMode,
}: {
  prompt: FreeformPrompt;
  value: string;
  prayerCreated: boolean;
  onChange: (value: string) => void;
  onCreatePrayer: () => void;
  privateMode: boolean;
}) {
  const entries = value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const preparesDeclaration = prompt.id === "ancestors";
  const createsRenunciationPrayers = prompt.id === "step-1-questions";

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-[#15284B]">{prompt.title}</h3>
        <p className="mt-1 text-base font-semibold leading-7 text-[#294782] sm:text-sm sm:leading-6 sm:text-slate-600">{prompt.instruction}</p>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cx(
          "min-h-32 w-full rounded-md border border-[#D6D6D2] bg-white px-3 py-2 text-base leading-7 text-slate-950 shadow-sm outline-none transition focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40 sm:text-sm sm:leading-6",
          privateMode && "blur-sm focus:blur-none",
        )}
        placeholder="Add one entry per line"
      />
      {createsRenunciationPrayers ? (
        <p className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-2 text-base font-bold leading-7 text-[#294782] sm:text-sm sm:leading-6">
          Write one item per line. Each line becomes its own renunciation prayer below.
        </p>
      ) : null}
      {prompt.prayerTemplate || preparesDeclaration ? (
        <CreatePrayerButton
          disabled={!entries.length}
          generated={prayerCreated && !!entries.length}
          actionLabel={preparesDeclaration ? "Prepare declaration" : createsRenunciationPrayers ? "Create renunciation prayers" : "Create prayer"}
          generatedLabel={preparesDeclaration ? "Declaration prepared" : createsRenunciationPrayers ? "Renunciation prayers ready" : "Prayer created"}
          onClick={onCreatePrayer}
        />
      ) : null}

      {createsRenunciationPrayers && entries.length && !prayerCreated ? (
        <p className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-2 text-base font-bold leading-7 text-[#294782] sm:text-sm sm:leading-6">
          Tap Create renunciation prayers to make one prayer for each line before continuing to the special renunciations below.
        </p>
      ) : null}

      {preparesDeclaration && !prayerCreated && entries.length ? (
        <p className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-2 text-base font-bold leading-7 text-[#294782] sm:text-sm sm:leading-6">
          Tap Prepare declaration to place these entries into the declaration below.
        </p>
      ) : null}

      {preparesDeclaration && prayerCreated && entries.length ? (
        <div className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] p-3 sm:p-4">
          <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#3B9189]">Declaration insertion</div>
          <p className={cx("text-[16px] font-semibold leading-7 text-[#15284B] sm:text-[15px]", privateMode && "blur-sm transition hover:blur-none")}>including: {entries.join("; ")}</p>
        </div>
      ) : null}

      {prompt.prayerTemplate && prayerCreated && entries.length ? (
        <div className="space-y-3">
          <h4 className="text-sm font-black uppercase tracking-[0.12em] text-[#294782]">Pray aloud</h4>
          {entries.map((entry) => (
            <PrayerCard key={`${prompt.id}-${entry}`} title={entry} body={applyTemplate(prompt.prayerTemplate!, entry)} privateMode={privateMode} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function splitEntries(value: string) {
  return value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getAncestorEntries(text: TextState) {
  return splitEntries(text.ancestors ?? "");
}

function applyAncestorDeclarationBlank(paragraph: string, entries: string[], prepared: boolean) {
  if (!prepared || !entries.length) return paragraph;
  return paragraph.replace("(name those that have come to mind)", entries.join("; "));
}

function applyAncestorDeclarationBlock(block: ReadingBlock, entries: string[], prepared: boolean): ReadingBlock {
  if (block.title !== "Declaration") return block;
  return {
    ...block,
    paragraphs: block.paragraphs.map((paragraph) => applyAncestorDeclarationBlank(paragraph, entries, prepared)),
  };
}

function buildPreparedAncestorDeclaration(text: TextState, generatedPrayers: GeneratedPrayerState) {
  const entries = getAncestorEntries(text);
  if (!entries.length || !generatedPrayers.ancestors) return null;
  const step = stepsSections.find((section) => section.id === "step-7");
  const declaration = step?.declarations?.find((block) => block.title === "Declaration");
  if (!step || !declaration) return null;
  return {
    stepLabel: step.eyebrow,
    stepTitle: step.title,
    promptTitle: "Declaration",
    item: entries.join("; "),
    body: applyAncestorDeclarationBlock(declaration, entries, true).paragraphs.join("\n\n"),
  };
}

function buildJourneyPrayers(selected: SelectedState, text: TextState, forgiveness: ForgivenessState, generatedPrayers: GeneratedPrayerState) {
  const prayers: JourneyPrayer[] = [];

  for (const section of stepsSections) {
    for (const prompt of section.prompts) {
      if (prompt.kind === "checklist" && prompt.prayerTemplate) {
        const entries = [...(selected[prompt.id] ?? []), ...splitEntries(text[`${prompt.id}:custom`] ?? "")];
        entries.forEach((entry) => {
          prayers.push({
            stepLabel: section.eyebrow,
            stepTitle: section.title,
            promptTitle: prompt.title,
            item: entry,
            body: applyTemplate(prompt.prayerTemplate!, entry),
          });
        });
      }

      if (prompt.kind === "freeform" && prompt.prayerTemplate) {
        splitEntries(text[prompt.id] ?? "").forEach((entry) => {
          prayers.push({
            stepLabel: section.eyebrow,
            stepTitle: section.title,
            promptTitle: prompt.title,
            item: entry,
            body: applyTemplate(prompt.prayerTemplate!, entry),
          });
        });
      }

      if (prompt.kind === "forgiveness") {
        (forgiveness[prompt.id] ?? [])
          .filter((row) => row.person.trim() && row.hurt.trim())
          .forEach((row) => {
            prayers.push({
              stepLabel: section.eyebrow,
              stepTitle: section.title,
              promptTitle: prompt.title,
              item: row.person,
              body: prompt.prayerTemplate.replace("{{person}}", row.person).replace("{{hurt}}", row.hurt),
            });
          });
      }
    }
  }

  const ancestorDeclaration = buildPreparedAncestorDeclaration(text, generatedPrayers);
  if (ancestorDeclaration) prayers.push(ancestorDeclaration);

  return prayers;
}

function buildJourneyEmailText(prayers: JourneyPrayer[]) {
  const lines = ["Steps to Freedom in Christ", attributionNotice, sourceNotice, "", "Entire journey prayers and declarations"];

  if (!prayers.length) {
    lines.push("No journey prayers are ready yet.");
    return lines.join("\n");
  }

  prayers.forEach((prayer, index) => {
    lines.push("", `${index + 1}. ${prayer.stepLabel}: ${prayer.stepTitle}`, prayer.promptTitle, prayer.item, prayer.body);
  });

  return lines.join("\n");
}

function buildExportText(selected: SelectedState, text: TextState, forgiveness: ForgivenessState, completed: string[], generatedPrayers: GeneratedPrayerState, participantName: string) {
  const lines = [
    "Steps to Freedom in Christ",
    attributionNotice,
    sourceNotice,
    "",
    "Completed",
    completed.length ? completed.join(", ") : "None marked complete",
    "",
    "Opening declaration blanks",
    participantName.trim() ? participantName.trim() : "Not filled",
    "",
    "Selections",
  ];

  for (const [id, values] of Object.entries(selected)) {
    if (values.length) lines.push(`${id}: ${values.join("; ")}`);
  }

  lines.push("", "Written entries");
  for (const [id, value] of Object.entries(text)) {
    if (value.trim()) lines.push(`${id}:\n${value.trim()}`);
  }

  lines.push("", "Forgiveness entries");
  for (const [id, rows] of Object.entries(forgiveness)) {
    const active = rows.filter((row) => row.person.trim() || row.hurt.trim());
    if (active.length) {
      lines.push(id);
      active.forEach((row) => lines.push(`- ${row.person}: ${row.hurt}`));
    }
  }

  lines.push("", "Generated prayers and declarations");
  let prayerCount = 0;

  for (const section of stepsSections) {
    for (const prompt of section.prompts) {
      if (!generatedPrayers[prompt.id]) continue;

      if (prompt.kind === "checklist" && prompt.prayerTemplate) {
        const entries = [...(selected[prompt.id] ?? []), ...splitEntries(text[`${prompt.id}:custom`] ?? "")];
        if (!entries.length) continue;
        lines.push("", `${section.eyebrow}: ${section.title}`, prompt.title);
        entries.forEach((entry) => {
          prayerCount += 1;
          lines.push(`- ${entry}`, applyTemplate(prompt.prayerTemplate!, entry));
        });
      }

      if (prompt.kind === "freeform" && prompt.prayerTemplate) {
        const entries = splitEntries(text[prompt.id] ?? "");
        if (!entries.length) continue;
        lines.push("", `${section.eyebrow}: ${section.title}`, prompt.title);
        entries.forEach((entry) => {
          prayerCount += 1;
          lines.push(`- ${entry}`, applyTemplate(prompt.prayerTemplate!, entry));
        });
      }

      if (prompt.kind === "forgiveness") {
        const rows = (forgiveness[prompt.id] ?? []).filter((row) => row.person.trim() && row.hurt.trim());
        if (!rows.length) continue;
        lines.push("", `${section.eyebrow}: ${section.title}`, prompt.title);
        rows.forEach((row) => {
          prayerCount += 1;
          lines.push(`- ${row.person}`, prompt.prayerTemplate.replace("{{person}}", row.person).replace("{{hurt}}", row.hurt));
        });
      }

      if (prompt.kind === "freeform" && prompt.id === "ancestors") {
        const declaration = buildPreparedAncestorDeclaration(text, generatedPrayers);
        if (!declaration) continue;
        prayerCount += 1;
        lines.push("", `${section.eyebrow}: ${section.title}`, declaration.promptTitle, declaration.item, declaration.body);
      }
    }
  }

  if (!prayerCount) {
    lines.push("None created");
  }

  return lines.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printablePrayerHtml(body: string) {
  return escapeHtml(body).replaceAll("\n", "<br />");
}

function blankPrayerTemplate(template: string) {
  return template
    .replaceAll("{{item}}", "____________________________")
    .replaceAll("{{person}}", "____________________________")
    .replaceAll("{{hurt}}", "____________________________");
}

function buildPrintDocument(title: string, content: string) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 0.65in; }
    * { box-sizing: border-box; }
    body { color: #15284B; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.5; margin: 0; }
    h1 { font-size: 24px; margin: 0 0 6px; }
    h2 { border-top: 2px solid #D6D6D2; font-size: 16px; margin: 22px 0 8px; padding-top: 12px; }
    h3 { color: #294782; font-size: 13px; margin: 12px 0 6px; text-transform: uppercase; }
    p { margin: 0 0 8px; }
    .notice { color: #4b5563; font-size: 10px; margin-bottom: 20px; }
    .prayer { border: 1px solid #D6D6D2; break-inside: avoid; margin: 0 0 10px; padding: 10px; }
    .label { color: #3B9189; font-size: 10px; font-weight: 700; margin-bottom: 4px; text-transform: uppercase; }
    .line { border-bottom: 1px solid #9B9B96; display: inline-block; min-width: 210px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="notice">${escapeHtml(attributionNotice)}</div>
  <div class="notice">${escapeHtml(sourceNotice)}</div>
  ${content}
</body>
</html>`;
}

function openPrintWindow(title: string, html: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;
  printWindow.document.open();
  printWindow.document.write(buildPrintDocument(title, html));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function buildFilledPrintContent(prayers: JourneyPrayer[]) {
  if (!prayers.length) {
    return "<p>No journey prayers are ready yet.</p>";
  }

  return prayers
    .map(
      (prayer, index) => `
        <section class="prayer">
          <div class="label">${escapeHtml(prayer.stepLabel)}: ${escapeHtml(prayer.stepTitle)}</div>
          <h3>${index + 1}. ${escapeHtml(prayer.promptTitle)}</h3>
          <p><strong>${escapeHtml(prayer.item)}</strong></p>
          <p>${printablePrayerHtml(prayer.body)}</p>
        </section>`,
    )
    .join("");
}

function readingPrintHtml(blocks: ReadingBlock[]) {
  return blocks
    .map(
      (block) => `
        <section>
          ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
          ${block.paragraphs.map((paragraph) => `<p>${printablePrayerHtml(paragraph)}</p>`).join("")}
        </section>`,
    )
    .join("");
}

function buildBlankPrintContent(extraRows: number) {
  const rowsPerPrompt = Math.max(1, extraRows);
  const sections = stepsSections
    .map((section) => {
      const promptHtml = section.prompts
        .map((prompt) => {
          if (prompt.kind === "checklist" && prompt.prayerTemplate) {
            const rows = Array.from({ length: rowsPerPrompt }, (_, index) => `
              <section class="prayer">
                <div class="label">${escapeHtml(section.eyebrow)}: ${escapeHtml(section.title)}</div>
                <h3>${escapeHtml(prompt.title)} ${index + 1}</h3>
                <p>${printablePrayerHtml(blankPrayerTemplate(prompt.prayerTemplate!))}</p>
              </section>`);
            return rows.join("");
          }

          if (prompt.kind === "freeform" && prompt.prayerTemplate) {
            const rows = Array.from({ length: rowsPerPrompt }, (_, index) => `
              <section class="prayer">
                <div class="label">${escapeHtml(section.eyebrow)}: ${escapeHtml(section.title)}</div>
                <h3>${escapeHtml(prompt.title)} ${index + 1}</h3>
                <p>${printablePrayerHtml(blankPrayerTemplate(prompt.prayerTemplate!))}</p>
              </section>`);
            return rows.join("");
          }

          if (prompt.kind === "forgiveness") {
            const rows = Array.from({ length: rowsPerPrompt }, (_, index) => `
              <section class="prayer">
                <div class="label">${escapeHtml(section.eyebrow)}: ${escapeHtml(section.title)}</div>
                <h3>${escapeHtml(prompt.title)} ${index + 1}</h3>
                <p>${printablePrayerHtml(blankPrayerTemplate(prompt.prayerTemplate))}</p>
              </section>`);
            return rows.join("");
          }

          return "";
        })
        .join("");

      return promptHtml ? `<h2>${escapeHtml(section.eyebrow)}: ${escapeHtml(section.title)}</h2>${promptHtml}` : "";
    })
    .join("");

  return sections || "<p>No blank prayer templates are available.</p>";
}

function buildFullPacketPrintContent(extraRows: number, participantName = "") {
  const filledOpeningDeclaration = fillOpeningDeclaration(openingDeclaration, participantName);
  const stepHtml = stepsSections
    .map((section) => {
      const prompts = section.prompts
        .map((prompt) => {
          if (prompt.kind === "checklist") {
            return `
              <h3>${escapeHtml(prompt.title)}</h3>
              ${prompt.instruction ? `<p>${escapeHtml(prompt.instruction)}</p>` : ""}
              ${prompt.items.map((item) => `<p>☐ ${escapeHtml(item)}</p>`).join("")}
              ${prompt.allowCustom ? "<p>Other: ____________________________</p>" : ""}
            `;
          }
          if (prompt.kind === "freeform") {
            return `
              <h3>${escapeHtml(prompt.title)}</h3>
              <p>${escapeHtml(prompt.instruction)}</p>
              <p>____________________________________________________________</p>
              <p>____________________________________________________________</p>
              <p>____________________________________________________________</p>
            `;
          }
          if (prompt.kind === "forgiveness") {
            return `
              <h3>${escapeHtml(prompt.title)}</h3>
              <p>${escapeHtml(prompt.instruction)}</p>
              <p>Person: ____________________________ For: ____________________________</p>
              <p>Person: ____________________________ For: ____________________________</p>
              <p>Person: ____________________________ For: ____________________________</p>
            `;
          }
          return "";
        })
        .join("");

      const promptPrayers = section.prompts
        .map((prompt) => {
          if (prompt.kind === "checklist" && prompt.prayerTemplate) {
            return Array.from(
              { length: Math.max(1, extraRows) },
              (_, index) => `<section class="prayer"><div class="label">${escapeHtml(prompt.title)} ${index + 1}</div><p>${printablePrayerHtml(blankPrayerTemplate(prompt.prayerTemplate!))}</p></section>`,
            ).join("");
          }
          if (prompt.kind === "freeform" && prompt.prayerTemplate) {
            return Array.from(
              { length: Math.max(1, extraRows) },
              (_, index) => `<section class="prayer"><div class="label">${escapeHtml(prompt.title)} ${index + 1}</div><p>${printablePrayerHtml(blankPrayerTemplate(prompt.prayerTemplate!))}</p></section>`,
            ).join("");
          }
          if (prompt.kind === "forgiveness") {
            return Array.from(
              { length: Math.max(1, extraRows) },
              (_, index) => `<section class="prayer"><div class="label">${escapeHtml(prompt.title)} ${index + 1}</div><p>${printablePrayerHtml(blankPrayerTemplate(prompt.prayerTemplate))}</p></section>`,
            ).join("");
          }
          return "";
        })
        .join("");

      return `
        <h2>${escapeHtml(section.eyebrow)}: ${escapeHtml(section.title)}</h2>
        ${readingPrintHtml(section.readings)}
        ${section.openingPrayer ? `<section class="prayer"><div class="label">Prayer</div><p>${printablePrayerHtml(section.openingPrayer)}</p></section>` : ""}
        ${prompts}
        ${promptPrayers}
        ${section.declarations ? readingPrintHtml(section.declarations) : ""}
        ${section.closingPrayer ? `<section class="prayer"><div class="label">Prayer</div><p>${printablePrayerHtml(section.closingPrayer)}</p></section>` : ""}
      `;
    })
    .join("");

  return `
    <h2>Before the Steps</h2>
    ${readingPrintHtml(openingSections)}
    <section class="prayer"><div class="label">Prayer</div><p>${printablePrayerHtml(openingPrayer)}</p></section>
    <section class="prayer"><div class="label">Declaration</div><p>${printablePrayerHtml(filledOpeningDeclaration)}</p></section>
    ${stepHtml}
    <h2>Aftercare</h2>
    ${readingPrintHtml(aftercareSections)}
  `;
}

function buildAftercarePrintContent() {
  return readingPrintHtml(aftercareSections);
}

function groupJourneyPrayers(prayers: JourneyPrayer[]) {
  return prayers.reduce<Array<{ id: string; label: string; prayers: JourneyPrayer[] }>>((groups, prayer) => {
    const id = `${prayer.stepLabel}-${prayer.stepTitle}`;
    const existing = groups.find((group) => group.id === id);
    if (existing) {
      existing.prayers.push(prayer);
      return groups;
    }
    groups.push({ id, label: `${prayer.stepLabel}: ${prayer.stepTitle}`, prayers: [prayer] });
    return groups;
  }, []);
}

function PathChoiceButton({
  option,
  selected,
  compact = false,
  onClick,
}: {
  option: { id: ExperienceMode; title: string; description: string };
  selected: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "group flex w-full cursor-pointer items-center gap-3 rounded-md border-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#7DCAC2]/40 active:translate-y-0",
        compact ? "px-3 py-3" : "px-4 py-4 sm:px-5 sm:py-5",
        selected ? "border-[#3B9189] bg-[#7DCAC2]/25 text-[#15284B]" : "border-[#9B9B96] bg-white text-[#15284B] hover:border-[#3D66B9] hover:bg-[#F6F6F5]",
      )}
    >
      <span
        className={cx(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-[#3B9189] bg-[#3B9189] text-white" : "border-[#9B9B96] bg-white text-transparent group-hover:border-[#3D66B9]",
        )}
      >
        <Check className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx("block font-black", compact ? "text-sm" : "text-lg")}>{option.title}</span>
        {!compact ? <span className="mt-1 block text-base font-semibold leading-7 text-[#294782] sm:text-sm sm:leading-6 sm:text-slate-600">{option.description}</span> : null}
      </span>
      <span
        className={cx(
          "shrink-0 rounded-md px-3 py-1 text-xs font-black uppercase tracking-[0.12em]",
          selected ? "bg-[#15284B] text-white" : "border border-[#D6D6D2] bg-white text-[#294782] group-hover:border-[#3D66B9]",
        )}
      >
        {selected ? "Selected" : "Choose"}
      </span>
    </button>
  );
}

function ModeChooser({ mode, onMode }: { mode: ExperienceMode; onMode: (mode: ExperienceMode) => void }) {
  return (
    <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-1 text-sm font-black text-[#15284B]">Session path</div>
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#294782]">Select one</p>
      <div className="space-y-2">
        {modeOptions.map((option) => (
          <PathChoiceButton
            key={option.id}
            option={option}
            selected={mode === option.id}
            onClick={() => onMode(option.id)}
          />
        ))}
      </div>
    </div>
  );
}

function PrivacyControls({
  privateMode,
  localResume,
  onPrivateMode,
  onLocalResume,
}: {
  privateMode: boolean;
  localResume: boolean;
  onPrivateMode: (value: boolean) => void;
  onLocalResume: (value: boolean) => void;
}) {
  return (
    <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 text-sm font-black text-[#15284B]">Privacy</div>
      <label className="mb-3 flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={privateMode} onChange={(event) => onPrivateMode(event.target.checked)} className="mt-1 h-4 w-4 accent-[#3B9189]" />
        <span>
          <span className="flex items-center gap-2 text-sm font-black text-[#15284B]">
            <EyeOff className="h-4 w-4 text-[#3B9189]" /> Hide entries
          </span>
          <span className="mt-1 block text-sm font-semibold leading-6 text-[#294782] sm:text-xs sm:leading-5 sm:text-slate-600">Entries blur until focused or hovered.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={localResume} onChange={(event) => onLocalResume(event.target.checked)} className="mt-1 h-4 w-4 accent-[#3B9189]" />
        <span>
          <span className="flex items-center gap-2 text-sm font-black text-[#15284B]">
            <Save className="h-4 w-4 text-[#294782]" /> Save on this device
          </span>
          <span className="mt-1 block text-sm font-semibold leading-6 text-[#294782] sm:text-xs sm:leading-5 sm:text-slate-600">Optional local resume in this browser only.</span>
        </span>
      </label>
    </div>
  );
}

function FacilitatorPanel({ mode }: { mode: ExperienceMode }) {
  if (mode !== "facilitator") return null;
  return (
    <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#15284B]">
        <Users className="h-4 w-4 text-[#3B9189]" /> Facilitator
      </div>
      <p className="text-base font-semibold leading-7 text-[#15284B] sm:text-sm sm:font-normal sm:leading-6 sm:text-slate-600">Keep the sequence visible, let the participant own each confession, renunciation, forgiveness choice, and prayer.</p>
    </div>
  );
}

function FooterAttribution() {
  return (
    <footer className="pb-8 pt-2 text-center text-xs font-bold leading-5 text-slate-500">
      <p>{attributionNotice}</p>
      <p className="mt-1 uppercase tracking-[0.12em]">{sourceNotice}</p>
    </footer>
  );
}

function StepBriefing({ sectionId }: { sectionId: string }) {
  const briefing = stepBriefings[sectionId];
  if (!briefing) return null;

  return (
    <div className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] p-3 sm:p-4">
      <div className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">What happens here</div>
      <h3 className="text-lg font-black text-[#15284B]">{briefing.title}</h3>
      <div className="mt-2 space-y-2 text-base font-semibold leading-7 text-[#15284B] sm:text-sm sm:leading-6 sm:text-slate-600">
        {briefing.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      {briefing.care ? <p className="mt-3 rounded-md border border-[#D6D6D2] bg-white px-3 py-2 text-base font-bold leading-7 text-[#294782] sm:text-sm sm:leading-6">{briefing.care}</p> : null}
    </div>
  );
}

function PreparationBridge({ familyHistory, personalHistory, onContinue }: { familyHistory: string[]; personalHistory: string[]; onContinue: () => void }) {
  const reviewItems = [...familyHistory, ...personalHistory];

  return (
    <section className="rounded-md border border-[#7DCAC2] bg-[#7DCAC2]/15 p-3 sm:p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">Preparation checkpoint</div>
      <h3 className="mt-1 text-lg font-black text-[#15284B]">{reviewItems.length ? `${reviewItems.length} review area${reviewItems.length === 1 ? "" : "s"} marked` : "No review areas marked yet"}</h3>
      <p className="mt-2 text-base font-semibold leading-7 text-[#15284B] sm:text-sm sm:leading-6">
        This page is for noticing history before the Steps begin. It does not create a prayer. Your marked areas stay available in the worksheet/export, and the first prayer-building step starts next.
      </p>
      {reviewItems.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {reviewItems.map((item) => (
            <span key={item} className="rounded-md bg-white px-2 py-1 text-xs font-black text-[#294782] shadow-sm">
              {item}
            </span>
          ))}
        </div>
      ) : null}
      <button type="button" onClick={onContinue} className="mt-4 inline-flex h-11 items-center gap-2 rounded-md bg-[#15284B] px-4 text-sm font-black text-white">
        Continue to Step 1 <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function SessionOptions({
  mode,
  privateMode,
  localResume,
  onMode,
  onPrivateMode,
  onLocalResume,
}: {
  mode: ExperienceMode;
  privateMode: boolean;
  localResume: boolean;
  onMode: (mode: ExperienceMode) => void;
  onPrivateMode: (value: boolean) => void;
  onLocalResume: (value: boolean) => void;
}) {
  return (
    <details className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
      <summary className="cursor-pointer text-sm font-black text-[#15284B]">Session options</summary>
      <div className="mt-4 space-y-4">
        <div>
          <div className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#294782]">Select path</div>
          <div className="grid gap-2">
            {modeOptions.map((option) => (
              <PathChoiceButton
                key={option.id}
                option={option}
                selected={mode === option.id}
                compact
                onClick={() => onMode(option.id)}
              />
            ))}
          </div>
        </div>
        <PrivacyControls privateMode={privateMode} localResume={localResume} onPrivateMode={onPrivateMode} onLocalResume={onLocalResume} />
      </div>
    </details>
  );
}

function SessionTools({
  blankRows,
  onBlankRows,
  onExport,
  onEmailCreated,
  onPrintBlank,
  onPrintFull,
  onPrintAftercare,
  onClear,
}: {
  blankRows: number;
  onBlankRows: (value: number) => void;
  onExport: () => void;
  onEmailCreated: () => void;
  onPrintBlank: () => void;
  onPrintFull: () => void;
  onPrintAftercare: () => void;
  onClear: () => void;
}) {
  return (
    <details className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
      <summary className="cursor-pointer text-sm font-black text-[#15284B]">Session tools</summary>
      <div className="mt-4 space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-black uppercase tracking-[0.12em] text-[#294782]">Blank rows</span>
          <input
            type="number"
            min={1}
            max={12}
            value={blankRows}
            onChange={(event) => onBlankRows(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
            className="h-10 w-24 rounded-md border border-[#D6D6D2] bg-white px-3 text-sm font-black text-[#15284B] outline-none focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40"
          />
        </label>
        <div className="grid gap-2">
          <button type="button" onClick={onPrintBlank} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#15284B] px-4 text-sm font-black text-white">
            <Printer className="h-4 w-4" /> Blank worksheet
          </button>
          <button type="button" onClick={onPrintFull} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#294782] px-4 text-sm font-black text-white">
            <Printer className="h-4 w-4" /> Full packet
          </button>
          <button type="button" onClick={onPrintAftercare} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D6D6D2] bg-white px-4 text-sm font-black text-[#15284B]">
            <Printer className="h-4 w-4" /> Aftercare
          </button>
          <button type="button" onClick={onExport} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#3B9189] px-4 text-sm font-black text-white">
            <Download className="h-4 w-4" /> Export text
          </button>
          <button type="button" onClick={onEmailCreated} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#294782] px-4 text-sm font-black text-white">
            <Mail className="h-4 w-4" /> Send created email
          </button>
          <button type="button" onClick={onClear} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D6D6D2] bg-white px-4 text-sm font-black text-[#15284B]">
            <Eraser className="h-4 w-4" /> Clear session
          </button>
        </div>
      </div>
    </details>
  );
}

function EmailSendPanel({
  target,
  recipientEmail,
  state,
  disabled,
  onRecipientEmail,
  onSend,
  onCancel,
}: {
  target: EmailTarget;
  recipientEmail: string;
  state: EmailSendState;
  disabled: boolean;
  onRecipientEmail: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
}) {
  const isJourney = target === "journey";

  return (
    <section className="rounded-md border border-[#7DCAC2] bg-white p-3 shadow-sm sm:p-5">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">Send from the system</div>
      <h2 className="mt-1 text-xl font-black text-[#15284B]">{isJourney ? "Email entire journey" : "Email created worksheet"}</h2>
      <p className="mt-2 text-base font-semibold leading-7 text-[#294782] sm:text-sm sm:leading-6">
        Enter the recipient and the app will send the contents from yournamehere.vip. This does not open the visitor’s email app, and the contents are not saved after sending.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        <label className="space-y-1">
          <span className="block text-xs font-black uppercase tracking-[0.12em] text-[#294782]">Recipient email</span>
          <input
            type="email"
            value={recipientEmail}
            onChange={(event) => onRecipientEmail(event.target.value)}
            className="h-12 w-full rounded-md border border-[#9B9B96] bg-white px-3 text-base font-semibold text-slate-950 outline-none transition focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40 sm:h-10 sm:text-sm"
            placeholder="name@example.com"
          />
        </label>
        <button
          type="button"
          onClick={onSend}
          disabled={disabled || state.status === "sending"}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#15284B] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45 sm:h-10"
        >
          <Mail className="h-4 w-4" /> {state.status === "sending" ? "Sending..." : "Send email"}
        </button>
        <button type="button" onClick={onCancel} className="inline-flex h-11 items-center justify-center rounded-md border border-[#D6D6D2] bg-white px-4 text-sm font-black text-[#15284B] sm:h-10">
          Close
        </button>
      </div>
      {state.message ? (
        <p
          className={cx(
            "mt-3 rounded-md border px-3 py-2 text-base font-bold leading-7 sm:text-sm sm:leading-6",
            state.status === "sent" ? "border-[#7DCAC2] bg-[#7DCAC2]/15 text-[#15284B]" : state.status === "error" ? "border-[#BD4830] bg-[#BD4830]/10 text-[#15284B]" : "border-[#D6D6D2] bg-[#F6F6F5] text-[#294782]",
          )}
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

function GuidedStart({
  mode,
  privateMode,
  localResume,
  blankRows,
  onMode,
  onPrivateMode,
  onLocalResume,
  onBlankRows,
  onPrintBlank,
  onPrintFull,
  onStart,
}: {
  mode: ExperienceMode;
  privateMode: boolean;
  localResume: boolean;
  blankRows: number;
  onMode: (mode: ExperienceMode) => void;
  onPrivateMode: (value: boolean) => void;
  onLocalResume: (value: boolean) => void;
  onBlankRows: (value: number) => void;
  onPrintBlank: () => void;
  onPrintFull: () => void;
  onStart: () => void;
}) {
  const [page, setPage] = useState(0);

  return (
    <div className="min-h-screen bg-[#F6F6F5] text-[#15284B]">
      <main className="mx-auto w-full max-w-5xl px-2 py-3 sm:px-5 sm:py-8">
        <div className="mb-5 flex items-center gap-3 sm:mb-8 sm:gap-4">
          <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-md border border-[#D6D6D2] bg-white p-2 shadow-sm sm:h-20 sm:w-16">
            <img src="/ficm.svg" alt="Freedom in Christ Ministries" className="h-full w-auto" />
          </div>
          <div>
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">Steps to Freedom in Christ</div>
            <h1 className="mt-1 text-2xl font-black sm:text-3xl md:text-5xl">Begin gently</h1>
          </div>
        </div>

        <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-6">
          {page === 0 ? (
            <div className="space-y-5">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">1 of 3</div>
              <h2 className="text-2xl font-black sm:text-3xl">What this is</h2>
              <div className="space-y-3 text-[17px] font-semibold leading-8 text-[#15284B] sm:text-base sm:text-slate-700">
                <p>This is a guided way to move through Neil Anderson’s Steps to Freedom in Christ. The app keeps the sequence and prayers intact while helping with checklists, blanks, printing, and optional prayer drafts.</p>
                <p>Some parts may touch painful memories, sin patterns, forgiveness, or spiritual history. You can pause at any time, skip what you are not ready to face, and continue with a trusted helper when needed.</p>
                <p>Your entries stay in this browser unless you choose to print, export, send by email, or save them on this device.</p>
              </div>
            </div>
          ) : null}

          {page === 1 ? (
            <div className="space-y-5">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">2 of 3</div>
              <h2 className="text-2xl font-black sm:text-3xl">Choose your path</h2>
              <p className="text-[17px] font-semibold leading-8 text-[#15284B] sm:text-base sm:text-slate-700">Pick the way that fits the person and setting today. You can change this later.</p>
              <ModeChooser mode={mode} onMode={onMode} />
              {mode === "printable" ? (
                <div className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] p-3 sm:p-4">
                  <label className="mb-3 block space-y-1">
                    <span className="text-xs font-black uppercase tracking-[0.12em] text-[#294782]">Blank rows per prayer template</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={blankRows}
                      onChange={(event) => onBlankRows(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                      className="h-10 w-24 rounded-md border border-[#D6D6D2] bg-white px-3 text-sm font-black text-[#15284B] outline-none focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={onPrintBlank} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#15284B] px-4 text-sm font-black text-white">
                      <Printer className="h-4 w-4" /> Print blank worksheet
                    </button>
                    <button type="button" onClick={onPrintFull} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#294782] px-4 text-sm font-black text-white">
                      <Printer className="h-4 w-4" /> Print full packet
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {page === 2 ? (
            <div className="space-y-5">
              <div className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">3 of 3</div>
              <h2 className="text-2xl font-black sm:text-3xl">Privacy and records</h2>
              <div className="space-y-3 text-[17px] font-semibold leading-8 text-[#15284B] sm:text-base sm:text-slate-700">
                <p>By default, this public page does not save to an account or server. Printing, exporting, and sending email create records outside the app.</p>
                <p>If you save on this device, progress can be resumed later in this same browser. Use Clear when you want the local record removed.</p>
              </div>
              <PrivacyControls privateMode={privateMode} localResume={localResume} onPrivateMode={onPrivateMode} onLocalResume={onLocalResume} />
              <p className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-2 text-base font-bold leading-7 text-[#294782] sm:px-4 sm:py-3 sm:text-sm sm:leading-6">Printed pages may contain sensitive personal material. Keep, share, or destroy them intentionally.</p>
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#D6D6D2] bg-white px-4 text-sm font-black text-[#15284B] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
            {page < 2 ? (
              <button type="button" onClick={() => setPage((current) => current + 1)} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#15284B] px-4 text-sm font-black text-white">
                Continue <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button type="button" onClick={onStart} className="inline-flex h-11 items-center gap-2 rounded-md bg-[#3B9189] px-5 text-sm font-black text-white">
                Start the Steps <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <FooterAttribution />
      </main>
    </div>
  );
}

function JourneyReviewPanel({
  prayers,
  blankRows,
  privateMode,
  onBlankRows,
  onEmail,
  onPrintFilled,
  onPrintBlank,
  onPrintFull,
  onPrintAftercare,
}: {
  prayers: JourneyPrayer[];
  blankRows: number;
  privateMode: boolean;
  onBlankRows: (value: number) => void;
  onEmail: () => void;
  onPrintFilled: () => void;
  onPrintBlank: () => void;
  onPrintFull: () => void;
  onPrintAftercare: () => void;
}) {
  const groups = groupJourneyPrayers(prayers);

  return (
    <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">Final journey</div>
          <h2 className="mt-1 text-2xl font-black text-[#15284B]">Entire journey prayers and declarations</h2>
          <p className="mt-1 text-base font-semibold leading-7 text-[#294782] sm:text-sm sm:leading-6 sm:text-slate-600">{prayers.length} individual items ready</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEmail}
            disabled={!prayers.length}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#294782] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Mail className="h-4 w-4" /> Email entire journey
          </button>
          <button
            type="button"
            onClick={onPrintFilled}
            disabled={!prayers.length}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-[#3B9189] px-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Printer className="h-4 w-4" /> Print filled
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-md border border-[#D6D6D2] bg-[#F6F6F5] p-3 sm:p-4">
        <label className="space-y-1">
          <span className="block text-xs font-black uppercase tracking-[0.12em] text-[#294782]">Blank rows per template</span>
          <input
            type="number"
            min={1}
            max={12}
            value={blankRows}
            onChange={(event) => onBlankRows(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
            className="h-10 w-24 rounded-md border border-[#D6D6D2] bg-white px-3 text-sm font-black text-[#15284B] outline-none focus:border-[#3B9189] focus:ring-2 focus:ring-[#7DCAC2]/40"
          />
        </label>
        <button type="button" onClick={onPrintBlank} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#15284B] px-4 text-sm font-black text-white">
          <Printer className="h-4 w-4" /> Print blank worksheet
        </button>
        <button type="button" onClick={onPrintFull} className="inline-flex h-10 items-center gap-2 rounded-md bg-[#294782] px-4 text-sm font-black text-white">
          <Printer className="h-4 w-4" /> Print full packet
        </button>
        <button type="button" onClick={onPrintAftercare} className="inline-flex h-10 items-center gap-2 rounded-md border border-[#D6D6D2] bg-white px-4 text-sm font-black text-[#15284B]">
          <Printer className="h-4 w-4" /> Print aftercare
        </button>
      </div>
      <p className="mb-5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Printed pages may contain sensitive personal material. Keep, share, or destroy them intentionally.</p>

      {prayers.length ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <details key={group.id} open className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] p-3">
              <summary className="cursor-pointer text-sm font-black text-[#15284B]">
                {group.label} <span className="font-bold text-slate-500">({group.prayers.length})</span>
              </summary>
              <div className="mt-3 space-y-3">
                {group.prayers.map((prayer, index) => (
                  <div key={`${prayer.stepLabel}-${prayer.promptTitle}-${prayer.item}-${index}`} className="border-t border-[#D6D6D2] pt-3 first:border-t-0 first:pt-0">
                    <h3 className="text-base font-black text-[#15284B]">{prayer.promptTitle}</h3>
                    <p className={cx("mt-1 text-sm font-black text-[#294782]", privateMode && "blur-sm transition hover:blur-none")}>{prayer.item}</p>
                    <p className={cx("mt-2 text-[17px] font-medium leading-8 text-[#15284B] sm:text-[15px] sm:font-normal sm:leading-7 sm:text-slate-700", privateMode && "blur-sm transition hover:blur-none")}>{prayer.body}</p>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold leading-6 text-slate-600">No journey prayers are ready yet.</p>
      )}
    </div>
  );
}

export function StepsExperience() {
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selected, setSelected] = useState<SelectedState>({});
  const [text, setText] = useState<TextState>({});
  const [forgiveness, setForgiveness] = useState<ForgivenessState>({
    forgiveness: [{ id: "initial-forgiveness-row", person: "", hurt: "" }],
  });
  const [completed, setCompleted] = useState<string[]>([]);
  const [generatedPrayers, setGeneratedPrayers] = useState<GeneratedPrayerState>({});
  const [blankRows, setBlankRows] = useState(3);
  const [mode, setMode] = useState<ExperienceMode>("digital");
  const [privateMode, setPrivateMode] = useState(false);
  const [localResume, setLocalResume] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailState, setEmailState] = useState<EmailSendState>({ status: "idle", message: "" });

  const active = stepsSections[activeIndex];
  const completedCount = completed.length;
  const ancestorEntries = getAncestorEntries(text);
  const ancestorDeclarationPrepared = !!generatedPrayers.ancestors && !!ancestorEntries.length;
  const filledOpeningDeclaration = fillOpeningDeclaration(openingDeclaration, participantName);
  const nextButtonLabel = active.id === "preparation" ? "Continue to Step 1" : "Next";
  const journeyPrayers = useMemo(() => buildJourneyPrayers(selected, text, forgiveness, generatedPrayers), [selected, text, forgiveness, generatedPrayers]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const session = JSON.parse(stored) as PersistedSession;
        setActiveIndex(Math.max(0, Math.min(stepsSections.length - 1, session.activeIndex ?? 0)));
        setSelected(session.selected ?? {});
        setText(session.text ?? {});
        setForgiveness(session.forgiveness ?? { forgiveness: [{ id: "initial-forgiveness-row", person: "", hurt: "" }] });
        setCompleted(session.completed ?? []);
        setGeneratedPrayers(session.generatedPrayers ?? {});
        setBlankRows(session.blankRows ?? 3);
        setMode(session.mode ?? "digital");
        setPrivateMode(!!session.privateMode);
        setParticipantName(session.participantName ?? "");
        setHasStarted(!!session.hasStarted);
        setLocalResume(true);
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    } finally {
      setSessionLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!sessionLoaded || !localResume) return;
    const session: PersistedSession = {
      hasStarted,
      activeIndex,
      selected,
      text,
      forgiveness,
      completed,
      generatedPrayers,
      blankRows,
      mode,
      privateMode,
      participantName,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [activeIndex, blankRows, completed, forgiveness, generatedPrayers, hasStarted, localResume, mode, participantName, privateMode, selected, sessionLoaded, text]);

  function toggleValue(promptId: string, value: string) {
    setSelected((current) => {
      const values = current[promptId] ?? [];
      return {
        ...current,
        [promptId]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
      };
    });
  }

  function markComplete(sectionId: string) {
    setCompleted((current) => (current.includes(sectionId) ? current.filter((id) => id !== sectionId) : [...current, sectionId]));
  }

  function createPrayer(promptId: string) {
    setGeneratedPrayers((current) => ({ ...current, [promptId]: true }));
  }

  function exportWorksheet() {
    const worksheet = buildExportText(selected, text, forgiveness, completed, generatedPrayers, participantName);
    const blob = new Blob([worksheet], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "steps-to-freedom-worksheet.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function openEmailPanel(target: EmailTarget) {
    setEmailTarget(target);
    setEmailState({ status: "idle", message: "" });
  }

  async function sendSystemEmail() {
    if (!emailTarget) return;
    const to = recipientEmail.trim();
    if (!to) {
      setEmailState({ status: "error", message: "Enter the recipient email address first." });
      return;
    }

    const payload =
      emailTarget === "journey"
        ? {
            to,
            kind: "journey" as const,
            prayers: journeyPrayers,
            worksheetText: buildJourneyEmailText(journeyPrayers),
          }
        : {
            to,
            kind: "created" as const,
            worksheetText: buildExportText(selected, text, forgiveness, completed, generatedPrayers, participantName),
          };

    setEmailState({ status: "sending", message: "Sending from yournamehere.vip..." });

    try {
      const response = await fetch(STEPS_EMAIL_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = "The email could not be sent. Please try again.";
        try {
          const data = (await response.json()) as { error?: { message?: string } };
          message = data.error?.message ?? message;
        } catch {
          // Keep the plain fallback message.
        }
        setEmailState({ status: "error", message });
        return;
      }

      setEmailState({ status: "sent", message: `Sent to ${to}.` });
    } catch {
      setEmailState({ status: "error", message: "The email service could not be reached. Please try again." });
    }
  }

  function printFilledJourney() {
    openPrintWindow("Steps to Freedom in Christ - Filled Prayers", buildFilledPrintContent(journeyPrayers));
  }

  function printBlankWorksheet() {
    openPrintWindow("Steps to Freedom in Christ - Blank Prayer Worksheet", buildBlankPrintContent(blankRows));
  }

  function printFullPacket() {
    openPrintWindow("Steps to Freedom in Christ - Full Packet", buildFullPacketPrintContent(blankRows, participantName));
  }

  function printAftercare() {
    openPrintWindow("Steps to Freedom in Christ - Aftercare and Affirmations", buildAftercarePrintContent());
  }

  function toggleLocalResume(value: boolean) {
    setLocalResume(value);
    if (!value) window.localStorage.removeItem(STORAGE_KEY);
  }

  function clearSession() {
    setSelected({});
    setText({});
    setForgiveness({ forgiveness: [{ id: "initial-forgiveness-row", person: "", hurt: "" }] });
    setCompleted([]);
    setGeneratedPrayers({});
    setBlankRows(3);
    setMode("digital");
    setPrivateMode(false);
    setParticipantName("");
    setEmailTarget(null);
    setRecipientEmail("");
    setEmailState({ status: "idle", message: "" });
    setLocalResume(false);
    setHasStarted(false);
    window.localStorage.removeItem(STORAGE_KEY);
    setActiveIndex(0);
  }

  if (!hasStarted) {
    return (
      <GuidedStart
        mode={mode}
        privateMode={privateMode}
        localResume={localResume}
        blankRows={blankRows}
        onMode={setMode}
        onPrivateMode={setPrivateMode}
        onLocalResume={toggleLocalResume}
        onBlankRows={setBlankRows}
        onPrintBlank={printBlankWorksheet}
        onPrintFull={printFullPacket}
        onStart={() => setHasStarted(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F6F5] text-[#15284B]">
      <header className="border-b border-[#D6D6D2] bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-3 py-4 sm:px-5 sm:py-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-md border border-[#D6D6D2] bg-white p-2 shadow-sm sm:h-20 sm:w-16">
              <img src="/ficm.svg" alt="Freedom in Christ Ministries" className="h-full w-auto" />
            </div>
            <div className="space-y-2">
              <div className="inline-flex items-center rounded-md border border-[#D6D6D2] bg-[#F6F6F5] px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-[#294782]">
                Steps to Freedom in Christ
              </div>
              <h1 className="text-2xl font-black leading-tight sm:text-3xl md:text-5xl">A guided rendering of the Steps</h1>
              <p className="max-w-3xl text-[15px] font-semibold leading-7 text-[#15284B] sm:text-base sm:text-slate-650">{lockedSourceRule}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-3 px-2 py-3 sm:gap-5 sm:px-5 sm:py-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3 sm:space-y-4 lg:sticky lg:top-5 lg:self-start">
          <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#15284B]">
              <ShieldCheck className="h-4 w-4 text-[#3B9189]" /> Public session
            </div>
            <p className="text-base font-semibold leading-7 text-[#15284B] sm:text-sm sm:font-normal sm:leading-6 sm:text-slate-600">
              {localResume ? "Entries are saved only in this browser on this device." : "Entries are held only in this browser session unless exported. No account saving is enabled on this public page."}
            </p>
          </div>

          <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-4">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[#3B9189]">Current step</div>
            <div className="mt-1 text-lg font-black text-[#15284B]">{active.title}</div>
            <div className="mt-1 text-sm font-bold text-slate-500">{active.eyebrow}</div>
          </div>

          <details className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm lg:hidden">
            <summary className="cursor-pointer text-sm font-black text-[#15284B]">Step list</summary>
            <nav className="mt-3 p-0" aria-label="Steps">
              {stepsSections.map((section, index) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={cx(
                    "mb-1 flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-black transition last:mb-0",
                    active.id === section.id ? "bg-[#15284B] text-white" : "text-[#15284B] hover:bg-[#F6F6F5]",
                  )}
                >
                  <span>
                    <span className={cx("block text-[10px] uppercase tracking-[0.12em]", active.id === section.id ? "text-[#7DCAC2]" : "text-[#3D66B9]")}>{section.eyebrow}</span>
                    {section.title}
                  </span>
                  {completed.includes(section.id) ? <Check className="h-4 w-4 text-[#7DCAC2]" /> : null}
                </button>
              ))}
            </nav>
          </details>

          <nav className="hidden rounded-md border border-[#D6D6D2] bg-white p-2 shadow-sm lg:block" aria-label="Steps">
            {stepsSections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cx(
                  "mb-1 flex w-full items-center justify-between rounded-md px-3 py-3 text-left text-sm font-black transition last:mb-0",
                  active.id === section.id ? "bg-[#15284B] text-white" : "text-[#15284B] hover:bg-[#F6F6F5]",
                )}
              >
                <span>
                  <span className={cx("block text-[10px] uppercase tracking-[0.12em]", active.id === section.id ? "text-[#7DCAC2]" : "text-[#3D66B9]")}>{section.eyebrow}</span>
                  {section.title}
                </span>
                {completed.includes(section.id) ? <Check className="h-4 w-4 text-[#7DCAC2]" /> : null}
              </button>
            ))}
          </nav>

          <div className="rounded-md border border-[#D6D6D2] bg-white p-3 text-base font-bold text-[#294782] shadow-sm sm:p-4 sm:text-sm sm:text-slate-600">
            {completedCount} of {stepsSections.length} marked complete
          </div>

          <SessionOptions mode={mode} privateMode={privateMode} localResume={localResume} onMode={setMode} onPrivateMode={setPrivateMode} onLocalResume={toggleLocalResume} />
          <SessionTools
            blankRows={blankRows}
            onBlankRows={setBlankRows}
            onExport={exportWorksheet}
            onEmailCreated={() => openEmailPanel("created")}
            onPrintBlank={printBlankWorksheet}
            onPrintFull={printFullPacket}
            onPrintAftercare={printAftercare}
            onClear={clearSession}
          />
          <FacilitatorPanel mode={mode} />
        </aside>

        <section className="space-y-5">
          {emailTarget ? (
            <EmailSendPanel
              target={emailTarget}
              recipientEmail={recipientEmail}
              state={emailState}
              disabled={emailTarget === "journey" && !journeyPrayers.length}
              onRecipientEmail={setRecipientEmail}
              onSend={sendSystemEmail}
              onCancel={() => setEmailTarget(null)}
            />
          ) : null}

          <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-[#3B9189]">{active.eyebrow}</div>
                <h2 className="mt-1 text-2xl font-black text-[#15284B] sm:text-3xl">{active.title}</h2>
                <p className="mt-1 text-sm font-bold text-slate-500">{active.sourcePages}</p>
              </div>
              <button
                type="button"
                onClick={() => markComplete(active.id)}
                className={cx(
                  "inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-black",
                  completed.includes(active.id) ? "bg-[#7DCAC2] text-[#15284B]" : "bg-[#15284B] text-white",
                )}
              >
                <Check className="h-4 w-4" /> {completed.includes(active.id) ? "Complete" : "Mark complete"}
              </button>
            </div>

            <div className="space-y-6">
              <StepBriefing sectionId={active.id} />

              {activeIndex === 0 ? (
                <div className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] p-3 sm:p-4">
                  <div className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-[#294782]">Before the steps</div>
                  <div className="space-y-6">
                    {openingSections.map((block) => (
                      <Reading key={block.title} block={block} />
                    ))}
                    <PrayerCard title="Prayer" body={openingPrayer} />
                    <OpeningDeclarationNameField value={participantName} onChange={setParticipantName} privateMode={privateMode} />
                    <PrayerCard title="Declaration" body={filledOpeningDeclaration} privateMode={privateMode} />
                  </div>
                </div>
              ) : null}

              {active.readings.map((block, index) => (
                <Reading key={`${active.id}-reading-${index}`} block={block} />
              ))}

              {active.openingPrayer ? <PrayerCard title="Prayer" body={active.openingPrayer} /> : null}

              <div className="space-y-7">
                {active.prompts.map((prompt) => {
                  if (prompt.kind === "checklist") {
                    return (
                      <ChecklistPromptView
                        key={prompt.id}
                        prompt={prompt}
                        selected={selected[prompt.id] ?? []}
                        customText={text[`${prompt.id}:custom`] ?? ""}
                        prayerCreated={!!generatedPrayers[prompt.id]}
                        onToggle={(value) => toggleValue(prompt.id, value)}
                        onCustomText={(value) => setText((current) => ({ ...current, [`${prompt.id}:custom`]: value }))}
                        onCreatePrayer={() => createPrayer(prompt.id)}
                        privateMode={privateMode}
                      />
                    );
                  }
                  if (prompt.kind === "forgiveness") {
                    return (
                      <ForgivenessPromptView
                        key={prompt.id}
                        prompt={prompt}
                        rows={forgiveness[prompt.id] ?? []}
                        prayerCreated={!!generatedPrayers[prompt.id]}
                        onRows={(rows) => setForgiveness((current) => ({ ...current, [prompt.id]: rows }))}
                        onCreatePrayer={() => createPrayer(prompt.id)}
                        privateMode={privateMode}
                      />
                    );
                  }
                  return (
                    <FreeformPromptView
                      key={prompt.id}
                      prompt={prompt}
                      value={text[prompt.id] ?? ""}
                      prayerCreated={!!generatedPrayers[prompt.id]}
                      onChange={(value) => setText((current) => ({ ...current, [prompt.id]: value }))}
                      onCreatePrayer={() => createPrayer(prompt.id)}
                      privateMode={privateMode}
                    />
                  );
                })}
              </div>

              {active.id === "preparation" ? (
                <PreparationBridge familyHistory={selected["family-history"] ?? []} personalHistory={selected["personal-history"] ?? []} onContinue={() => setActiveIndex(1)} />
              ) : null}

              {active.declarations?.map((block) => (
                <div key={`${active.id}-${block.title}`} className="rounded-md border border-[#D6D6D2] bg-[#F6F6F5] p-3 sm:p-4">
                  <Reading block={active.id === "step-7" ? applyAncestorDeclarationBlock(block, ancestorEntries, ancestorDeclarationPrepared) : block} />
                </div>
              ))}

              {active.closingPrayer ? <PrayerCard title="Prayer" body={active.closingPrayer} /> : null}
            </div>
          </div>

          {activeIndex === stepsSections.length - 1 ? (
            <>
              <JourneyReviewPanel
                prayers={journeyPrayers}
                blankRows={blankRows}
                privateMode={privateMode}
                onBlankRows={setBlankRows}
                onEmail={() => openEmailPanel("journey")}
                onPrintFilled={printFilledJourney}
                onPrintBlank={printBlankWorksheet}
                onPrintFull={printFullPacket}
                onPrintAftercare={printAftercare}
              />

              <div className="rounded-md border border-[#D6D6D2] bg-white p-3 shadow-sm sm:p-5">
                <h2 className="mb-5 text-2xl font-black text-[#15284B]">Aftercare</h2>
                <div className="space-y-6">
                  {aftercareSections.map((block) => (
                    <Reading key={block.title} block={block} />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div className="sticky bottom-0 z-20 -mx-2 flex items-center justify-between gap-3 border-t border-[#D6D6D2] bg-[#F6F6F5]/95 px-2 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-0">
            <button
              type="button"
              disabled={activeIndex === 0}
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
              className="inline-flex h-11 items-center gap-2 rounded-md border border-[#D6D6D2] bg-white px-4 text-sm font-black text-[#15284B] disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>
            <button
              type="button"
              disabled={activeIndex === stepsSections.length - 1}
              onClick={() => setActiveIndex((index) => Math.min(stepsSections.length - 1, index + 1))}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#15284B] px-4 text-sm font-black text-white disabled:opacity-40"
            >
              {nextButtonLabel} <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <FooterAttribution />
        </section>
      </main>
    </div>
  );
}
