import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyBookletSwipe} from '../lib/notes/page-gesture.ts';

test('vertical swipe up advances the page and swipe down goes back',()=>{
 assert.equal(classifyBookletSwipe(2,-90),'next');
 assert.equal(classifyBookletSwipe(-2,90),'previous');
});
test('horizontal swipes turn pages and long right swipe returns to first page',()=>{
 assert.equal(classifyBookletSwipe(-84,5),'next');
 assert.equal(classifyBookletSwipe(85,-2),'previous');
 assert.equal(classifyBookletSwipe(165,9),'first');
});
test('small, diagonal or invalid gestures never change pages',()=>{
 assert.equal(classifyBookletSwipe(22,-25),null);
 assert.equal(classifyBookletSwipe(90,84),null);
 assert.equal(classifyBookletSwipe(NaN,0),null);
 assert.equal(classifyBookletSwipe(0,Infinity),null);
});
