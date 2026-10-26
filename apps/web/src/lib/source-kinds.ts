// Career-board kinds and their labels, kept apart from job-sources.ts so client components can
// import them without bundling the fetchers.
export const SOURCE_KINDS = ["greenhouse", "lever", "ashby", "smartrecruiters", "workable", "recruitee"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
export const SOURCE_LABEL: Record<SourceKind, string> = {
  greenhouse: "Greenhouse",
  lever: "Lever",
  ashby: "Ashby",
  smartrecruiters: "SmartRecruiters",
  workable: "Workable",
  recruitee: "Recruitee",
};
export const MAX_TITLE_EXCLUDE = 30;
