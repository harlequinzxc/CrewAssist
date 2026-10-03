// Compact-print main-course extraction: the frozen corpus contract.
// v1.25.0: one-line additions behind main-course names — Ẃ connector (U+1E82),
// name's own WITH → Ẃ, AND joins, "— PROTEIN" for foreign-name dishes, grey
// .pc-add with protein inversion, mains-only scope.
// v1.25.1: when the dish name itself contains "with" (rendered Ẃ), the
// addition's connector is AND instead — never two Ẃ connectors on one line
// (EGG OMELETTE STUFFED Ẃ MUSHROOMS AND PORK SAUSAGES AND POTATOES).
// v1.25.2: when the name contains "and" (with or without a "with"), the
// connector is Ẃ — never pile up ANDs (BRAISED CHICKEN Ẃ BABY ABALONE AND
// MOREL MUSHROOM Ẃ STEAMED RICE). Full rule: AND only when the name has
// "with" and no "and"; otherwise Ẃ.
// v1.28.3 (owner rulings): list joins read as a comma list without a serial
// comma — "CLAMS, PRAWNS, SCALLOP AND WHEAT NOODLES" (two items stay
// "A AND B"); and ONE dedupe across both groups, keyed on the phrase's first
// protein word — when phrases share a core the LONGEST wording survives in
// the FIRST mention's slot (KHAO THOM KAI — CHICKEN MEAT Ẃ FRAGRANT JASMINE
// RICE; WANTON MEE Ẃ PORK CHAR SIEW; the donburi's SALMON ROE folds into
// SALMON). Fixture regenerated in the same commit: 43 composed lines changed,
// starch/meat axes untouched.
// The fixture (tests/menu-extraction.fixture.json) freezes the extractor's
// output for all 1,139 unique (name, description) pairs harvested from the
// official SQ main-course corpus (_inbox/menu/sq_main_courses.json). It was
// validated pair-by-pair against the reviewed digest v1.3. If a vocabulary or
// rule change is ever deliberate, regenerate the fixture in the same commit
// and say so — a mismatch here means extraction drifted.
// v1.34.3 (owner ruling, regenerated): "rice noodles" is its own starch (was
// surfacing RICE/NOODLES), and "fish cake" is not a whole seafood protein
// (masked, like fish sauce) — 22 pairs changed, all in exactly those two
// classes; every other pair is byte-identical.
const H = require('./_harness');
const { R, boot, wait, APP } = H;
const fs = require('fs');
const path = require('path');
const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'menu-extraction.fixture.json'), 'utf8'));
const WACUTE = '\u1e82'; // Ẃ
const EMDASH = '\u2014'; // —

(async () => {
  const { w, d } = await boot(APP);

  // --- the frozen corpus contract: every pair, all three axes ---
  {
    let badS = 0, badM = 0, badC = 0, first = '';
    FIX.forEach((f) => {
      const x = w.compactExtractAddition(f.n, f.d);
      if (x.starch !== f.s) { badS++; if (!first) first = `starch ${f.n}: got ${x.starch}, want ${f.s}`; }
      const gm = x.meats.map((m) => [m.phrase, m.hidden ? 'hidden' : 'primary']);
      if (JSON.stringify(gm) !== JSON.stringify(f.m)) { badM++; if (!first) first = `meat ${f.n}: got ${JSON.stringify(gm)}, want ${JSON.stringify(f.m)}`; }
      const c = w.compactComposeAddition(f.n, f.d);
      if (c !== f.c) { badC++; if (!first) first = `compose ${f.n}: got ${JSON.stringify(c)}, want ${JSON.stringify(f.c)}`; }
    });
    R.eq(FIX.length, 1139, 'fixture carries all 1,139 unique pairs');
    R.eq(badS, 0, `starch winners match on all pairs${first ? ' — ' + first : ''}`);
    R.eq(badM, 0, `meat lists (phrase + hidden/primary) match on all pairs${first ? ' — ' + first : ''}`);
    R.eq(badC, 0, `composed additions match on all pairs${first ? ' — ' + first : ''}`);
  }

  // --- the four owner-pinned signature dishes, exact lines ---
  {
    const find = (n, dd) => FIX.find((f) => f.n === n && (!dd || String(f.d).includes(dd)));
    R.eq(w.compactComposeAddition(find('Sweet and Sour Fish').n, find('Sweet and Sour Fish').d),
      `${WACUTE} FRAGRANT EGG FRIED RICE`, 'Sweet and Sour Fish Ẃ line');
    R.eq(w.compactComposeAddition(find('Egg Omelette Stuffed with Mushrooms').n, find('Egg Omelette Stuffed with Mushrooms').d),
      `AND PORK SAUSAGES AND POTATOES`, 'Egg Omelette hidden-meat + starch line (name has "with" → AND connector)');
    R.eq(w.compactComposeAddition(find('Stir Fried Tiger Prawns in Ginger Garlic Sauce').n, find('Stir Fried Tiger Prawns in Ginger Garlic Sauce').d),
      `${WACUTE} STEAMED JASMINE RICE`, 'Tiger Prawns Ẃ line');
    R.eq(w.compactComposeAddition(find('Sukiyaki').n, find('Sukiyaki').d),
      `${EMDASH} BEEF ${WACUTE} STEAMED RICE`, 'Sukiyaki foreign-name protein line');
    // v1.25.2: name with BOTH "with" and "and" keeps the Ẃ connector
    R.eq(w.compactComposeAddition(find('Braised Chicken with Baby Abalone and Morel Mushroom').n, find('Braised Chicken with Baby Abalone and Morel Mushroom').d),
      `${WACUTE} STEAMED RICE`, 'with+and name keeps Ẃ (AND never piles up)');
    // v1.28.3 rulings: comma lists + unified most-specific dedupe
    R.eq(w.compactComposeAddition(find('Kalguksu').n, find('Kalguksu').d),
      `${EMDASH} ANCHOVY ${WACUTE} CLAMS, PRAWNS, SCALLOP AND WHEAT NOODLES`, 'Kalguksu comma list without serial comma');
    R.eq(w.compactComposeAddition(find('Wanton Mee', 'char siew').n, find('Wanton Mee', 'char siew').d),
      `${WACUTE} PORK CHAR SIEW`, 'Wanton Mee keeps the specific wording, drops the repeated PORK');
    R.eq(w.compactComposeAddition(find('Khao Thom Kai').n, find('Khao Thom Kai').d),
      `${EMDASH} CHICKEN MEAT ${WACUTE} FRAGRANT JASMINE RICE`, 'Khao Thom Kai promotes CHICKEN MEAT to the primary slot');
    R.eq(w.compactComposeAddition(find('Teriyaki Kaisen Donburi').n, find('Teriyaki Kaisen Donburi').d),
      `${EMDASH} SALMON, SCALLOP, PRAWN AND CRAB ${WACUTE} STEAMED RICE`, 'donburi: SALMON ROE folds into SALMON under the same core');
    R.eq(w.compactComposeAddition(find('Singapore Hokkien Mee').n, find('Singapore Hokkien Mee').d),
      `${EMDASH} PRAWNS AND PORK ${WACUTE} TENDER SQUID`, 'Hokkien Mee: the specific fresh prawns beat the broth prawn');
    // v1.34.3 rulings: rice noodles read whole; fish cake is not a protein
    R.eq(w.compactComposeAddition(find('Beef Hor Fun').n, find('Beef Hor Fun').d),
      `${WACUTE} RICE NOODLES`, 'Beef Hor Fun: rice noodles read as RICE NOODLES, never bare RICE (owner ruling)');
    R.eq(w.compactComposeAddition(find('Laksa', 'fish cake').n, find('Laksa', 'fish cake').d),
      `${WACUTE} PRAWNS`, 'Laksa: fish cake is masked — made with fish, not a whole seafood protein');
    R.eq(w.compactComposeAddition(find('Khao Thom', 'fish cake').n, find('Khao Thom', 'fish cake').d),
      `${WACUTE} TENDER PORK, MEATBALLS AND RICE`, 'Khao Thom keeps pork and meatballs, drops the fish cake');
    R.eq(w.compactExtractAddition('Beef Hor Fun', 'stir-fried with wide rice noodles').starch,
      'wide rice noodles', 'the starch winner keeps the compound: wide RICE NOODLES');
    R.eq(JSON.stringify(w.compactExtractAddition('Laksa Special', 'with fish cake and prawns').meats.map((mm) => mm.phrase)),
      JSON.stringify(['prawns']), 'fish cake never yields a protein token; the prawns still do');
  }

  // --- rendered item HTML: name first, WITH → Ẃ, grey addition, inversion ---
  {
    // v1.34.0: brackets is the new default marking mode — force the square
    // to keep pinning the invert path.
    w.printState.proteinMode = 'square';
    const html = w.printCompactItems('MAIN COURSE:', [
      { name: 'Egg Omelette Stuffed with Mushrooms', desc: 'Served with creamy onion sauce, pork sausages, roasted tomato and potatoes' },
      { name: 'Fried Rice with Vegetables', desc: 'Topped with mixed berry compote, honey and whipped cream' }
    ], false, true);
    const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    R.ok(plain.includes(`EGG OMELETTE STUFFED ${WACUTE} MUSHROOMS AND PORK SAUSAGES AND POTATOES`), 'omelette renders name + AND-joined addition on one line (no second Ẃ)');
    R.ok(plain.includes(`FRIED RICE ${WACUTE} VEGETABLES`), 'name WITH becomes Ẃ even without an addition');
    const itemChunks = html.split('<div class="pc-item"').slice(1);
    R.ok(itemChunks.length === 2 && itemChunks[1].indexOf('pc-add') === -1, 'starch-in-name dish gains no addition span');
    R.ok(html.includes('<span class="pc-add">'), 'addition wrapped in grey .pc-add');
    R.ok(html.includes(`<span class="pc-add">AND <span class="pc-hl">PORK</span> <span class="pc-hl">SAUSAGES</span> AND POTATOES</span>`), 'protein words inverted inside the addition');
    R.ok(!/<span class="pc-hl">POTATOES<\/span>/.test(html), 'starch words stay grey in the addition');
    // mains-only: a dessert keeps its WITH and never gains an addition
    const dessert = w.printCompactItems('DESSERT:', [{ name: 'Cake with Cream', desc: 'served with steamed jasmine rice' }], false, false);
    const dplain = dessert.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    R.ok(dplain.includes('CAKE WITH CREAM') && !dplain.includes(WACUTE), 'non-main courses keep WITH and gain no addition');
    w.printState.proteinMode = 'brackets';
  }

  // --- v1.34.0: brackets marking mode + hidden proteins on non-mains (SQ106) ---
  {
    R.eq(w.printState.proteinMode, 'brackets', 'brackets is the default marking mode');
    R.eq(w.printHighlightProteins('GRILLED CHICKEN BREAST'), 'GRILLED [CHICKEN] BREAST', 'brackets mode wraps the protein word, plain black text');
    // SQ106: the cold refreshment hid its sliced smoked chicken in the description
    const html = w.printCompactItems('COLD REFRESHMENT:', [
      { name: 'Open-Faced Sandwich', desc: 'Topped with sliced smoked chicken and herb mayonnaise' }
    ], false, false);
    R.ok(html.includes('<span class="pc-add">' + WACUTE + ' SLICED SMOKED [CHICKEN]</span>'), 'SQ106 hidden protein surfaces as a brackets-marked addition');
    R.ok(html.indexOf('pc-hl') === -1, 'brackets mode renders no invert spans');
    // a primary-style description reads dash-style, like the sandwich mains
    const html2 = w.printCompactItems('COLD REFRESHMENT:', [
      { name: 'Open-Faced Sandwich', desc: 'Sliced smoked chicken, lettuce, herb mayonnaise' }
    ], false, false);
    R.ok(html2.includes('<span class="pc-add">\u2014 [CHICKEN]</span>'), 'primary protein on a non-main reads dash-style');
    // the square restores the black invert everywhere
    w.printState.proteinMode = 'square';
    const html3 = w.printCompactItems('COLD REFRESHMENT:', [
      { name: 'Open-Faced Sandwich', desc: 'Topped with sliced smoked chicken and herb mayonnaise' }
    ], false, false);
    R.ok(html3.includes('<span class="pc-hl">CHICKEN</span>'), 'square mode restores the black invert');
    w.printState.proteinMode = 'brackets';
    // the canvas export carries the same hidden protein
    const toks = w.compactItemTokens('OPEN-FACED SANDWICH', 'Topped with sliced smoked chicken', false);
    R.ok(toks.some((t) => t.add && t.invert && t.text === 'CHICKEN'), 'canvas tokens carry the hidden protein as an invert token');
    // a name that already shows its protein gains no addition
    const html4 = w.printCompactItems('COLD REFRESHMENT:', [{ name: 'Smoked Chicken Sandwich', desc: 'with pickles' }], false, false);
    R.ok(html4.indexOf('pc-add') === -1 && html4.includes('SMOKED [CHICKEN] SANDWICH'), 'no addition when the name already shows the protein; the name itself brackets');
    // starches never surface on non-mains (the dessert ruling stands)
    const html5 = w.printCompactItems('DESSERT:', [{ name: 'Cake with Cream', desc: 'served with steamed jasmine rice' }], false, false);
    R.ok(html5.indexOf('pc-add') === -1, 'non-main additions stay protein-only (no starch lines on desserts)');
  }

  // --- canvas export token stream: grey add tokens, inversion preserved ---
  {
    const toks = w.compactItemTokens('POT ROASTED CHICKEN WITH MUSHROOM', 'Served with mashed potatoes', true);
    const text = toks.map((t) => t.text).join('');
    R.ok(text.includes(`POT ROASTED CHICKEN ${WACUTE} MUSHROOM AND MASHED POTATOES`), 'canvas tokens: WITH→Ẃ name, AND connector when the name has a with');
    R.ok(toks.some((t) => t.add === true && t.text === 'AND'), 'addition tokens flagged grey (add)');
    R.ok(toks.some((t) => t.invert && t.text === 'CHICKEN'), 'name protein still inverted');
    const t2 = w.compactItemTokens('STIR FRIED TIGER PRAWNS IN GINGER GARLIC SAUCE', FIX.find((f) => f.n === 'Stir Fried Tiger Prawns in Ginger Garlic Sauce').d, true);
    const text2 = t2.map((t) => t.text).join('');
    R.ok(text2.includes(`PRAWNS IN GINGER GARLIC SAUCE ${WACUTE} STEAMED JASMINE RICE`), 'canvas tokens: Ẃ connector when the name has no with');
    R.ok(t2.some((t) => t.add === true && t.text === WACUTE), 'Ẃ connector token flagged grey');
    const noMain = w.compactItemTokens('POT ROASTED CHICKEN WITH MUSHROOM', 'Served with mashed potatoes', false);
    R.ok(noMain.every((t) => t.add !== true) && noMain.map((t) => t.text).join('').includes('WITH'), 'non-main canvas tokens untouched');
  }

  // --- mains detection follows the app's existing course labelling ---
  {
    R.ok(w.printIsMainCourse('Main Course') && w.printIsMainCourse('ENTRÉE') && w.printIsMainCourse('entree'), 'main-course labels recognised');
    R.ok(!w.printIsMainCourse('Dessert') && !w.printIsMainCourse('Light Bites') && !w.printIsMainCourse('From the Bakery'), 'other courses excluded');
  }

  // --- version stamps: app + service-worker cache bump together ---
  {
    const src = fs.readFileSync(APP, 'utf8');
    // v1.33.3 (owner report): printed compact sheets lost the white-on-black
    // protein words — browsers drop background graphics by default.
    R.ok(/\.pc-hl\s*{[^}]*-webkit-print-color-adjust:\s*exact/s.test(src) && /\.pc-hl\s*{[^}]*print-color-adjust:\s*exact/s.test(src), 'the protein highlight forces its black fill through every print engine');
    // v1.34.0 (owner ruling): protein marking is a mode — [brackets] default,
    // black square invert opt-in; hidden proteins surface on non-mains too.
    R.ok(src.includes('id="print-protein-brackets"') && src.includes('id="print-protein-square"'), 'the brackets/square pill sits in the compact toolbar');
    R.ok(src.includes("proteinMode: 'brackets'"), 'brackets is the in-memory default');
    R.ok(src.includes("var APP_VERSION = '1.39.0';"), 'APP_VERSION stamped 1.39.0');
    R.ok(fs.readFileSync(path.resolve(__dirname, '..', 'sw.js'), 'utf8').includes("crewassist-v174"), 'service-worker cache name bumped to v174');
  }

  process.exit(R.done() ? 1 : 0);
})();
