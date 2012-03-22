#pragma strict

var width = 0.3;
var currShape = new Mesh2D();
var hostcam : Camera;
var lineStart = Vector2(0,0);
var helpText : GUIText;

private var isReflecting = false;

function Start () {

/*
	var svg = new SvgPathBuilder();
	svg.BeginBuilding();
	svg.BuildExample();
	svg.EndBuilding();

	ProGeo.BuildBeltMesh( svg.GetPoints(), -1, 1, false, GetComponent(MeshFilter).mesh );
	*/

	var npts = 6;
	currShape = new Mesh2D();
	currShape.pts = [
		Vector2( 0, 0 ),
		Vector2( 5, 0 ),
		Vector2( 5, 5 ),
		Vector2( 0, 5 ) ];

	currShape.edgeA = [ 0, 1, 2, 3];
	currShape.edgeB = [ 1, 2, 3, 0];

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