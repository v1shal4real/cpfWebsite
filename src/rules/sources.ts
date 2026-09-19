/**
 * The source registry.
 *
 * Every figure this tool renders is traceable to one of these entries, and
 * every entry points at a page a user can open and check. Nothing in the rule
 * sets carries a value without a `sourceId` pointing here.
 *
 * One entry per page, not per topic. Where a group of figures is split across
 * pages — the retirement sums are published on three — each figure cites the
 * page that actually states it, via `fieldSources` on its rule-set group.
 * A link that opens a page without the number on it does not count as a
 * source.
 *
 * `retrievedOn` is the date the figure was last read off the page, not the date
 * the page was published. When a figure is re-checked and unchanged, bump
 * `retrievedOn`; when it changes, add a new dated rule set rather than editing
 * the old one in place.
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
  /* Contributions ------------------------------------------------------- */

  contributionRates: {
    id: 'contributionRates',
    title: 'How much CPF contributions to pay',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/employer/employer-obligations/how-much-cpf-contributions-to-pay',
    retrievedOn: '2026-09-19',
  },
  ordinaryWageCeiling: {
    id: 'ordinaryWageCeiling',
    title: 'What is the Ordinary Wage (OW) ceiling?',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/service/article/what-is-the-ordinary-wage-ow-ceiling',
    retrievedOn: '2026-09-14',
  },
  annualLimit: {
    id: 'annualLimit',
    title: 'What is the CPF Annual Limit?',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/service/article/what-is-the-cpf-annual-limit',
    retrievedOn: '2026-09-14',
  },
  allocationRates: {
    id: 'allocationRates',
    title: 'CPF Allocation Rates from 1 January 2026',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/content/dam/web/employer/employer-obligations/documents/CPFAllocationRatesfromJanuary2026.pdf',
    retrievedOn: '2026-09-14',
  },

  /* Interest ------------------------------------------------------------ */

  interestRates: {
    id: 'interestRates',
    title: 'Earning CPF interest',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/growing-your-savings/earning-higher-returns/earning-attractive-interest',
    retrievedOn: '2026-09-14',
  },
  interestComputation: {
    id: 'interestComputation',
    title: 'How is my CPF interest computed and credited into my accounts?',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/service/article/how-is-my-cpf-interest-computed-and-credited-into-my-accounts',
    retrievedOn: '2026-09-14',
  },
  /**
   * The dated release for the first quarter of 2026. It is the only page that
   * states both the 2026 Basic Healthcare Sum and the HDB concessionary rate
   * in force on 1 January 2026, which is why two unrelated groups cite it.
   */
  newsRelease2026Q1: {
    id: 'newsRelease2026Q1',
    title: 'CPF interest rates from 1 January to 31 March 2026 and Basic Healthcare Sum for 2026',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/infohub/news/news-releases/cpf-interest-rates-from-1-january-to-31-march-2026-and-basic-healthcare-sum-for-2026',
    retrievedOn: '2026-09-14',
  },

  /* Retirement sums ----------------------------------------------------- */

  basicRetirementSum: {
    id: 'basicRetirementSum',
    title: 'How much is my Basic Retirement Sum?',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/service/article/how-much-is-my-basic-retirement-sum',
    retrievedOn: '2026-09-14',
  },
  fullRetirementSum: {
    id: 'fullRetirementSum',
    title: 'How much is my Full Retirement Sum?',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/service/article/how-much-is-my-full-retirement-sum',
    retrievedOn: '2026-09-14',
  },
  enhancedRetirementSum: {
    id: 'enhancedRetirementSum',
    title: 'What is the current Enhanced Retirement Sum?',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/service/article/what-is-the-current-enhanced-retirement-sum',
    retrievedOn: '2026-09-14',
  },

  /* Housing ------------------------------------------------------------- */

  housing: {
    id: 'housing',
    title: 'Using your CPF to buy a home',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/home-ownership/using-your-cpf-to-buy-a-home',
    retrievedOn: '2026-09-14',
  },
  housingAccruedInterest: {
    id: 'housingAccruedInterest',
    title:
      'Why do I need to refund the accrued interest on the amount of CPF savings used for my property?',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/service/article/why-do-i-need-to-refund-the-accrued-interest-on-the-amount-of-cpf-savings-used-for-my-property',
    retrievedOn: '2026-09-14',
  },
  housingLoanRetention: {
    id: 'housingLoanRetention',
    title: 'Retain $20,000 in your Ordinary Account if you are taking a housing loan',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/home-ownership/using-your-cpf-to-buy-a-home/retain-20000-in-your-oa-if-you-are-taking-a-housing-loan',
    retrievedOn: '2026-09-14',
  },
  housingRefund: {
    id: 'housingRefund',
    title: 'CPF refund when selling or transferring property',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/member/home-ownership/using-your-cpf-to-buy-a-home/cpf-refund-when-selling-or-transferring-property',
    retrievedOn: '2026-09-14',
  },

  /* Scheduled changes --------------------------------------------------- */

  changes2027: {
    id: 'changes2027',
    title: 'CPF Contribution Changes from 1 January 2027',
    publisher: 'CPF Board',
    url: 'https://www.cpf.gov.sg/employer/infohub/news/cpf-related-announcements/new-contribution-rates',
    retrievedOn: '2026-09-14',
  },
} as const satisfies Record<string, Source>;

export type SourceId = keyof typeof SOURCES;

export function source(id: SourceId): Source {
  return SOURCES[id];
}
