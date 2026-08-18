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
  checkinPerWeek: 2, // "How's today going?" (0–7)
  strollPerWeek: 2, // silent cameo walks, no bubble (0–7)
  morningEnabled: true, // a hello the first time she's at the Mac each day
  goodnightEnabled: false, // one soft "it's late" ~90 min after active hours end
  phoneEnabled: false,     // ping her iPhone (via ntfy) when something is due while she's away from the Mac
  phoneTopic: null,        // generated the first time phone pings are switched on
  phoneServer: 'https://ntfy.sh',
  launchAtLogin: true,
  presenceIdleSeconds: 300,
};

// What Juliet says when she shows up just to cheer Areej on (no task attached).
// The first PEP_MIRZA_COUNT lines are Mirza's own words — she says one of those most of the time.
const PEP_LINES = [
  "Stop overthinking — you've got this. You are the smartest, most talented, well-spoken person I know.",
  "You've got this. You're literally the smarter, prettier version of Tate McRae.",
  "People write poems about you. Stop second-guessing yourself.",
  "Well-spoken like Mamdani, pretty like Tate McRae.",
  "AI could never replace a diva like you. Not even in coding.",
  "You deserve to go shopping every day.",
  "If coffee and a library full of cats were a person, they'd be you.",
  "Let me know if you ever need to open a door with a key.",
  "Don't forget to switch off the lights in the electric car room.",
  "You've got this, bonita.",
  "Don't drop your jewellery — it's hard to find. And even though it shines, it doesn't shine as bright as you.",
  "You should be the prime minister of the world.",
  "AI (Areej Intelligence) for the win.",
  "I should have given you that Funko Pop.",
  "You're as perfect as the Apple ecosystem.",
  "You go, best pianist ever.",
  "No cat would ever scratch you on purpose.",
  "Free Palestine, meow!",
  "You're a better writer than Sylvia Plath.",
  "Linguini is me.",
  "You're like Barbie — you can do anything.",
  "At least you're not a man. (I can't believe I wrote that.)",
  "Don't give up on men, though. In the end, I'm one.",
  "You are the smartest, most talented, well-spoken person in any room. Stop overthinking and go.",
  "Quick reminder from your cat: you've got this. Smartest, most talented, best-spoken — that's you.",
  "Overthinking is just talent with nowhere to go. Point it at one thing and start.",
  "Whatever you're second-guessing: you already know. You always do.",
  "You've talked your way through harder rooms than this one. Go be brilliant.",
  "The version of you that's worried and the version that's brilliant are the same person. Send the brilliant one.",
  "Deep breath. Smartest person you know is reading this.",
];
const PEP_MIRZA_COUNT = 23;

const MORNING_LINES = [
  'Coffee first. Then one small thing.',
  "New day. I'll come by later.",
  'Sleep okay? Take it easy today.',
  "Morning. No rush — I'm around.",
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
    ratings: [],       // {value 1–10, at}
    moods: [],         // {value 'rough'|'okay'|'great', at}
    favourites: [],    // {title, at} — movies she loved
    schedule: { planDate: null, slots: [], fired: [], snoozed: [], recent: [], movieNextAt: null, recapNextAt: null, quietUntil: null, pepAt: null, pepFired: false, checkinAt: null, checkinFired: false, strollAt: null, strollFired: false, morningDate: null, followup: null, goodnightDate: null },
  };
}

module.exports = { DEFAULT_ACTIVITIES, DEFAULT_SETTINGS, PLACEHOLDER_MOVIES, PEP_LINES, PEP_MIRZA_COUNT, MORNING_LINES, defaultState };
