/**
 * The source registry.
 *
 * Every figure this tool renders is traceable to one of these entries, and
 * every entry points at a page a user can open and check. Nothing in the rule
 * sets carries a value without a `sourceId` pointing here.
 *
 * Every URL and figure below is transcribed from the build specification and is
 * marked unverified until someone opens the page and confirms it. Section 6 of
 * the spec is the checklist; `RULE_SET.verified` stays `false` until it is done,
 * and the interface says so where a user can see it.
 *
 * `retrievedOn` is the date the figure was last transcribed from the page, not
 * the date the page was published. When a figure is re-checked and unchanged,
 * bump `retrievedOn`; when it changes, add a new dated rule set rather than
 * editing the old one in place.
 */

export interface Source {
  id: string;
  /** Title as it appears on the page, so a user can confirm they landed right. */
  title: string;
  publisher: 'CPF Board' | 'Ministry of Health' | 'HDB';
  url: string;
  /** ISO date this tool last read the figure off the page. */
  retrievedOn: string;
}

export const SOURCES = {
  contributionRates: {
    id: 'contributionRates',
    title: 'How much CPF contributions to pay',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay',
    retrievedOn: '2026-01-01',
  },
  allocationRates: {
    id: 'allocationRates',
    title: 'CPF Allocation Rates from 1 January 2026',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay/cpf-allocation-rates',
    retrievedOn: '2026-01-01',
  },
  interestRates: {
    id: 'interestRates',
    title: 'Earning attractive interest',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/growing-your-savings/earning-attractive-interest',
    retrievedOn: '2026-01-01',
  },
  basicHealthcareSum: {
    id: 'basicHealthcareSum',
    title: 'Basic Healthcare Sum',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/healthcare-financing/using-your-medisave-savings/basic-healthcare-sum',
    retrievedOn: '2026-01-01',
  },
  retirementSums: {
    id: 'retirementSums',
    title: 'CPF retirement sums',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/retirement-income/retirement-withdrawals/cpf-retirement-sums',
    retrievedOn: '2026-01-01',
  },
  housing: {
    id: 'housing',
    title: 'Using your CPF to buy a home',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/home-ownership/using-your-cpf-to-buy-a-home',
    retrievedOn: '2026-01-01',
  },
  housingRefund: {
    id: 'housingRefund',
    title: 'CPF refund when selling or transferring your property',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/home-ownership/selling-your-home',
    retrievedOn: '2026-01-01',
  },
  changes2027: {
    id: 'changes2027',
    title: 'CPF contribution changes from 1 January 2027',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/infohub/educational-resources/cpf-changes-2027',
    retrievedOn: '2026-01-01',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export function source(id: SourceId): Source {
  return SOURCES[id];
}
