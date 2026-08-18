'use strict';

const DEFAULT_ACTIVITIES = [
  { id: 'cs50', name: 'CS50x — next lecture / problem set', url: 'https://cs50.harvard.edu/x/' },
  { id: 'leetcode', easy: true, name: 'LeetCode daily problem', url: 'https://leetcode.com/problemset/' },
  { id: 'github', name: 'Push a commit to your GitHub project', url: 'https://github.com/' },
  { id: 'fcc', name: 'freeCodeCamp — one lesson', url: 'https://www.freecodecamp.org/learn/' },
  { id: 'usaco', name: 'USACO Guide — one module', url: 'https://usaco.guide/' },
  { id: 'aoc', name: 'Advent of Code — one puzzle', url: 'https://adventofcode.com/' },
  { id: 'codeforces', name: 'Codeforces — one problem', url: 'https://codeforces.com/problemset' },
  { id: 'kaggle', name: 'Kaggle Learn — one lesson', url: 'https://www.kaggle.com/learn' },
  { id: 'devpost', easy: true, name: 'Devpost — check upcoming hackathons', url: 'https://devpost.com/hackathons' },
  { id: 'ocw1806', name: 'MIT OCW 18.06 Linear Algebra — one lecture', url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/' },
  { id: 'arxiv', easy: true, name: 'arXiv cs.LG — read one abstract', url: 'https://arxiv.org/list/cs.LG/new' },
  { id: '3b1b', easy: true, name: '3Blue1Brown — one video', url: 'https://www.3blue1brown.com/' },
  { id: 'euler', easy: true, name: 'Project Euler — one problem', url: 'https://projecteuler.net/archives' },
  { id: 'gwc', easy: true, name: 'Girls Who Code — check clubs / events', url: 'https://girlswhocode.com/' },
  { id: 'club', name: 'Coding club: message the group / plan a session', url: 'https://mail.google.com/' },
  { id: 'tutor', name: 'Tutor someone for 30 min (Khan Academy)', url: 'https://www.khanacademy.org/computing' },
].map((a) => ({ ...a, enabled: true }));

const DEFAULT_SETTINGS = {
  nudgesPerDay: 3,
  activeStart: '09:00',
  activeEnd: '22:00',
  movieDay: 5, // 0 = Sunday … 6 = Saturday
  movieTime: '19:00',
  recapEnabled: true,
  recapDay: 0, // Sunday
  recapTime: '18:00',
  pepPerWeek: 3, // unprompted pep talks (0–7)
  goodnightEnabled: false, // one soft "it's late" ~90 min after active hours end
  launchAtLogin: true,
  presenceIdleSeconds: 300,
};

// What Juliet says when she shows up just to cheer Areej on (no task attached). Mirza's line first.
const PEP_LINES = [
  "Stop overthinking — you've got this. You are the smartest, most talented, well-spoken person I know.",
  "You are the smartest, most talented, well-spoken person in any room. Stop overthinking and go.",
  "Quick reminder from your cat: you've got this. Smartest, most talented, best-spoken — that's you.",
];

const PLACEHOLDER_MOVIES = ['Paste your watch-list here, one per line', 'e.g. The Social Network'];

function defaultState() {
  return {
    version: 1,
    welcomed: false,   // first-launch hello not shown yet
    firstRunAt: null,  // set on first launch; used to tell "brand new" from "been away"
    settings: { ...DEFAULT_SETTINGS },
    activities: DEFAULT_ACTIVITIES.map((a) => ({ ...a })),
    movies: { unseen: [...PLACEHOLDER_MOVIES], seen: [] },
    history: [],
    schedule: { planDate: null, slots: [], fired: [], snoozed: [], recent: [], movieNextAt: null, recapNextAt: null, quietUntil: null, pepAt: null, pepFired: false, goodnightDate: null },
  };
}

module.exports = { DEFAULT_ACTIVITIES, DEFAULT_SETTINGS, PLACEHOLDER_MOVIES, PEP_LINES, defaultState };
