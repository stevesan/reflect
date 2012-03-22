#pragma strict

var width = 0.3;

function Start () {

/*
	var svg = new SvgPathBuilder();
	svg.BeginBuilding();
	svg.BuildExample();
	svg.EndBuilding();

	ProGeo.BuildBeltMesh( svg.GetPoints(), -1, 1, false, GetComponent(MeshFilter).mesh );
	*/

	var npts = 6;
	var mesh = new Mesh2D();
	mesh.pts = [
		Vector2( 0, 0 ),
		Vector2( 1, 0 ),
		Vector2( 1, 1 ),
		Vector2( 2, 1 ),
		Vector2( 2, 2 ),
		Vector2( 0, 2 ) ];

	mesh.edgeA = [ 0, 1, 2, 3, 4, 5];
	mesh.edgeB = [ 1, 2, 3, 4, 5, 0];
	mesh.Reflect( Vector2(0,0), Vector2(1,1), false );

	// test clipping
	//var clippedPts = ProGeo.ClipByLine( mesh.pts, mesh.edgeA, mesh.edgeB, Vector2(2.25,2), Vector2(0,-0.25), true );

	ProGeo.BuildBeltMesh( mesh.pts, mesh.edgeA, mesh.edgeB, -10, 10, false, GetComponent(MeshFilter).mesh );

	// do this after modifying the Mesh
	if( gameObject.GetComponent(MeshCollider) != null )
		Destroy(gameObject.GetComponent(MeshCollider));
	gameObject.AddComponent(MeshCollider);
}

function Update () {
}