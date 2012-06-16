#pragma strict

import System.IO;

static var Singleton : GameController = null;

var hostcam : Camera;

//----------------------------------------
//  Prefabs/Puppet-objects
//----------------------------------------
var helpText : GUIText;
var player : GameObject;
var goal : GameObject;
var keyPrefab : GameObject;
var background : GameObject;

// the current collision geometry polygon will be triangulated into this object
var trisHost : MeshFilter;
var debugHost:DebugTriangulate = null;

//----------------------------------------
//  Assets
//----------------------------------------
var levelsText : TextAsset;

//----------------------------------------
//  Sounds
//----------------------------------------
var goalGetSound : AudioClip;
var restartSnd : AudioClip;
var startReflectSnd : AudioClip;
var cancelReflectSnd : AudioClip;
var confirmReflectSnd : AudioClip;
var keyGetSound : AudioClip;
var goalLockedSound: AudioClip;
var maxedReflectionsSnd: AudioClip;

//----------------------------------------
//  Debug
//----------------------------------------
var debugUnlimited = false;

//----------------------------------------
//  Game state
//----------------------------------------
private var levels : List.<LevelInfo> = null;
private var currLevId : int = 0;
private var currLevGeo : Polygon2D = null;

//----------------------------------------
//  Reflection UI state
//----------------------------------------
private var isReflecting = false;
private var numReflections = 0;
private var lineStart = Vector2(0,0);
private var numKeysGot = 0;
private var keyObjs = new Array();

function GetLevel() : LevelInfo { return levels[currLevId]; }

function OnGetGoal()
{
	if( numKeysGot == keyObjs.length )
	{
		AudioSource.PlayClipAtPoint( goalGetSound, hostcam.transform.position );
		SwitchLevel( (currLevId+1) % levels.Count );
	}
	else
	{
		AudioSource.PlayClipAtPoint( goalLockedSound, hostcam.transform.position );
	}
}

function UpdateGoalLocked()
{
	goal.GetComponent(Star).SetLocked( numKeysGot < keyObjs.length );
}

function OnGetKey( keyObj:GameObject )
{
	numKeysGot++;
	Debug.Log('got '+numKeysGot+' keys');
	AudioSource.PlayClipAtPoint( keyGetSound, hostcam.transform.position );
	Destroy(keyObj);
	UpdateGoalLocked();
}

function SwitchLevel( id:int )
{
	// we'll be changing the geo, obviously, so make a copy
	isReflecting = false;
	numReflections = 0;
	currLevId = id;

	currLevGeo = levels[id].geo.Duplicate();
	UpdateCollisionMesh();

	// draw the triangulated mesh
	if( trisHost != null ) {
		ProGeo.TriangulateSimplePolygon( currLevGeo, trisHost.mesh, false );
		trisHost.mesh.RecalculateNormals();
	}

	player.transform.position = levels[id].playerPos;
	player.GetComponent(PlayerControl).Reset();
	goal.transform.position = levels[id].goalPos;

	// move the background to the area's center
	background.transform.position = levels[id].areaCenter;
	background.transform.position.z = 10;

	hostcam.transform.position = Utils.ToVector3( levels[id].areaCenter, hostcam.transform.position.z );

	Debug.Log('spawned player at '+player.transform.position);
	Debug.Log('level area center at '+levels[id].areaCenter);

	//----------------------------------------
	//  Spawn keys
	//----------------------------------------
	numKeysGot = 0;
	for( key in keyObjs )
		Destroy(key);
	keyObjs.Clear();
	// always disable the prefab
	keyPrefab.active = false;
	for( keyPos in levels[id].keys )
	{
		var obj = Instantiate( keyPrefab, keyPos, keyPrefab.transform.rotation );
		obj.transform.parent = this.transform;
		obj.active = true;
		keyObjs.Push( obj );
		Debug.Log('spawned key at '+keyPos);
	}

	UpdateGoalLocked();
}

function Awake () {

	if( Singleton != null )
	{
		Debug.LogError( 'Multiple game controllers in scene!' );
		Destroy( this );
	}
	else
	{
		Singleton = this.GetComponent(GameController);

		// build from the text file
		var reader = new StringReader( levelsText.text );
		levels = LevelManager.ParseLevels( reader );
		Debug.Log('Read in '+levels.Count+' levels');

		SwitchLevel( 0 );
	}
}

function UpdateCollisionMesh()
{
	ProGeo.BuildBeltMesh(
			currLevGeo.pts, currLevGeo.edgeA, currLevGeo.edgeB,
			-10, 10, false, GetComponent(MeshFilter).mesh );

	// Destroy the meshcollider component, but remember it isn't
	// actually destroyed until the end of the Update
	// It will get added in the next Update
	if( gameObject.GetComponent(MeshCollider) != null )
		Destroy( gameObject.GetComponent(MeshCollider) );
}

function GetMouseXYWorldPos() : Vector2
{
	var ray = hostcam.ScreenPointToRay( Input.mousePosition );
	// solve for when the ray hits z=0 plane
	var alpha = -ray.origin.z / ray.direction.z;
	var mouseWpos = ray.origin + alpha*ray.direction;
	return Utils.ToVector2( mouseWpos );
}

function Update () {

	// Always add the MeshCollider component if it's not there
	if( gameObject.GetComponent(MeshCollider) == null )
		gameObject.AddComponent(MeshCollider);

	if( currLevGeo != null )
	{
		//currLevGeo.DebugDraw( Color.blue, 0.0 );

		if( Input.GetButtonDown('Reset') )
		{
			AudioSource.PlayClipAtPoint( restartSnd, hostcam.transform.position );
			SwitchLevel( currLevId );
		}
		else if( Input.GetButtonDown('NextLevel') ) {
			SwitchLevel( (currLevId+1)%levels.Count );
		}
		else if( Input.GetButtonDown('PrevLevel') ) {
			SwitchLevel( (levels.Count+currLevId-1)%levels.Count );
		}
		else if( isReflecting )
		{
			helpText.text = 'Left Click - Confirm\nRight Click - Cancel';
			// draw the reflected shape
			var newShape = currLevGeo.Duplicate();
			var lineEnd = GetMouseXYWorldPos();
			newShape.Reflect( lineStart, lineEnd, false );
			//Debug.Log('shape has '+newShape.GetNumVertices()+' verts, ' + newShape.GetNumEdges()+ ' edges');
			//newShape.DebugDraw( Color.yellow, 0.0 );
			//Debug.DrawLine( lineStart, lineEnd, Color.red, 0.0 );

			if( trisHost != null ) {
				ProGeo.TriangulateSimplePolygon( newShape, trisHost.mesh, false );
				trisHost.mesh.RecalculateNormals();

				// debug output all verts..
				if( Input.GetButtonDown('DebugReset') && debugHost != null ) {
					debugHost.Reset( newShape, false );
				}
			}

			// we done?
			if( Input.GetButtonDown('ReflectToggle') )
			{
				AudioSource.PlayClipAtPoint( confirmReflectSnd, hostcam.transform.position );
				// use new shape
				currLevGeo = newShape;
				UpdateCollisionMesh();
				isReflecting = false;
				numReflections++;

				// draw the triangulated mesh
				if( trisHost != null ) {
					ProGeo.TriangulateSimplePolygon( newShape, trisHost.mesh, false );
					trisHost.mesh.RecalculateNormals();
				}
			}
			else if( Input.GetButtonDown('Cancel') )
			{
				AudioSource.PlayClipAtPoint( cancelReflectSnd, hostcam.transform.position );
				isReflecting = false;
			}
		}
		else
		{
			helpText.text = numReflections + ' / ' + GetLevel().maxReflections;

			if( Input.GetButtonDown('ReflectToggle') )
			{
				if( numReflections >= GetLevel().maxReflections && !debugUnlimited )
				{
					// no more allowed
					AudioSource.PlayClipAtPoint( maxedReflectionsSnd, hostcam.transform.position );
				}
				else
				{
					// start drag
					AudioSource.PlayClipAtPoint( startReflectSnd, hostcam.transform.position );
					lineStart = GetMouseXYWorldPos();
					isReflecting = true;
				}
			}
		}

	}

	// TEMP
	//hostcam.transform.position.x = player.transform.position.x;
	//hostcam.transform.position.y = player.transform.position.y;

}