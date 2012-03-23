#pragma strict

import System.IO;

var width = 0.3;
var currShape = new Mesh2D();
var hostcam : Camera;
var lineStart = Vector2(0,0);
var helpText : GUIText;

var levelGeoCommands:TextAsset;

private var isReflecting = false;

function Start () {

/*
	var svg = new SvgPathBuilder();
	svg.BeginBuilding();
	svg.BuildExample();
	svg.EndBuilding();

	ProGeo.BuildBeltMesh( svg.GetPoints(), -1, 1, false, GetComponent(MeshFilter).mesh );
	*/

	// build from the text file

	// first read the width/height
	var reader = new StringReader( levelGeoCommands.text );
	var line = reader.ReadLine();
	var parts = line.Split([' '], System.StringSplitOptions.RemoveEmptyEntries);
	var w = parseFloat(parts[0]);
	var h = parseFloat(parts[1]);
	var scale = 20.0/h;
	var offset = scale*Vector2( -w/2.0, h/2.0 );

	var builder = new SvgPathBuilder();
	builder.BeginBuilding();
	builder.ExecuteCommands( reader, h, scale, offset );
	builder.EndBuilding();

	currShape = new Mesh2D();
	currShape.pts = builder.GetPoints();

	// TEMP SvgPathBuilder should really have this
	var npts = currShape.pts.length;
	currShape.edgeA = new int[ npts ];
	currShape.edgeB = new int[ npts ];
	for( var i = 0; i < currShape.pts.length; i++ )
	{
		currShape.edgeA[i] = i;
		currShape.edgeB[(i+1)%npts] = i;
	}

	//currShape.Reflect( Vector2(0,-5), Vector2(15,10), false );

	// test clipping
	//var clippedPts = ProGeo.ClipByLine( mesh.pts, mesh.edgeA, mesh.edgeB, Vector2(2.25,2), Vector2(0,-0.25), true );

	UpdateCollisionMesh();
}

function UpdateCollisionMesh()
{
	ProGeo.BuildBeltMesh(
			currShape.pts, currShape.edgeA, currShape.edgeB,
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

	currShape.DebugDraw( Color.green, 0.0 );

	if( isReflecting )
	{
		helpText.text = 'Left Click - Confirm\nRight Click - Cancel';
		// draw the reflected shape
		var newShape = currShape.Duplicate();
		var lineEnd = GetMouseXYWorldPos();
		newShape.Reflect( lineStart, lineEnd, false );
		newShape.DebugDraw( Color.yellow, 0.0 );
		Debug.DrawLine( lineStart, lineEnd, Color.red, 0.0 );

		// we done?
		if( Input.GetButtonDown('ReflectToggle') )
		{
			// use new shape
			currShape = newShape;
			UpdateCollisionMesh();
			isReflecting = false;
		}
		else if( Input.GetButtonDown('Cancel') )
		{
			isReflecting = false;
		}
	}
	else
	{
		helpText.text = 'Left Click';

		if( Input.GetButtonDown('ReflectToggle') )
		{
			// start drag
			lineStart = GetMouseXYWorldPos();
			isReflecting = true;
		}
	}

}