import test from 'node:test';
import assert from 'node:assert/strict';
import {projectRoute} from '../lib/travel/projection.ts';

test('projected TomTom route fits inside a mobile map viewport',()=>{
 const from={lat:34.598,lon:-83.763},to={lat:34.563,lon:-83.762};
 const view=projectRoute([],from,to);
 assert.ok(view.zoom>=3 && view.zoom<=17);
 assert.ok(view.start.x>=0&&view.start.x<=640);
 assert.ok(view.finish.y>=0&&view.finish.y<=320);
 assert.ok(view.line.includes(','));
});
