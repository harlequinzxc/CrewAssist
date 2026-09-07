const fs = require('fs');

// Check if Tail overlaps Left Wing
// Left Wing: (50,230) A, (460,50) B, (210,290) C
// Tail: (210,290) C, (290,460) D, (210,380) E
// We can just rely on standard paper plane geometry. 
// A typical paper plane is:
// Left: 50, 230 -> 460, 50 -> 210, 290
// Right: 210, 290 -> 460, 50 -> 290, 460
// But actually the bottom right is typically NOT a full triangle like that. 
// Standard Telegram icon:
// A (left): 40, 240
// B (top right): 460, 40
// C (bottom right): 240, 460
// D (center): 210, 310
// Left Wing: A, B, D
// Right Wing: B, C, D
// Fold (Tail): D, C, E where E is somewhere.
// In Telegram, the tail is a triangle overlapping the right wing or something? No, it drops from D.
console.log("Done");
