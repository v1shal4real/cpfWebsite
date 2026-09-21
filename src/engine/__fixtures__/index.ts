/**
 * CPF Board's own worked examples, as test fixtures for the engine.
 *
 * Success criterion §1.4: the engine reproduces these exactly. They were
 * collected before the engine exists so the tests drive it, not the reverse.
 *
 * Fixtures come in two kinds, and the difference matters when one fails:
 *
 *   - Transcribed. The figure is CPF Board's own, copied from the page cited.
 *     Contributions and allocation are all of this kind. If the engine
 *     disagrees with one, the engine is wrong.
 *   - Derived, marked `derived: true`. CPF Board publishes the rule but no
 *     worked example, so the figure is computed here from the quoted rule
 *     text. Interest and accrued housing interest are all of this kind. If the
 *     engine disagrees with one, either the engine or this project's reading
 *     of the rule is wrong, and the reading is worth re-checking first.
 *
 * Deriving a fixture is a departure from success criterion §1.4, which asks
 * for CPF Board's own examples. It was taken deliberately on 20 September 2026
 * rather than leave the interest and housing engine work unable to start.
 * Derived fixtures are provisional: if CPF Board publishes or supplies a
 * worked example, replace them rather than reconcile them.
 *
 * Pages checked for worked examples, and found to have none: `interestRates`,
 * `interestComputation`, `extraInterest`, `housingAccruedInterest`,
 * `ordinaryWageCeiling`, `contributionRates`, the CPF Board articles "How do
 * your CPF savings work for you?", "3 reasons why you should consider making a
 * voluntary housing refund", "What happens to the sales proceeds after selling
 * your home" and "Selling your home: before vs after age 55", HDB's resale
 * pages, and the Ministry of Manpower's parliamentary answers on CPF interest
 * computation of 9 January 2023 and 7 February 2024. Figures published by
 * third-party sites were not used.
 *
 * TODO: allocation rounding has neither a worked example nor a stated rule, so
 * it is not covered either way. CPF Board states the allocation order and the
 * ratios but not how a share that falls between cents is rounded. Do not
 * derive one: ask CPF Board.
 */

export { ALLOCATION_FIXTURES } from './allocation';
export { CONTRIBUTION_FIXTURES } from './contributions';
export { HOUSING_ACCRUED_INTEREST_FIXTURES } from './housing';
export { BASE_INTEREST_FIXTURES, EXTRA_INTEREST_FIXTURES } from './interest';
export type * from './types';
