'use strict';

// Built around what an Ivy CS application actually rewards: one flagship BUILD, real COMPETE/RESEARCH
// depth, LEADERSHIP with numbers, and a running LOG so it can all be written down later.
const DEFAULT_ACTIVITIES = [
  // build
  { id: 'flagship', name: 'Flagship project — 25 minutes on it', url: 'https://github.com/' },
  { id: 'devlog', easy: true, name: 'Dev log — 5 lines on what you built this week', url: 'https://github.com/' },
  { id: 'ship', name: 'Ship something small (deploy, README, demo video)', url: 'https://github.com/' },
  // compete
  { id: 'usaco', name: 'USACO Guide — one module', url: 'https://usaco.guide/' },
  { id: 'codeforces', name: 'Codeforces — one problem', url: 'https://codeforces.com/problemset' },
  { id: 'leetcode', easy: true, name: 'LeetCode daily problem', url: 'https://leetcode.com/problemset/' },
  { id: 'aoc', name: 'Advent of Code — one puzzle', url: 'https://adventofcode.com/' },
  { id: 'kaggle', name: 'Kaggle Learn — one lesson', url: 'https://www.kaggle.com/learn' },
  // research
  { id: 'arxiv', easy: true, name: 'arXiv cs.LG — read one abstract, note one idea', url: 'https://arxiv.org/list/cs.LG/new' },
  { id: 'prof', name: 'Email one professor about research (NYUAD / AUS / Khalifa)', url: 'https://mail.google.com/' },
  { id: 'ocw1806', name: 'MIT OCW 18.06 Linear Algebra — one lecture', url: 'https://ocw.mit.edu/courses/18-06-linear-algebra-spring-2010/' },
  { id: '3b1b', easy: true, name: '3Blue1Brown — one video', url: 'https://www.3blue1brown.com/' },
  { id: 'cs50', name: 'CS50x — next lecture / problem set', url: 'https://cs50.harvard.edu/x/' },
  // math (she wants to major in it too): contests are the currency, proofs are the craft
  { id: 'amc', name: 'AMC 10/12 — one past-paper section (AoPS archive)', url: 'https://artofproblemsolving.com/wiki/index.php/AMC_Problems_and_Solutions' },
  { id: 'aops', easy: true, name: 'AoPS Alcumus — one session', url: 'https://artofproblemsolving.com/alcumus' },
  { id: 'proof', name: 'Write up one proof cleanly (Cummings / Velleman)', url: 'https://longformmath.com/proofs-book' },
  { id: 'euclid', name: 'Waterloo Euclid / CEMC — one past contest', url: 'https://www.cemc.uwaterloo.ca/contests/past_contests.html' },
  { id: 'hmmt', name: 'HMMT / PUMaC archive — one problem set', url: 'https://www.hmmt.org/www/archive/problems' },
  { id: 'euler', easy: true, name: 'Project Euler — one problem', url: 'https://projecteuler.net/archives' },
  { id: 'mathclub', name: 'Math club / circle — plan one session (SLO)', url: 'https://mail.google.com/' },
  { id: 'promys', easy: true, name: 'Summer math (PROMYS / Ross / SUMaC) — check dates, start the application', url: 'https://promys.org/' },
  // lead & teach
  { id: 'slo', name: 'SLO — plan this week\'s session, write down the goal', url: 'https://mail.google.com/' },
  { id: 'tutor', name: 'Peer tutoring — one session, log the hours', url: 'https://www.khanacademy.org/computing' },
  { id: 'club', name: 'Coding club — message the group / recruit one more person', url: 'https://mail.google.com/' },
  { id: 'technovation', easy: true, name: 'Technovation Girls — check the season, rally a team', url: 'https://www.technovation.org/' },
  { id: 'gwc', easy: true, name: 'Girls Who Code — clubs / events near you', url: 'https://girlswhocode.com/' },
  { id: 'devpost', easy: true, name: 'Devpost — one hackathon to sign up for', url: 'https://devpost.com/hackathons' },
  // the log
  { id: 'log', easy: true, name: 'Activity log — what, hours, impact (future-you writes the Common App from this)', url: 'https://docs.google.com/document/' },
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
  theme: 'dark', // 'dark' | 'light' — Settings window + speech bubble
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
  "Don't give up on men — at the end of the day, I'm one. Huh? What? Meow. I'm Juliet.",
  "If a Lana song were a person, she'd look like you.",
  "Go get 'em, men beater.",
  "If you can't throw a punch, you can learn how to spit.",
  "If overnight I up and end it, run away without a mention, go ghost (wonder what comes next).",
  "You deserve a bouquet of tulips with books in between the flowers.",
  "I hope our names are next to each other on a watchlist.",
  "Don't worry, king — you're the best at violin in my eyes.",
  "Vive l'Algerie!",
  "PSG for the win.",
  "Tous ensemble, on chante.",
  "Canada is the best.",
  "Canada is beautiful, but I'd rather see it in the reflection of your eyes. (Juliet said that, not Mirza.)",
  "You are the smartest, most talented, well-spoken person in any room. Stop overthinking and go.",
  "Quick reminder from your cat: you've got this. Smartest, most talented, best-spoken — that's you.",
  "Overthinking is just talent with nowhere to go. Point it at one thing and start.",
  "Whatever you're second-guessing: you already know. You always do.",
  "You've talked your way through harder rooms than this one. Go be brilliant.",
  "The version of you that's worried and the version that's brilliant are the same person. Send the brilliant one.",
  "Deep breath. Smartest person you know is reading this.",
];
const PEP_MIRZA_COUNT = 35;
// onlyMirza → one of his lines; otherwise his lines two times out of three, anything the rest of the time.
function pickPepLine(onlyMirza = false, rng = Math.random, extra = []) {
  const mirza = PEP_LINES.slice(0, PEP_MIRZA_COUNT).concat(extra || []);
  const pool = onlyMirza || rng() < 0.67 ? mirza : PEP_LINES.concat(extra || []);
  return pool[Math.min(pool.length - 1, Math.floor(rng() * pool.length))];
}

const MORNING_LINES = [
  'Coffee first. Then one small thing.',
  "New day. I'll come by later.",
  'Sleep okay? Take it easy today.',
  "Morning. No rush — I'm around.",
];

const PLACEHOLDER_MOVIES = ['Paste your watch-list here, one per line', 'e.g. The Social Network'];

// What she's reading; Juliet remembers the page (Settings -> Books).
const DEFAULT_BOOKS = [
  { id: 'odyssey', title: 'The Odyssey', page: 0 },
  { id: 'lolita', title: 'Lolita', page: 0 },
];

// The watch-list Juliet ships with (Areej can edit it any time in Settings -> Movies).
const DEFAULT_MOVIES = [
  'How to Lose a Guy in 10 Days',
  'The Notebook',
  '10 Things I Hate About You',
  'Romeo + Juliet',
];

function defaultState() {
  return {
    version: 1,
    welcomed: false,   // first-launch hello not shown yet
    firstRunAt: null,  // set on first launch; used to tell "brand new" from "been away"
    settings: { ...DEFAULT_SETTINGS },
    activities: DEFAULT_ACTIVITIES.map((a) => ({ ...a })),
    movies: { unseen: [...DEFAULT_MOVIES], seen: [] },
    books: DEFAULT_BOOKS.map((b) => ({ ...b })),
    customPep: [],  // extra Ego-raiser lines added in Settings -> Lines
    history: [],
    ratings: [],       // {value 1–10, at}
    moods: [],         // {value 'rough'|'okay'|'great', at}
    favourites: [],    // {title, at} — movies she loved
    schedule: { planDate: null, slots: [], fired: [], snoozed: [], recent: [], movieNextAt: null, recapNextAt: null, quietUntil: null, pepAt: null, pepFired: false, checkinAt: null, checkinFired: false, strollAt: null, strollFired: false, morningDate: null, followup: null, goodnightDate: null },
  };
}

module.exports = { DEFAULT_ACTIVITIES, DEFAULT_SETTINGS, PLACEHOLDER_MOVIES, DEFAULT_MOVIES, DEFAULT_BOOKS, PEP_LINES, PEP_MIRZA_COUNT, pickPepLine, MORNING_LINES, defaultState };
