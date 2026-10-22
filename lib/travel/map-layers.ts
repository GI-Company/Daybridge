/**
 * TomTom Orbis Map Display and Traffic v2 raster tiles share XYZ tiling.
 * All URLs are server-side; API keys are sent in HTTP headers, never here.
 */
export type OrbisRasterLayer='streets'|'flow'|'incidents';
const endpoint:Record<OrbisRasterLayer,string>={
 streets:'/maps/orbis/display/raster/tile',
 flow:'/maps/orbis/traffic/flow/raster/tile',
 incidents:'/maps/orbis/traffic/incidents/raster/tile'
};

export function orbisRasterTileUrl(
 layer:OrbisRasterLayer,z:number,x:number,y:number,style:'light'|'dark'='light'
):URL{
 if(!Number.isSafeInteger(z)||z<0||z>18||!Number.isSafeInteger(x)||
    !Number.isSafeInteger(y)||x<0||y<0||x>=2**z||y>=2**z)
   throw new Error('Invalid map tile coordinates');
 const uri=new URL('https://api.tomtom.com'+endpoint[layer]+'/'+z+'/'+x+'/'+y);
 uri.searchParams.set('apiVersion','2');
 uri.searchParams.set('tileSize','256');
 if(layer==='streets'){
  uri.searchParams.set('style',style==='dark'?'street-dark':'street-light');
  uri.searchParams.set('geopoliticalView','Unified');
 }else{
  uri.searchParams.set('style',style);
 }
 return uri;
}
