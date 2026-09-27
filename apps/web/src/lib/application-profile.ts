import { z } from "zod";
import type { ApplicantFacts } from "./autofill";
import type { SearchProfile } from "./onboarding";

// The facts application forms ask for, typed once in Settings → Applications.
const text = (max: number) => z.string().trim().max(max).nullable().transform((s) => s || null);
const link = z
  .string()
  .trim()
  .max(300)
  .nullable()
  .transform((s) => (s && !/^https?:\/\//i.test(s) ? `https://${s}` : s) || null)
  .pipe(z.string().url("Enter a full link, like https://…").nullable());

export const applicationProfileSchema = z.object({
  first_name: text(100),
  last_name: text(100),
  preferred_name: text(100),
  email: z.string().trim().max(200).nullable().transform((s) => s || null).pipe(z.string().email("Enter a valid email").nullable()),
  phone: text(40),
  city: text(100),
  region: text(100),
  country: text(100),
  postal_code: text(20),
  linkedin_url: link,
  website_url: link,
  github_url: link,
  portfolio_url: link,
  current_company: text(200),
  current_title: text(200),
  years_experience: z.number().int().min(0).max(60).nullable(),
  authorized_countries: z.array(z.string().trim().min(1).max(80)).max(10),
  how_heard: text(100),
});

export type ApplicationProfileInput = z.input<typeof applicationProfileSchema>;
export type ApplicationProfile = z.output<typeof applicationProfileSchema>;

export const APPLICATION_PROFILE_COLUMNS =
  "first_name, last_name, preferred_name, email, phone, city, region, country, postal_code, linkedin_url, website_url, github_url, portfolio_url, current_company, current_title, years_experience, authorized_countries, how_heard";

export const EMPTY_APPLICATION_PROFILE: ApplicationProfile = {
  first_name: null,
  last_name: null,
  preferred_name: null,
  email: null,
  phone: null,
  city: null,
  region: null,
  country: null,
  postal_code: null,
  linkedin_url: null,
  website_url: null,
  github_url: null,
  portfolio_url: null,
  current_company: null,
  current_title: null,
  years_experience: null,
  authorized_countries: [],
  how_heard: null,
};

// Sensible starting values from what the user already told us.
export function suggestedApplicationProfile(fullName: string | null, email: string | null): ApplicationProfile {
  const [first, ...rest] = (fullName ?? "").trim().split(/\s+/);
  return { ...EMPTY_APPLICATION_PROFILE, first_name: first || null, last_name: rest.join(" ") || null, email, how_heard: "LinkedIn" };
}

export function toApplicantFacts(p: ApplicationProfile, search: SearchProfile): ApplicantFacts {
  const salary =
    search.salary_min != null || search.salary_target != null
      ? search.salary_target != null
        ? `${search.salary_target} ${search.salary_currency}`
        : `${search.salary_min} ${search.salary_currency}`
      : null;
  return {
    firstName: p.first_name,
    lastName: p.last_name,
    preferredName: p.preferred_name,
    email: p.email,
    phone: p.phone,
    city: p.city,
    region: p.region,
    country: p.country,
    postalCode: p.postal_code,
    linkedinUrl: p.linkedin_url,
    websiteUrl: p.website_url,
    githubUrl: p.github_url,
    portfolioUrl: p.portfolio_url,
    currentCompany: p.current_company,
    currentTitle: p.current_title,
    yearsExperience: p.years_experience,
    authorizedCountries: p.authorized_countries,
    needsSponsorship: search.needs_sponsorship,
    openToRelocate: search.open_to_relocate,
    salary,
    noticePeriod: search.notice_period ?? null,
    howHeard: p.how_heard,
  };
}
