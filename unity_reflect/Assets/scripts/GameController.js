#pragma strict

import System.IO;

static var Singleton : GameController = null;

var hostcam : Camera;
var player : GameObject;
var goal : GameObject;
var helpText : GUIText;
var levelsText : TextAsset;

var goalGetSound : AudioClip;
var restartSnd : AudioClip;
var startReflectSnd : AudioClip;
var cancelReflectSnd : AudioClip;
var confirmReflectSnd : AudioClip;

//----------------------------------------
//  Game state
//----------------------------------------
private var levels : List.<LevelInfo> = null;
private var currLevId : int = 0;
private var currLevGeo : Mesh2D = null;

//----------------------------------------
//  Reflection UI state
//----------------------------------------
private var isReflecting = false;
private var lineStart = Vector2(0,0);

function GetLevel() : LevelInfo { return levels[currLevId]; }

function OnGetGoal()
{
	AudioSource.PlayClipAtPoint( goalGetSound, hostcam.transform.position );
	SwitchLevel( (currLevId+1) % levels.Count );
}

function SwitchLevel( id:int )
{
	// we'll be changing the geo, obviously, so make a copy
	isReflecting = false;
	currLevId = id;

	currLevGeo = levels[id].geo.Duplicate();
	UpdateCollisionMesh();

	player.transform.position = levels[id].playerPos;
	player.GetComponent(PlayerControl).Reset();
	goal.transform.position = levels[id].goalPos;
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
		currLevGeo.DebugDraw( Color.green, 0.0 );

		if( Input.GetButtonDown('Reset') )
		{
			AudioSource.PlayClipAtPoint( restartSnd, hostcam.transform.position );
			SwitchLevel( currLevId );
		}
		else if( Input.GetButtonDown('NextLevel') )
		{
			SwitchLevel( (currLevId+1)%levels.Count );
		}
		else if( isReflecting )
		{
			helpText.text = 'Left Click - Confirm\nRight Click - Cancel';
			// draw the reflected shape
			var newShape = currLevGeo.Duplicate();
			var lineEnd = GetMouseXYWorldPos();
			newShape.Reflect( lineStart, lineEnd, false );
			newShape.DebugDraw( Color.yellow, 0.0 );
			Debug.DrawLine( lineStart, lineEnd, Color.red, 0.0 );

			// we done?
			if( Input.GetButtonDown('ReflectToggle') )
			{
				AudioSource.PlayClipAtPoint( confirmReflectSnd, hostcam.transform.position );
				// use new shape
				currLevGeo = newShape;
				UpdateCollisionMesh();
				isReflecting = false;
			}
			else if( Input.GetButtonDown('Cancel') )
			{
				AudioSource.PlayClipAtPoint( cancelReflectSnd, hostcam.transform.position );
				isReflecting = false;
			}
		}
		else
		{
			helpText.text = 'Left Click';

			if( Input.GetButtonDown('ReflectToggle') )
			{
				// start drag
				AudioSource.PlayClipAtPoint( startReflectSnd, hostcam.transform.position );
				lineStart = GetMouseXYWorldPos();
				isReflecting = true;
			}
		}

	}

	// TEMP
	hostcam.transform.position.x = player.transform.position.x;
	hostcam.transform.position.y = player.transform.position.y;

}