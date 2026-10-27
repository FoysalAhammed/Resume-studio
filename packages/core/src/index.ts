/**
 * @careerlens/core - the framework-agnostic domain layer.
 *
 * Everything exported here is pure TypeScript: it runs unchanged in the browser,
 * in the Node API and in the unit tests. No DOM, no network, no randomness.
 */

export * from './types';
export * from './constants';
export * from './schemas';
export * from './util/text';
export * from './skills/lexicon';
export * from './skills/graph';
export * from './jobs/extract';
export * from './matching/engine';
export * from './gap/analyze';
export * from './roadmap/templates';
export * from './roadmap/generate';
export * from './resume/validate';
export * from './resume/parse';
export * from './writing/improve';
export * from './writing/coverLetter';
export * from './interview/generate';
export * from './sample/workspace';
export * from './profile/completeness';
