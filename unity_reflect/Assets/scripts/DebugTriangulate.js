#pragma strict

var polys:Mesh2D = null;
private var ps:PlaneSweep = null;
var edge2verts = new List.<int>();
var sortedVerts = new List.<Vector2IdPair>();
var nbors = new PolyVertexNbors();
var isDone = true;

function Reset( _mesh:Mesh2D, isClockwise:boolean )
{
	polys = _mesh;

	var NV = polys.GetNumVertices();

	// create nbor query datastructure
	nbors.Reset( polys, isClockwise );

	// every 2-block is an oriented edge of vertex IDs

	// create oriented edges of original polygon
	edge2verts.Clear();
	for( var vid = 0; vid < NV; vid++ ) {
		edge2verts.Add( vid );
		edge2verts.Add( nbors.GetNext( vid ) );
	}

	//----------------------------------------
	//  Sort vertices by X,Y
	//----------------------------------------

	// First we need to sort the verts by X for determining diagonal ends
	sortedVerts.Clear();

	// Store them in this datastructure so we can do this sorting
	for( var i = 0; i < polys.GetNumVertices(); i++ ) {
		var pair = new Vector2IdPair();
		pair.v = polys.pts[i];
		pair.id = i;
		sortedVerts.Add( pair );
	}

	sortedVerts.Sort( Vector2IdPair.CompareByX );

	//----------------------------------------
	//  Let the plane sweep algorithm do its thing
	//----------------------------------------
	ps = new PlaneSweep();
	ps.Reset( polys, edge2verts, sortedVerts, nbors );
	isDone = false;

	Debug.Log('debugging polys with '+NV+' verts');
}

function Update()
{
	if( ps != null ) {
		if( Input.GetButtonDown("DebugNext") ) {
			if( isDone ) {
				// reset it and go again
				Reset( polys, false );
			}
			Debug.Log('Stepping');
			isDone = !ps.Step(true);
			Debug.Log('is done = '+isDone);
		}
		polys.DebugDraw(Color.green, 0.0);
		ps.DebugDrawActiveEdges(Color.red, Color.yellow);

		// draw the current state
	}
}
