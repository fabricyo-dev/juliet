'use strict';

const DEFAULT_ACTIVITIES = [
  { id: 'cs50', name: 'CS50x — next lecture / problem set', url: 'https://cs50.harvard.edu/x/' },
  { id: 'leetcode', name: 'LeetCode daily problem', url: 'https://leetcode.com/problemset/' },
  { id: 'github', name: 'Push a commit to your GitHub project', url: 'https://github.com/' },
  { id: 'fcc', name: 'freeCodeCamp — one lesson', url: 'https://www.freecodecamp.org/learn/' },
  { id: 'usaco', name: 'USACO Guide — one module', url: 'https://usaco.guide/' },
  { id: 'aoc', name: 'Advent of Code — one puzzle', url: 'https://adventofcode.com/' },
  { id: 'codeforces', name: 'Codeforces — one problem', url: 'https://codeforces.com/problemset' },
  { id: 'kaggle', name: 'Kaggle Learn — one lesson', url: 'https://www.kaggle.com/learn' },
  { id: 'devpost', name: 'Devpost — check upcoming hackathons', url: 'https://devpost.com/hackathons' },
  { id: 'ocw1806', name: 'MIT OCW 18.06 Linear Algebra — one lecture', url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/' },
  { id: 'arxiv', name: 'arXiv cs.LG — read one abstract', url: 'https://arxiv.org/list/cs.LG/new' },
  { id: '3b1b', name: '3Blue1Brown — one video', url: 'https://www.3blue1brown.com/' },
  { id: 'euler', name: 'Project Euler — one problem', url: 'https://projecteuler.net/archives' },
  { id: 'gwc', name: 'Girls Who Code — check clubs / events', url: 'https://girlswhocode.com/' },
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
  launchAtLogin: true,
  presenceIdleSeconds: 300,
};

const PLACEHOLDER_MOVIES = ['Paste your watch-list here, one per line', 'e.g. The Social Network'];

function defaultState() {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    activities: DEFAULT_ACTIVITIES.map((a) => ({ ...a })),
    movies: { unseen: [...PLACEHOLDER_MOVIES], seen: [] },
    history: [],
    schedule: { planDate: null, slots: [], fired: [], snoozed: [], recent: [], movieNextAt: null, recapNextAt: null, quietUntil: null },
  };
}

module.exports = { DEFAULT_ACTIVITIES, DEFAULT_SETTINGS, PLACEHOLDER_MOVIES, defaultState };
