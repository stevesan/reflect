#pragma strict

import System.IO;
import System.Text;

static var Singleton : GameController = null;

var hostcam : Camera;
var snapReflectAngle = true;
var canMoveWhileReflecting = true;
private var mirrorAngleSpeed = 2*Mathf.PI;

//----------------------------------------
//  Components instances we use
//----------------------------------------
var tracker:Tracking = null;

//----------------------------------------
//  Prefabs/Puppet-objects
//----------------------------------------
var helpText : GUIText;
var levelNumber : GUIText;
var titleText : GUIText;
var level0Tute : GUIText;
var level1TuteA : GUIText;
var level1TuteB : GUIText;
var level4Tute : GUIText;

var player : GameObject;
var goal : GameObject;
var keyPrefab : GameObject;
var ballKeyPrefab : GameObject;
var mirrorPrefab : GameObject = null;
var background : GameObject;
var safeArea : SafeArea;

//----------------------------------------
//  Objects for level geometry/UI
//----------------------------------------
var geoTriRender : MeshFilter;	// rendering the fill-triangles for the active collision geometry
var rockCollider : DynamicMeshCollider;
var rockRender : MeshFilter;
var previewTriRender : MeshFilter;	// rendering the fill-triangles of the preview
var debugHost:DebugTriangulate = null;

var mirrorPosIcon : Renderer;

var outlineMesh : MeshFilter;
var outlineWidth  = 0.5;
private var outlineBuffer = new MeshBuffer();

var rockOutlineMesh : MeshFilter;
var rockOutlineWidth = 0.5;
private var rockOutlineBuffer = new MeshBuffer();

//----------------------------------------
//  Fading state
//----------------------------------------
var mainLight : Light;
var fadeOutTime = 0.5;
var fadeInTime = 0.1;
var fastFadeOutTime = 0.25;
var fastFadeInTime = 0.25;
private var doFastFade = false;
private var origLightIntensity : float;
private var fadeStart : float;

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
var rotateSnd : AudioClip;

//----------------------------------------
//  Particle FX
//----------------------------------------
var goalGetFx : ParticleSystem;
var keyGetFx : ParticleSystem;

//----------------------------------------
//  Debug
//----------------------------------------
var debugColor = Color.red;
var debugSecs = 0.0;
var debugUnlimited = false;
var debugDrawPolygonOutline = false;

//----------------------------------------
//  Per-session state
//----------------------------------------
private var levels : List.<LevelInfo> = null;
private var currLevId : int = 0;	// current level
private var goalLevId : int = 0;	// which level we're fading into
private var currLevPoly : Mesh2D = null;	// current effective geometry
private var gamestate:String;

//----------------------------------------
//  Per-level state
//----------------------------------------
private var numKeysGot = 0;
private var numKeys = 0;
private var objectInsts = new Array();

//----------------------------------------
//  Reflection UI state
//----------------------------------------
private var isReflecting = false;
private var numReflectionsDone = 0;
private var numReflectionsAllowed = 0;
private var lineStart = Vector2(0,0);
private var lineEnd = Vector2(0,0);
private var mirrorAngle = 0.0;
private var goalMirrorAngle = 0.0;

function GetLevel() : LevelInfo { return levels[currLevId]; }

function GetIsReflecting() : boolean { return isReflecting; }
function GetMirrorPos() : Vector2 { return lineStart; }
function GetMirrorAngle() : float { return mirrorAngle; }

function OnGetGoal()
{
	if( gamestate == 'playing' ) {
		if( numKeysGot == numKeys ) {
			if( tracker != null )
				tracker.PostEvent( "beatLevel", ""+currLevId );

			FadeToLevel( (currLevId+1) % levels.Count, false );
			goal.GetComponent(Star).SetShown( false );

			// fireworks
			AudioSource.PlayClipAtPoint( goalGetSound, hostcam.transform.position );
			goalGetFx.transform.position = goal.transform.position;
			goalGetFx.Play();
		}
		else
		{
			AudioSource.PlayClipAtPoint( goalLockedSound, hostcam.transform.position );
		}
	}
}

function OnGetMirror( mirror:Mirror )
{
	if( gamestate == 'playing' ) {
		numReflectionsAllowed++;
		Destroy(mirror.gameObject);
	}
}

//----------------------------------------
//  t is from 0 to 1
//----------------------------------------
function SetFadeAmount( t:float ) {
	GetComponent(FadeAmount).SetFadeAmount(t);
	mainLight.intensity = t * origLightIntensity;
	levelNumber.GetComponent(GUITextFade).SetFadeAmount(t);
	helpText.GetComponent(GUITextFade).SetFadeAmount(t);
}

function FadeToLevel( levId:int, fast:boolean ) {
	// fade into next level
	gamestate = 'fadingOut';
	fadeStart = Time.time;
	goalLevId = levId;
	doFastFade = fast;
}

function UpdateGoalLocked()
{
	goal.GetComponent(Star).SetLocked( numKeysGot < numKeys );
}

function OnGetKey( keyObj:GameObject )
{
	numKeysGot++;
	Debug.Log('got '+numKeysGot+' keys');
	Destroy(keyObj);
	UpdateGoalLocked();

	AudioSource.PlayClipAtPoint( keyGetSound, hostcam.transform.position );
	keyGetFx.transform.position = keyObj.transform.position;
	keyGetFx.Play();

	if( tracker != null )
	{
		var json = new ToStringJsonWriter();
		json.WriteObjectStart();
		json.Write("keyPos", Utils.ToVector2(keyObj.transform.position));
		json.WriteObjectEnd();
		tracker.PostEvent( "gotKey", json.GetString() );
	}
}

function PolysToStroke( polys:Mesh2D, vmax:float, width:float, buffer:MeshBuffer, mesh:Mesh )
{
	var edgeVisited = new boolean[ polys.GetNumEdges() ];
	for( var eid = 0; eid < edgeVisited.length; eid++ ) {
		edgeVisited[ eid ] = false;
	}

	// TODO - we're being pretty damn conservative with the number of vertices the final mesh may need..
	buffer.Allocate( 4*polys.GetNumEdges(), 2*polys.GetNumEdges() );
	var nextFreeVert = 0;
	var nextFreeTri = 0;

	while( true ) {

		// find an unvisited edge
		eid = 0;
		while( eid < edgeVisited.length && edgeVisited[eid] ) eid++;
		if( eid >= edgeVisited.length ) break;

		// find the loop starting at this edge
		var loop = polys.GetEdgeLoop( eid );

		// mark all edges in the loop
		for( var loopEid = 0; loopEid < loop.Count; loopEid++ ) {
			edgeVisited[ loop[loopEid] ] = true;
		}

		// stroke out the loop
		// reverse the loop, just cuz
		loop.Reverse();

		// get the points of the edge loop to use as control points
		var nControls = loop.Count;
		var loopPts = new Vector2[ nControls ];
		for( loopEid = 0; loopEid < loop.Count; loopEid++ ) {
			var polysEid = loop[ loopEid ];
			var startPid = polys.edgeA[ polysEid ];
			loopPts[loopEid] = polys.pts[ startPid ];
		}

		// compute simple lerp'd V coordinates
		var texVs = new float[nControls];
		for( var i = 0; i < nControls; i++ ) {
			texVs[i] = (i*1.0)/(nControls-1.0) * vmax;
		}

		ProGeo.Stroke2D( loopPts, texVs, 0, nControls-1,
				true,
				width, buffer,
				nextFreeVert, nextFreeTri );

		// update
		nextFreeVert += 2*nControls;
		nextFreeTri += 2*nControls;
	}

	// update mesh
	buffer.CopyToMesh( mesh );
	mesh.RecalculateBounds();
}

function OnCollidingGeometryChanged()
{
	// update collision mesh
	ProGeo.BuildBeltMesh(
			currLevPoly.pts, currLevPoly.edgeA, currLevPoly.edgeB,
			-10, 10, false, GetComponent(MeshFilter).mesh );
	GetComponent(DynamicMeshCollider).OnMeshChanged();

	// update rendered fill mesh
	if( geoTriRender != null ) {
		ProGeo.TriangulateSimplePolygon( currLevPoly, geoTriRender.mesh, false );
		SetNormalsAtCamera( geoTriRender.mesh );

		// update the outline
		PolysToStroke( currLevPoly, 1.0, outlineWidth, outlineBuffer, outlineMesh.mesh );
		SetNormalsAtCamera( outlineMesh.mesh );
	}
}

function SwitchLevel( id:int )
{
	Debug.Log('switching to level '+id);
	
	// we'll be changing the geo, obviously, so make a copy
	isReflecting = false;
	player.GetComponent(PlayerControl).inputEnabled = true;
	numReflectionsDone = 0;
	currLevId = id;

	currLevPoly = levels[id].geo.Duplicate();
	OnCollidingGeometryChanged();

	// update rocks collider
	if( levels[id].rockGeo.pts != null ) {
		ProGeo.BuildBeltMesh( levels[id].rockGeo, -10, 10, true,
				rockCollider.GetMesh() );
		rockCollider.OnMeshChanged();

		// update rock render
		ProGeo.TriangulateSimplePolygon( levels[id].rockGeo, rockRender.mesh, false );
		SetNormalsAtCamera( rockRender.mesh );

		// update the outline
		PolysToStroke( levels[id].rockGeo, 1.0, rockOutlineWidth, rockOutlineBuffer, rockOutlineMesh.mesh );
		SetNormalsAtCamera( rockOutlineMesh.mesh );
	}
	else {
		rockCollider.GetMesh().Clear();
		rockCollider.OnMeshChanged();
		rockRender.mesh.Clear();

		// outline
		rockOutlineMesh.mesh.Clear();
	}

	// position the player
	player.transform.position = levels[id].playerPos;
	player.GetComponent(Rigidbody).velocity = Vector3(0,0,0);
	player.GetComponent(PlayerControl).Reset();
	goal.transform.position = levels[id].goalPos;
	goal.GetComponent(Star).SetShown( true );

	// move the background to the area's center
	background.transform.position = levels[id].areaCenter;
	background.transform.position.z = 10;

	// move the safe area
	safeArea.transform.position = levels[id].areaCenter;
	safeArea.transform.position.z = player.transform.position.z;

	// move camera to see the level
	hostcam.transform.position = Utils.ToVector3( levels[id].areaCenter, hostcam.transform.position.z );

	//Debug.Log('spawned player at '+player.transform.position);
	//Debug.Log('level area center at '+levels[id].areaCenter);

	//----------------------------------------
	//  Spawn objects
	//----------------------------------------
	
	numKeysGot = 0;
	numKeys = 0;
	for( inst in objectInsts )
		Destroy(inst);
	objectInsts.Clear();

	// disable the prefabs
	keyPrefab.active = false;
	Utils.HideAll( keyPrefab );
	
	ballKeyPrefab.active = false;
	Utils.HideAll( ballKeyPrefab );
	
	mirrorPrefab.active = false;
	Utils.HideAll( mirrorPrefab );
	
	numReflectionsAllowed = levels[id].maxReflections;
	
	// spawn all objects

	for( lobj in levels[id].objects ) {
		var obj:GameObject = null;

		// spawn key or ballkey
		if( lobj.type == 'key' ) {
			numKeys++;
			obj = Instantiate( keyPrefab, lobj.pos, keyPrefab.transform.rotation );
		}
		else if( lobj.type == 'ballKey' ) {
			numKeys++;
			obj = Instantiate( ballKeyPrefab, lobj.pos, ballKeyPrefab.transform.rotation );
			// make it NOT collide with the player, so it doesn't affect player's motion
			Physics.IgnoreCollision( obj.GetComponent(Collider), player.GetComponent(Collider) );
		}
		else if( lobj.type == 'mirror' ) {
			obj = Instantiate( mirrorPrefab, lobj.pos, mirrorPrefab.transform.rotation );
			obj.GetComponent(Mirror).receiver = this.gameObject;
		}
		else {
		Debug.LogError('Invalid gameobject type from Inkscape export: '+lobj.type);
		}

		// setup
		obj.transform.parent = this.transform;
		obj.active = true;
		Utils.ShowAll( obj );
		objectInsts.Push( obj );
		Debug.Log('spawned '+lobj.type+' at '+lobj.pos);
	}

	// update goal locked state
	UpdateGoalLocked();

	// put up correct status text
	levelNumber.text = 'Moment '+(currLevId+1)+ '/'+levels.Count+
	'          P - Reset'+
	'          [ ] - Skip';

	if( tracker != null )
		tracker.PostEvent( "startLevel", ""+id );
}

function Awake()
{
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

		origLightIntensity = mainLight.intensity;
	}
}

function Start()
{
	SetFadeAmount( 0 );
	fadeStart = Time.time;
	gamestate = 'startscreen';
}

function UpdateCollisionMesh()
{
}

function SetNormalsAtCamera( mesh:Mesh )
{
	mesh.RecalculateNormals();
}

function GetMouseXYWorldPos() : Vector2
{
	var ray = hostcam.ScreenPointToRay( Input.mousePosition );
	// solve for when the ray hits z=0 plane
	var alpha = -ray.origin.z / ray.direction.z;
	var mouseWpos = ray.origin + alpha*ray.direction;
	return Utils.ToVector2( mouseWpos );
}

function UpdateMirrorAngle() : void
{
	var maxDelta = mirrorAngleSpeed * Time.deltaTime;
	if( Mathf.Abs(goalMirrorAngle-mirrorAngle) < maxDelta ) {
		mirrorAngle = goalMirrorAngle;
	}
	else {
		var dir = Mathf.Sign(goalMirrorAngle - mirrorAngle);
		mirrorAngle += maxDelta * dir;
	}
}

function UpdateReflectionLine() : void
{
	lineStart = GetMouseXYWorldPos();

	//if( goalMirrorAngle < 0 ) goalMirrorAngle += Mathf.PI;
	//if( goalMirrorAngle >= Mathf.PI ) goalMirrorAngle -= Mathf.PI;
	UpdateMirrorAngle();
	lineEnd = lineStart + Vector2( Mathf.Cos(mirrorAngle), Mathf.Sin(mirrorAngle));

/* Old code which used the mouse end for reflection line end..
	if( snapReflectAngle ) {
		// snap the line end to the closest 45 degree angle
		var delta = lineEnd - lineStart;
		var angle = Mathf.Atan2( delta.y, delta.x );
		var angleStep = Mathf.PI / 4;	// 45 deg
		var snappedAngle = Mathf.Round(angle/angleStep) * angleStep;
		lineEnd = lineStart + Vector2( Mathf.Cos(snappedAngle), Mathf.Sin(snappedAngle) );
	}
	*/
}

function OnPlayerFallout() : void
{
	if( gamestate == 'playing' ) {
		// reset
		AudioSource.PlayClipAtPoint( restartSnd, hostcam.transform.position );
		FadeToLevel( currLevId, false );
		previewTriRender.gameObject.GetComponent(Renderer).enabled = false;
	}
}

class ReflectEventDetails
{
	var mirrorAngle:float;
	var mirrorPos:float[];
	var playerPos:float[];
	
	function ToJson() : String { return JsonMapper.ToJson(this); }
	
	static function CreateToJson( _mirrorAngle:float, _mirrorPos:Vector3, _playerPos:Vector3 ) : String
	{
		var e = new ReflectEventDetails();
		e.mirrorAngle = _mirrorAngle;
		e.mirrorPos = Utils.To2Array(_mirrorPos);
		e.playerPos = Utils.To2Array(_playerPos);
		return e.ToJson();		
	}
};

function Update()
{
	level0Tute.enabled = false;
	level1TuteA.enabled = false;
	level1TuteB.enabled = false;
	level4Tute.enabled = false;
	helpText.text = "";

	if( gamestate == 'startscreen' ) {
		// fading in
		var alpha = Mathf.Clamp( (Time.time-fadeStart) / fadeInTime, 0.0, 1.0 );
		SetFadeAmount( alpha );

		// clear the other text objects
		levelNumber.text = '';

		if( Input.GetButtonDown('ReflectToggle') || Input.GetButtonDown('NextLevel') ) {
			FadeToLevel( 0, false );
			AudioSource.PlayClipAtPoint( restartSnd, hostcam.transform.position );
			Destroy(titleText);
		}
	}
	else if( gamestate == 'fadingOut' ) {
		var outTime = (doFastFade ? fastFadeOutTime : fadeOutTime);
		alpha = Mathf.Clamp( (Time.time-fadeStart) / outTime, 0.0, 1.0 );
		SetFadeAmount( 1-alpha );

		if( alpha >= 1.0 ) {
			// done fading
			gamestate = 'fadedOut';
		}
	}
	else if( gamestate == 'fadedOut' ) {
		// do the actual level switch
		SwitchLevel( goalLevId );

		// and fade in, but game is playable now
		fadeStart = Time.time;
		gamestate = 'playing';
	}
	else if( gamestate == 'playing' ) {
		// fade in initially - just keep updating this
		var inTime = (doFastFade ? fastFadeInTime : fadeInTime);
		alpha = Mathf.Clamp( (Time.time-fadeStart) / inTime, 0.0, 1.0 );
		SetFadeAmount( alpha );

		level0Tute.enabled = (currLevId == 0);
		level1TuteA.enabled = currLevId == 1
			&& (numReflectionsAllowed-numReflectionsDone > 0)
			&& !isReflecting;
		level1TuteB.enabled = currLevId == 1
			&& isReflecting;
		level4Tute.enabled = currLevId == 4
			&& isReflecting;

		if( numReflectionsAllowed > 0 )
			helpText.text = numReflectionsDone + ' / ' + numReflectionsAllowed;
		else
			helpText.text = "";

		if( currLevPoly != null )
		{
			//currLevPoly.DebugDraw( Color.blue, 0.0 );

			if( Input.GetButtonDown('Reset') )
			{
				AudioSource.PlayClipAtPoint( restartSnd, hostcam.transform.position );
				FadeToLevel( currLevId, true );
				previewTriRender.gameObject.GetComponent(Renderer).enabled = false;

				if( tracker != null )
					tracker.PostEvent( "resetLevel", ""+currLevId );
			}
			else if( Input.GetButtonDown('NextLevel') ) {
				FadeToLevel( (currLevId+1)%levels.Count, false );
				previewTriRender.gameObject.GetComponent(Renderer).enabled = false;
			}
			else if( Input.GetButtonDown('PrevLevel') ) {
				FadeToLevel( (levels.Count+currLevId-1)%levels.Count, false );
				previewTriRender.gameObject.GetComponent(Renderer).enabled = false;
			}
			else if( isReflecting )
			{
				//----------------------------------------
				//  Update visuals
				//----------------------------------------
				if( mirrorPosIcon != null ) {
					mirrorPosIcon.enabled = true;
					mirrorPosIcon.transform.position = lineStart;
				}

				//----------------------------------------
				//  Check for rotation input
				//----------------------------------------
				if( Input.GetButtonDown('RotateMirrorCW') ) {
					goalMirrorAngle -= Mathf.PI/4;
					AudioSource.PlayClipAtPoint( rotateSnd, hostcam.transform.position );
				}
				else if( Input.GetButtonDown('RotateMirrorCCW') ) {
					goalMirrorAngle += Mathf.PI/4;
					AudioSource.PlayClipAtPoint( rotateSnd, hostcam.transform.position );
				}

				//----------------------------------------
				//  Animate and draw preview
				//----------------------------------------
				var newShape = currLevPoly.Duplicate();
				UpdateReflectionLine();
				newShape.Reflect( lineStart, lineEnd, false );

				//Debug.Log('shape has '+newShape.GetNumVertices()+' verts, ' + newShape.GetNumEdges()+ ' edges');
				//newShape.DebugDraw( Color.yellow, 0.0 );
				//Debug.DrawLine( lineStart, lineEnd, Color.red, 0.0 );

				if( debugDrawPolygonOutline ) {
					newShape.DebugDraw( debugColor, debugSecs );
				}

				if( previewTriRender != null ) {
					ProGeo.TriangulateSimplePolygon( newShape, previewTriRender.mesh, false );
					SetNormalsAtCamera( previewTriRender.mesh );
					previewTriRender.gameObject.GetComponent(Renderer).enabled = true;

					// debug output all verts..
					if( Input.GetButtonDown('DebugReset') && debugHost != null ) {
						debugHost.Reset( newShape, false );
					}
				}

				// we done?
				if( Input.GetButtonDown('ReflectToggle') )
				{
					// confirmed
					AudioSource.PlayClipAtPoint( confirmReflectSnd, hostcam.transform.position );

					// IMPORTANT: make sure we snap to the 45-degree increments.
					// Otherwise, it's possible for us the commit the in-motion shape..
					mirrorAngle = goalMirrorAngle;
					newShape = currLevPoly.Duplicate();
					UpdateReflectionLine();
					newShape.Reflect( lineStart, lineEnd, false );

					// use new shape
					currLevPoly = newShape;
					OnCollidingGeometryChanged();

					if( previewTriRender != null ) {
						// hide preview
						previewTriRender.gameObject.GetComponent(Renderer).enabled = false;
					}

					// update state
					player.GetComponent(PlayerControl).inputEnabled = true;
					numReflectionsDone++;
					isReflecting = false;

					if( tracker != null )
					{
						var json = new ToStringJsonWriter();
						json.WriteObjectStart();
						json.Write("mirrorAngle", mirrorAngle);
						json.Write("lineStart", Utils.ToVector2(lineStart));
						json.Write("playerPos", Utils.ToVector2(player.transform.position));
						json.WriteObjectEnd();
						tracker.PostEvent( "reflect", json.GetString() );
					}
				}
				else if( Input.GetButtonDown('Cancel'))
				{
					AudioSource.PlayClipAtPoint( cancelReflectSnd, hostcam.transform.position );
					isReflecting = false;
					player.GetComponent(PlayerControl).inputEnabled = true;
					if( previewTriRender != null ) {
						// hide new-geo host
						previewTriRender.gameObject.GetComponent(Renderer).enabled = false;
					}
				}
			}
			else {

				if( Input.GetButtonDown('ReflectToggle') )
				{
					if( numReflectionsDone >= numReflectionsAllowed && !debugUnlimited )
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
						mirrorAngle = Mathf.PI / 2;
						goalMirrorAngle = Mathf.PI / 2;
						if( !canMoveWhileReflecting ) {
							player.GetComponent(PlayerControl).inputEnabled = false;
						}
					}
				}
			}

		}
	}
}