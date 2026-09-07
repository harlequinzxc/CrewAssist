const aDate = '2026-09-06';
const aTime = '07:20';
const dDate = '2026-09-08';
const dTime = '21:00';

const arrDt = new Date(aDate + 'T00:00:00');
const depDt = new Date(dDate + 'T00:00:00');
const msDiff = depDt.getTime() - arrDt.getTime();
const daysDiff = Math.round(msDiff / (1000 * 60 * 60 * 24));

const parseMins = (t) => {
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return -1;
    return parseInt(m[1]) * 60 + parseInt(m[2]);
};

const arrMins = parseMins(aTime);
const depMins = parseMins(dTime);

const bEnd = 8*60+30; const bStart = 7*60+30;
const lEnd = 13*60+30; const lStart = 12*60+30;
const dEnd = 20*60+30; const dStart = 19*60+30;

let stationTotal = 0;
const rates = { b: 53, l: 92, d: 119 }; // LHR

for (let d = 0; d <= daysDiff; d++) {
    let bc=0, lc=0, dc=0;
    
    if (daysDiff === 0) {
        if (arrMins <= bEnd && depMins >= bStart) bc++;
        if (arrMins <= lEnd && depMins >= lStart) lc++;
        if (arrMins <= dEnd && depMins >= dStart) dc++;
    } else if (d === 0) {
        if (arrMins <= bEnd) bc++;
        if (arrMins <= lEnd) lc++;
        if (arrMins <= dEnd) dc++;
    } else if (d === daysDiff) {
        if (depMins >= bStart) bc++;
        if (depMins >= lStart) lc++;
        if (depMins >= dStart) dc++;
    } else {
        bc++; lc++; dc++;
    }
    
    let dayCost = (bc*rates.b) + (lc*rates.l) + (dc*rates.d);
    stationTotal += dayCost;
}

console.log('LMA Total:', stationTotal);
