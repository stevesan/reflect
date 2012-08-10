#pragma strict

import System.Collections.Generic;

//----------------------------------------
//  A level object, such as a key
//	TODO - this is really really not gonna scale..we can't just like reproduce the whole object properties system..
//	need to just get inkscape level geom into the game, then use the Unity Editor to place objects..
//	Maybe should just use Blender and import the model..?
//----------------------------------------
class LevelObject
{
	var type:String;
	var pos:Vector3;
}

//----------------------------------------
//  A single level
//----------------------------------------
class LevelInfo
{
	var geo = new Polygon2D();
	var playerPos:Vector2;
	var goalPos:Vector2;
	var objects = new List.<LevelObject>();
	var rockGeo = new Polygon2D();	// rocks - ie. colliders that are immune to reflection

	var areaCenter:Vector2;	// used to position the camera
	var origAreaCenter:Vector2;	// used to order the levels based on their position in the SVG sheet
	var maxReflections:int = 2;

	//----------------------------------------
	//  Snaps the area centers to a grid where each cell is 125x125
	//	Then, compares the x,y integer coordinates
	//	Left to right, top to bottom
	//----------------------------------------
	static var levelAreaGridSize = 125.0;
	static function LevelOrderCompare( a:LevelInfo, b:LevelInfo ) : int
	{
		var a_u:int = Mathf.Floor( a.origAreaCenter.x / levelAreaGridSize );
		var a_v:int = Mathf.Floor( a.origAreaCenter.y / levelAreaGridSize );
		var b_u:int = Mathf.Floor( b.origAreaCenter.x / levelAreaGridSize );
		var b_v:int = Mathf.Floor( b.origAreaCenter.y / levelAreaGridSize );

		if( a_v == b_v )
			return Mathf.RoundToInt( Mathf.Sign(a_u - b_u) );
		else
			return Mathf.RoundToInt( Mathf.Sign(b_v - a_v) );
	}
}

static function ParseRect( parts:String[] ) : Rect
{
	// NOTE: As of Unity 3.5, Rect actually takes the BOTTOM, not the top
	var height = parseFloat(parts[4]);
	return new Rect( parseFloat(parts[1]), -parseFloat(parts[2])-height, parseFloat(parts[3]), height );
}

static function ParseRectCenter( parts:String[] ) : Vector2
{
	var rect = ParseRect( parts );
	return rect.center;
}

static function ReadPolygon2D( parts:String[], reader:StringReader ) : Polygon2D
{
	// read in SVG commands, and use the SVG builder
	var numCmds = parseInt( parts[1] );

	var builder = new SvgPathBuilder();
	builder.BeginBuilding();
	builder.ExecuteCommands( reader, 0.0, 1.0, Vector2(0,0), numCmds );
	builder.EndBuilding();

	// convert svg into polygon2D
	var poly = new Polygon2D();

	// we can assume that all level paths are closed polygons
	// so get all but the last point
	poly.pts = new Vector2[ builder.GetPoints().Count - 1 ];
	for( var i = 0; i < poly.pts.length; i++ ) {
		poly.pts[i] = builder.GetPoints()[i];
	}
	var npts = poly.pts.length;
	poly.edgeA = new int[ npts ];
	poly.edgeB = new int[ npts ];

	// we actually build our edges in CCW direction
	for( i = 0; i < poly.pts.length; i++ )
	{
		poly.edgeA[i] = i;
		poly.edgeB[(i+1)%npts] = i;
	}

	return poly;
}

//----------------------------------------
//  
//----------------------------------------
static function ParseLevels( reader:StringReader ) : List.<LevelInfo>
{
	//----------------------------------------
	//  Parse all the areas and objects
	//	We do them all in separate lists, because we can only figure out which levels each objects belongs to after we've parsed all the levels
	//----------------------------------------
	var areas = new List.<Rect>();	// areas contain levels
	var maxReflections = new Array();
	var players = new List.<Rect>();
	var goals = new List.<Vector2>();
	var objects = new List.<LevelObject>();
	var geos = new List.<Polygon2D>();
	var rockGeos = new List.<Polygon2D>();

	var line = reader.ReadLine();
	while( line != null )
	{
		var parts = line.Split([' '], System.StringSplitOptions.RemoveEmptyEntries);
		if( parts[0] == 'levelArea')
		{
			areas.Add( ParseRect( parts ) );
			maxReflections.Push( parseInt( parts[5] ) );
		}
		else if( parts[0] == 'player' )
			players.Add( ParseRect( parts ) );
		else if( parts[0] == 'goal' )
			goals.Add( ParseRectCenter( parts ) );
		else if( parts[0] == 'levelGeo' )
			geos.Add( ReadPolygon2D(parts, reader) );
		else if( parts[0] == 'rockGeo' )
			rockGeos.Add( ReadPolygon2D(parts, reader) );
		else {
			// some other object type, like a key
			var obj = new LevelObject();
			obj.type = parts[0];
			obj.pos = ParseRectCenter( parts );
			objects.Add( obj );
		}
		line = reader.ReadLine();
	}

	//----------------------------------------
	//  Now build the levels by figuring out which objects are in which areas
	//----------------------------------------
	var infos = new List.<LevelInfo>( areas.Count );

	for( var iLev = 0; iLev < areas.Count; iLev++ )
	{
		var area = areas[ iLev ];
		var found = false;
		var info = new LevelInfo();
		info.origAreaCenter = area.center;
		info.maxReflections = maxReflections[iLev];

		var playerWidth = 1.0;
		// find the first player that's in the area
		for( player in players ) {
			if( area.Contains( player.center ) ) {
				info.playerPos = player.center;
				playerWidth = player.width;
				found = true;
				break;
			}
		}
		if( !found )
			Debug.LogError('no player found for level '+infos.Count);

		found = false;
		for( pos in goals ) {
			if( area.Contains( pos ) ) {
				info.goalPos = pos;
				found = true;
				break;
			}
		}
		if( !found )
			Debug.LogError('no goal found for level '+infos.Count);

		// level objects - don't care
		for( lobj in objects ) {
			if( area.Contains( lobj.pos ) )
				info.objects.Add( lobj );
		}

		found = false;
		// level geometry - need >= 1
		for( geo in geos ) {
			if( area.Contains( geo.pts[0] ) ) {
				found = true;
				info.geo.Append( geo );
				// don't break, as we can have many geos
			}
		}
		if( !found )
			Debug.LogError('no geometry found for level '+infos.Count);

		// rock geo
		for( geo in rockGeos ) {
			if( area.Contains( geo.pts[0] ) ) {
				info.rockGeo.Append( geo );
			}
		}

		//----------------------------------------
		//  Normalize everything so the player's size is 1.0
		//----------------------------------------
		info.playerPos /= playerWidth;
		info.goalPos /= playerWidth;
		info.areaCenter = info.origAreaCenter / playerWidth;
		info.geo.ScalePoints( 1.0/playerWidth );
		info.rockGeo.ScalePoints( 1.0/playerWidth );
		for( var i = 0; i < info.objects.Count; i++ )
			info.objects[i].pos /= playerWidth;

		infos.Add(info);

		i++;
	}

	//----------------------------------------
	//  Sort the levels by their visual order in the SVG
	//----------------------------------------
	infos.Sort( LevelInfo.LevelOrderCompare );


	return infos;
}

function Start () {

}

function Update () {

}