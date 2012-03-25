#pragma strict

import System.Collections.Generic;

//----------------------------------------
//  A single level
//----------------------------------------
class LevelInfo
{
	var geo = new Mesh2D();
	var playerPos:Vector2;
	var goalPos:Vector2;
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

//----------------------------------------
//  
//----------------------------------------
static function ParseLevels( reader:StringReader ) : List.<LevelInfo>
{
	// This just makes sure the Rect class behaves as we expect.
	var r = new Rect(0,-1000,100,100);
	Utils.Assert( r.Contains(Vector2(50,-950) ));

	//----------------------------------------
	//  Parse all the areas and objects
	//----------------------------------------
	var areas = new List.<Rect>();
	var players = new List.<Rect>();
	var goals = new List.<Vector2>();
	var geos = new List.<Mesh2D>();

	var line = reader.ReadLine();
	while( line != null )
	{
		var parts = line.Split([' '], System.StringSplitOptions.RemoveEmptyEntries);
		if( parts[0] == 'levelArea')
			areas.Add( ParseRect( parts ) );
		else if( parts[0] == 'player' )
			players.Add( ParseRect( parts ) );
		else if( parts[0] == 'goal' )
			goals.Add( ParseRectCenter( parts ) );
		else if( parts[0] == 'levelGeo' )
		{
			var numCmds = parseInt( parts[1] );

			var builder = new SvgPathBuilder();
			builder.BeginBuilding();
			builder.ExecuteCommands( reader, 0.0, 1.0, Vector2(0,0), numCmds );
			builder.EndBuilding();

			var geo = new Mesh2D();
			geo.pts = builder.GetPoints();
			// TEMP SvgPathBuilder should really have this
			var npts = geo.pts.length;
			geo.edgeA = new int[ npts ];
			geo.edgeB = new int[ npts ];
			for( var i = 0; i < geo.pts.length; i++ )
			{
				geo.edgeA[i] = i;
				geo.edgeB[(i+1)%npts] = i;
			}
			geos.Add( geo );
		}
		else
		{
			Debug.LogError('bad line: '+line);
		}
		line = reader.ReadLine();
	}

	//----------------------------------------
	//  Now build the levels by figuring out which objects are in which areas
	//----------------------------------------
	var infos = new List.<LevelInfo>( areas.Count );
	i = 0;

	for( area in areas )
	{
		var found = false;
		var info = new LevelInfo();
		var playerWidth = 1.0;
		// find the first player that's in the area
		for( player in players )
		{
			if( area.Contains( player.center ) )
			{
				info.playerPos = player.center;
				playerWidth = player.width;
				found = true;
				break;
			}
		}
		if( !found )
			Debug.LogError('no player found for level '+infos.Count);

		found = false;
		for( pos in goals )
		{
			if( area.Contains( pos ) )
			{
				info.goalPos = pos;
				found = true;
				break;
			}
		}
		if( !found )
			Debug.LogError('no goal found for level '+infos.Count);

		found = false;
		for( geo in geos )
		{
			if( area.Contains( geo.pts[0] ) )
			{
				found = true;
				info.geo = geo;
				break;
			}
		}
		if( !found )
			Debug.LogError('no geometry found for level '+infos.Count);

		//----------------------------------------
		//  Normalize everything so the player's size is 1.0
		//----------------------------------------
		info.playerPos /= playerWidth;
		info.goalPos /= playerWidth;
		info.geo.ScalePoints( 1.0/playerWidth );

		infos.Add(info);

		i++;
	}

	return infos;
}

function Start () {

}

function Update () {

}