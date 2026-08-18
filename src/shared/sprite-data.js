// Juliet placeholder pixel art. UMD so both the Node icon script and the overlay page can use it.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JULIET_SPRITE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const SIZE = 16;
  // . transparent  k outline  g gray  l light gray  w white  p pink  e eye
  const PALETTE = { k: '#2b2b33', g: '#8a8f9a', l: '#b8bcc6', w: '#ffffff', p: '#f29bb0', e: '#141418' };

  // rows 0-11: tail + body + head, facing RIGHT
  const BODY = [
    '................',
    '........kk..kk..',
    '........kgk.kgk.',
    '.......kgggggggk',
    '.kk....kgegggegk',
    'kwk....kgggggggk',
    'kgk...kkggwwwwpk',
    'kgkkkkkggggwwwwk',
    '.kgggggggggggkk.',
    '.kglllllllggggk.',
    '..kglllllllgggk.',
    '..kkgggggggggk..',
  ];
  const BLINK_BODY = BODY.map((r, i) => (i === 4 ? '.kk....kgkgggkgk' : r));

  const LEGS_A = ['..kgk....kgk....', '..kgk....kgk....', '.kwk......kwk...', '.kkk......kkk...'];
  const LEGS_B = ['...kgk...kgk....', '...kgk...kgk....', '...kwk...kwk....', '...kkk...kkk....'];
  const LEGS_C = ['..kgk....kgk....', '..kgk....kgk....', '...kwk..kwk.....', '...kkk..kkk.....'];
  const LEGS_SIT = ['..kgggggggggk...', '..kgggggggggk...', '..kwwk...kwwk...', '..kkkk...kkkk...'];
  const LEGS_TUCK = ['...kwk...kwk....', '...kkk...kkk....', '................', '................'];
  const BLANK = '................';

  const FRAMES = [
    [...BODY, ...LEGS_A], // 0 walk
    [...BODY, ...LEGS_B], // 1 walk
    [...BODY, ...LEGS_C], // 2 walk
    [...BODY, ...LEGS_B], // 3 walk
    [...BODY, ...LEGS_SIT], // 4 sit
    [...BLINK_BODY, ...LEGS_SIT], // 5 sit blink
    [BLANK, ...BODY, ...LEGS_SIT.slice(1)], // 6 crouch (body 1px lower)
    [...BODY, ...LEGS_TUCK], // 7 air (legs tucked, 2px of air below)
  ];

  const TRAY_FACE = [
    '................',
    '..kk........kk..',
    '..kkk......kkk..',
    '..kkkkkkkkkkkk..',
    '.kkkkkkkkkkkkkk.',
    '.kkkkkkkkkkkkkk.',
    '.kkk.kkkkkk.kkk.',
    '.kkk.kkkkkk.kkk.',
    '.kkkkkkkkkkkkkk.',
    '.kkkkkkk.kkkkkk.',
    '..kkkkkkkkkkkk..',
    '..kkkkkkkkkkkk..',
    '...kkkkkkkkkk...',
    '....kkkkkkkk....',
    '................',
    '................',
  ];

  return {
    SIZE, PALETTE, FRAMES, TRAY_FACE,
    FRAME_INDEX: { WALK: [0, 1, 2, 3], SIT: 4, BLINK: 5, CROUCH: 6, AIR: 7 },
  };
});
